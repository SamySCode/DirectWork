-- Abuse and resilience hardening (team/abuse.md). Nothing here changes who
-- can see or do what; it changes what a request costs.
--
-- 1. Row-level policies that called a SECURITY DEFINER helper per row
--    (owns_project, has_applied, is_membership_party) or ran a correlated
--    sub-select per row made every unfiltered read cost O(rows in the whole
--    table): `GET /rest/v1/applications?select=id` from any account checked
--    every application on the platform. The same rules are now written as
--    "id in (the caller's own ids)": the set is computed once per query
--    (a hashed SubPlan over a few indexed rows), so the cost follows the
--    caller's own data, not the platform's. (ROWS 20 tells the planner the
--    sets are small, so it looks them up by index.)
-- 2. search_skills: 2+ characters (the app never sends fewer), at most 50
--    candidates ranked by popularity, and popularity counted up to 500.
-- 3. export_my_data: the Deal Sheet sections used the per-row helper over
--    every deal on the platform; now they start from the caller's own
--    collaborations. Also limited to 10 exports an hour per account (it is
--    the largest response in the app).
-- 4. Activity: marking read only writes rows that are unread, so a script
--    re-sending "mark everything read" rewrites nothing.
-- 5. An index for the moderators' disputed-payments list.
--
-- Standing rules: revoke then grant on every new function; wrap
-- (select auth.uid()) in policies.

-- ---------------------------------------------------------------------------
-- 1. Set-returning helpers (definer: they read past RLS, keyed on the
--    caller only) and the rewritten SELECT policies.
-- ---------------------------------------------------------------------------
create function private.owned_project_ids(p_user uuid)
returns setof uuid
language sql
stable
security definer
rows 20
set search_path = ''
as $$ select id from public.projects where owner_id = p_user; $$;

create function private.applied_project_ids(p_user uuid)
returns setof uuid
language sql
stable
security definer
rows 20
set search_path = ''
as $$ select project_id from public.applications where applicant_id = p_user; $$;

-- Collaborations p_user is a party to: as the member, or as the listing owner.
create function private.party_membership_ids(p_user uuid)
returns setof uuid
language sql
stable
security definer
rows 20
set search_path = ''
as $$
  select m.id from public.project_memberships m where m.user_id = p_user
  union
  select m.id from public.project_memberships m
  join public.projects p on p.id = m.project_id
  where p.owner_id = p_user;
$$;

create function private.party_deal_sheet_ids(p_user uuid)
returns setof uuid
language sql
stable
security definer
rows 20
set search_path = ''
as $$
  select d.id from public.deal_sheets d
  where d.membership_id in (select private.party_membership_ids(p_user));
$$;

create function private.visible_application_ids(p_user uuid)
returns setof uuid
language sql
stable
security definer
rows 20
set search_path = ''
as $$
  select a.id from public.applications a where a.applicant_id = p_user
  union
  select a.id from public.applications a
  join public.projects p on p.id = a.project_id
  where p.owner_id = p_user;
$$;

revoke execute on function private.owned_project_ids(uuid) from public, anon;
revoke execute on function private.applied_project_ids(uuid) from public, anon;
revoke execute on function private.party_membership_ids(uuid) from public, anon;
revoke execute on function private.party_deal_sheet_ids(uuid) from public, anon;
revoke execute on function private.visible_application_ids(uuid) from public, anon;
grant execute on function private.owned_project_ids(uuid) to authenticated, service_role;
grant execute on function private.applied_project_ids(uuid) to authenticated, service_role;
grant execute on function private.party_membership_ids(uuid) to authenticated, service_role;
grant execute on function private.party_deal_sheet_ids(uuid) to authenticated, service_role;
grant execute on function private.visible_application_ids(uuid) to authenticated, service_role;

drop policy "Published listings are readable; owners, applicants and admins see their own" on public.projects;
create policy "Published listings are readable; owners, applicants and admins see their own"
  on public.projects for select
  to authenticated
  using (
    status = 'published'
    or owner_id = (select auth.uid())
    or id in (select private.applied_project_ids((select auth.uid())))
    or (select private.is_admin((select auth.uid())))
  );

drop policy "Applicants and listing owners can read applications" on public.applications;
create policy "Applicants and listing owners can read applications"
  on public.applications for select
  to authenticated
  using (
    applicant_id = (select auth.uid())
    or project_id in (select private.owned_project_ids((select auth.uid())))
  );

drop policy "Members and listing owners can read memberships" on public.project_memberships;
create policy "Members and listing owners can read memberships"
  on public.project_memberships for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or project_id in (select private.owned_project_ids((select auth.uid())))
  );

drop policy "Outcomes follow membership visibility" on public.project_outcomes;
create policy "Outcomes follow membership visibility"
  on public.project_outcomes for select
  to authenticated
  using (membership_id in (select private.party_membership_ids((select auth.uid()))));

drop policy "History follows application visibility" on public.application_status_history;
create policy "History follows application visibility"
  on public.application_status_history for select
  to authenticated
  using (application_id in (select private.visible_application_ids((select auth.uid()))));

drop policy "Attachments follow application visibility" on public.application_attachments;
create policy "Attachments follow application visibility"
  on public.application_attachments for select
  to authenticated
  using (application_id in (select private.visible_application_ids((select auth.uid()))));

drop policy "Questions follow application visibility" on public.application_questions;
create policy "Questions follow application visibility"
  on public.application_questions for select
  to authenticated
  using (application_id in (select private.visible_application_ids((select auth.uid()))));

drop policy "The two parties read their deal sheet" on public.deal_sheets;
create policy "The two parties read their deal sheet"
  on public.deal_sheets for select
  to authenticated
  using (membership_id in (select private.party_membership_ids((select auth.uid()))));

drop policy "Payment reports follow deal sheet visibility" on public.payment_reports;
create policy "Payment reports follow deal sheet visibility"
  on public.payment_reports for select
  to authenticated
  using (deal_sheet_id in (select private.party_deal_sheet_ids((select auth.uid()))));

-- ---------------------------------------------------------------------------
-- 2. search_skills: bounded work per call.
-- ---------------------------------------------------------------------------
create or replace function public.search_skills(p_query text)
returns table (name text)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select lower(btrim(coalesce(p_query, ''))) as t
  ),
  candidates as (
    select
      s.id,
      s.name,
      lower(s.name) = q.t as exact,
      left(lower(s.name), char_length(q.t)) = q.t as prefix
    from public.skills s, q
    where char_length(q.t) between 2 and 60
      and strpos(lower(s.name), q.t) > 0
    order by exact desc, prefix desc, char_length(s.name), s.name
    limit 50
  )
  select c.name
  from candidates c
  order by
    c.exact desc,
    c.prefix desc,
    (select count(*) from (
       select 1 from public.profile_skills ps where ps.skill_id = c.id limit 500
     ) used) desc,
    c.name
  limit 10;
$$;

-- ---------------------------------------------------------------------------
-- 3. export_my_data v3: caller-first Deal Sheet sections and a rate limit.
-- The limiter writes, so the function is now VOLATILE (PostgREST runs
-- STABLE functions read-only). The app already calls it with POST.
-- ---------------------------------------------------------------------------

-- Counts a hit against the caller's own key only, so it can't be used to
-- burn someone else's allowance. private isn't exposed through the Data API.
create function private.hit_my_rate_limit(p_bucket text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return false;
  end if;
  return private.hit_rate_limit(p_bucket || ':' || v_uid::text, p_max, p_window_seconds);
end;
$$;

revoke execute on function private.hit_my_rate_limit(text, integer, integer) from public, anon;
grant execute on function private.hit_my_rate_limit(text, integer, integer) to authenticated;

create or replace function public.export_my_data()
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if not private.hit_my_rate_limit('export_my_data', 10, 3600) then
    raise exception 'You''ve exported your data several times this hour. Try again in a while.'
      using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'schema_version', 2,
    'exported_at', now(),
    'user_id', v_uid,
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'skills', coalesce((
      select jsonb_agg(s.name order by s.name)
      from public.profile_skills ps join public.skills s on s.id = ps.skill_id
      where ps.profile_id = v_uid
    ), '[]'::jsonb),
    'portfolio_images', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.position) from public.portfolio_images i where i.profile_id = v_uid
    ), '[]'::jsonb),
    'listings', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id, 'title', p.title, 'public_summary', p.public_summary,
          'opportunity_type', p.opportunity_type, 'status', p.status, 'location', p.location,
          'remote_pref', p.remote_pref, 'commitment', p.commitment, 'duration', p.duration,
          'compensation_type', p.compensation_type, 'compensation_min', p.compensation_min,
          'compensation_max', p.compensation_max, 'currency', p.currency,
          'is_featured', p.is_featured, 'published_at', p.published_at,
          'created_at', p.created_at, 'updated_at', p.updated_at,
          'review_note', public.get_review_note(p.id),
          'admission', (select to_jsonb(a) - 'project_id' from public.project_admission a where a.project_id = p.id),
          'required_skills', coalesce((
            select jsonb_agg(s.name order by s.name)
            from public.project_required_skills rs join public.skills s on s.id = rs.skill_id
            where rs.project_id = p.id
          ), '[]'::jsonb),
          'image_paths', coalesce((
            select jsonb_agg(li.storage_path order by li.position)
            from public.listing_images li where li.project_id = p.id
          ), '[]'::jsonb)
        )
        order by p.created_at
      )
      from public.projects p where p.owner_id = v_uid
    ), '[]'::jsonb),
    'applications', coalesce((
      select jsonb_agg(
        to_jsonb(a) || jsonb_build_object(
          'attachment_paths', coalesce((
            select jsonb_agg(aa.storage_path order by aa.created_at)
            from public.application_attachments aa where aa.application_id = a.id
          ), '[]'::jsonb),
          'questions', coalesce((
            select jsonb_agg(
              jsonb_build_object('question', q.question, 'answer', q.answer,
                                 'asked_at', q.asked_at, 'answered_at', q.answered_at)
              order by q.asked_at
            )
            from public.application_questions q where q.application_id = a.id
          ), '[]'::jsonb)
        )
        order by a.created_at
      )
      from public.applications a where a.applicant_id = v_uid
    ), '[]'::jsonb),
    'collaborations', coalesce((
      select jsonb_agg(
        to_jsonb(m) || jsonb_build_object(
          'outcome', (select to_jsonb(o) - 'membership_id' from public.project_outcomes o where o.membership_id = m.id)
        )
        order by m.joined_at
      )
      from public.project_memberships m
      where m.user_id = v_uid
         or m.project_id in (select id from public.projects where owner_id = v_uid)
    ), '[]'::jsonb),
    'references_written', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at) from public.work_references r where r.author_id = v_uid
    ), '[]'::jsonb),
    'references_received', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at) from public.work_references r where r.subject_id = v_uid
    ), '[]'::jsonb),
    'reports_filed', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', r.id, 'target_kind', r.target_kind, 'profile_id', r.profile_id,
                           'project_id', r.project_id, 'reason', r.reason, 'details', r.details,
                           'status', r.status, 'created_at', r.created_at)
        order by r.created_at
      )
      from public.reports r where r.reporter_id = v_uid
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object('blocked_id', b.blocked_id, 'created_at', b.created_at) order by b.created_at)
      from public.blocks b where b.blocker_id = v_uid
    ), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at) from public.activity x where x.user_id = v_uid
    ), '[]'::jsonb),
    'subscription', (
      select jsonb_build_object('plan', s.plan, 'status', s.status,
                                'current_period_end', s.current_period_end, 'updated_at', s.updated_at)
      from public.subscriptions s where s.user_id = v_uid
    ),
    'legal_acceptances', coalesce((
      select jsonb_agg(jsonb_build_object('document', l.document, 'version', l.version, 'accepted_at', l.accepted_at)
                       order by l.accepted_at)
      from public.legal_acceptances l where l.user_id = v_uid
    ), '[]'::jsonb),
    -- Deal Sheets for collaborations the caller is a party to, the payment
    -- reports on them, and disputes the caller raised. The reviewer's
    -- resolution note (private.payment_dispute_resolutions) is not included.
    'deal_sheets', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.created_at)
      from public.deal_sheets d
      where d.membership_id in (select private.party_membership_ids(v_uid))
    ), '[]'::jsonb),
    'payment_reports', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at)
      from public.payment_reports r
      where r.deal_sheet_id in (select private.party_deal_sheet_ids(v_uid))
    ), '[]'::jsonb),
    'payment_disputes_raised', coalesce((
      select jsonb_agg(
        jsonb_build_object('report_id', r.id, 'deal_sheet_id', r.deal_sheet_id,
                           'reason', r.dispute_reason, 'status', r.dispute_status,
                           'disputed_at', r.disputed_at, 'resolved_at', r.resolved_at)
        order by r.disputed_at
      )
      from public.payment_reports r
      join public.deal_sheets d on d.id = r.deal_sheet_id
      join public.project_memberships m on m.id = d.membership_id
      join public.projects p on p.id = m.project_id
      where p.owner_id = v_uid and r.dispute_status <> 'none'
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Activity: once read, a row stays read and isn't rewritten.
-- Returning null from a BEFORE trigger skips the row: no new tuple, no WAL.
-- ---------------------------------------------------------------------------
create function private.activity_read_once()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.read_at is not null or new.read_at is null then
    return null;
  end if;
  -- The client's clock isn't trusted for retention (180 days after reading).
  new.read_at := now();
  return new;
end;
$$;

revoke execute on function private.activity_read_once() from public, anon, authenticated;

create trigger activity_read_once
  before update of read_at on public.activity
  for each row execute function private.activity_read_once();

-- ---------------------------------------------------------------------------
-- 5. The moderators' queue lists open disputes oldest first.
-- ---------------------------------------------------------------------------
create index payment_reports_open_disputes_idx
  on public.payment_reports (disputed_at)
  where dispute_status = 'disputed';
