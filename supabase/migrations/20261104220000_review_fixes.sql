-- Fixes from the independent database review (2026-11-04).

-- ---------------------------------------------------------------------------
-- I2. Deterministic table privileges.
-- New Supabase projects don't auto-grant new tables to any Data API role -
-- including service_role, which the Edge Functions use. subscriptions was
-- only granted to authenticated, so billing, billing-webhook and
-- delete-account would get "permission denied" on hosted Supabase. And on a
-- project that DOES still auto-grant, authenticated would hold table-wide
-- INSERT/UPDATE that silently overrides the column-level grants below.
-- So: revoke everything from the client roles, then grant exactly what each
-- table needs. (Revoking a table privilege also revokes its column
-- privileges, so every column grant is restated here.)
-- ---------------------------------------------------------------------------
revoke all on
  public.skills, public.profiles, public.profile_skills, public.admins, public.subscriptions,
  public.projects, public.project_admission, public.project_required_skills, public.applications,
  public.application_status_history, public.project_memberships, public.project_outcomes,
  public.portfolio_images, public.listing_images, public.application_attachments
from anon, authenticated;

grant select on public.skills to authenticated;
grant insert (name) on public.skills to authenticated;

grant select on public.profiles to authenticated;
grant insert (
  id, full_name, headline, bio, location, remote_pref, availability, current_title,
  experience_level, seeking_paid, seeking_partner, wants_to_hire, portfolio_url, avatar_url
) on public.profiles to authenticated;
grant update (
  full_name, headline, bio, location, remote_pref, availability, current_title,
  experience_level, seeking_paid, seeking_partner, wants_to_hire, portfolio_url, avatar_url
) on public.profiles to authenticated;

grant select, insert, delete on public.profile_skills to authenticated;
grant select on public.admins to authenticated;
grant select on public.subscriptions to authenticated;

grant select, delete on public.projects to authenticated;
grant insert (
  title, public_summary, opportunity_type, location, remote_pref, commitment, duration,
  compensation_type, compensation_min, compensation_max, currency
) on public.projects to authenticated;
grant update (
  title, public_summary, opportunity_type, location, remote_pref, commitment, duration,
  compensation_type, compensation_min, compensation_max, currency
) on public.projects to authenticated;

grant select, insert, update, delete on public.project_admission to authenticated;
grant select, insert, delete on public.project_required_skills to authenticated;

grant select on public.applications to authenticated;
grant insert (project_id, cover_note) on public.applications to authenticated;

grant select on public.application_status_history to authenticated;
grant select on public.project_memberships to authenticated;
grant select on public.project_outcomes to authenticated;

grant select, delete on public.portfolio_images to authenticated;
grant insert (storage_path, caption, position) on public.portfolio_images to authenticated;
grant update (caption, position) on public.portfolio_images to authenticated;

grant select, delete on public.listing_images to authenticated;
grant insert (project_id, storage_path, position) on public.listing_images to authenticated;

grant select, delete on public.application_attachments to authenticated;
grant insert (application_id, storage_path) on public.application_attachments to authenticated;

-- What the Edge Functions read directly with the service client.
grant select on public.subscriptions to service_role;

-- ---------------------------------------------------------------------------
-- I1. A listing that was ever published can't be deleted. It could be moved
-- back to draft and then deleted, cascading away other people's
-- applications, memberships and confirmed outcomes (their track records)
-- and laundering the owner's reply record. Applications only ever exist on
-- listings that have been published, and published_at is never cleared.
-- ---------------------------------------------------------------------------
drop policy "Owners can delete drafts" on public.projects;
create policy "Owners can delete drafts that were never published"
  on public.projects for delete
  to authenticated
  using (owner_id = (select auth.uid()) and status = 'draft' and published_at is null);

-- ---------------------------------------------------------------------------
-- I3. The no-contact-details rule on every other field people read before
-- mutual acceptance - including skills, which are shared with everyone
-- through autocomplete.
-- ---------------------------------------------------------------------------
alter table public.skills
  add constraint skills_name_no_contact check (not private.has_contact_details(name)) not valid;

alter table public.profiles
  add constraint profiles_details_no_contact check (
    not private.has_contact_details(
      concat_ws(' ', full_name, location, current_title, availability, experience_level)
    )
  ) not valid;

alter table public.projects
  add constraint projects_details_no_contact check (
    not private.has_contact_details(concat_ws(' ', location, duration))
  ) not valid;

alter table public.applications
  add constraint applications_decision_note_no_contact check (
    not private.has_contact_details(decision_note)
  ) not valid;

-- ---------------------------------------------------------------------------
-- I4. The outcome ledger can't be farmed with throwaway accounts:
--   * "completed" needs at least 7 days of actually working together;
--   * the track record counts distinct people, not collaborations, so the
--     same puppet account adds at most one.
-- ---------------------------------------------------------------------------
create function private.check_outcome_age()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_joined timestamptz;
begin
  if new.outcome = 'completed' then
    select joined_at into v_joined from public.project_memberships where id = new.membership_id;
    if v_joined > now() - interval '7 days' then
      raise exception 'A collaboration can be marked completed after a week of working together. You can mark it ended early at any time.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.check_outcome_age() from public;

create trigger project_outcomes_check_age
  before insert or update of outcome on public.project_outcomes
  for each row execute function private.check_outcome_age();

create or replace function public.get_track_record(p_user uuid)
returns table (completed integer, total integer)
language sql
stable
security definer
set search_path = ''
as $$
  with confirmed as (
    select
      o.outcome,
      -- The other person in the collaboration, from p_user's point of view.
      case when m.user_id = p_user then p.owner_id else m.user_id end as counterparty
    from public.project_outcomes o
    join public.project_memberships m on m.id = o.membership_id
    join public.projects p on p.id = m.project_id
    where (m.user_id = p_user or p.owner_id = p_user)
      and o.confirmed_by_owner_at is not null
      and o.confirmed_by_member_at is not null
  )
  select
    (count(distinct counterparty) filter (where outcome = 'completed'))::integer,
    (count(distinct counterparty))::integer
  from confirmed;
$$;

-- ---------------------------------------------------------------------------
-- Minor fixes.
-- ---------------------------------------------------------------------------

-- Auto-rejections from closing a listing are flagged by a column, not
-- recognised by the text of decision_note (which an owner could also type).
alter table public.applications add column closed_by_listing boolean not null default false;
update public.applications set closed_by_listing = true where decision_note = 'Listing closed';

create or replace function private.set_listing_status(p_actor uuid, p_project uuid, p_to text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from text;
begin
  select status into v_from from public.projects
    where id = p_project and owner_id = p_actor
    for update;
  if not found then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  if not (
    (v_from = 'in_review' and p_to = 'draft')
    or (v_from = 'published' and p_to in ('paused', 'draft', 'completed', 'abandoned'))
    or (v_from = 'paused' and p_to in ('published', 'draft', 'completed', 'abandoned'))
  ) then
    raise exception 'Cannot move a % listing to %', v_from, p_to using errcode = 'P0001';
  end if;
  update public.projects
    set status = p_to,
        -- Resuming re-checks the plan, so featured placement can't outlive Pro.
        is_featured = case when p_to = 'published' then private.has_pro(owner_id) else is_featured end
    where id = p_project;
  -- Closing a listing turns away anyone still waiting, rather than leaving
  -- them in limbo.
  if p_to in ('completed', 'abandoned') then
    with closed as (
      update public.applications
        set status = 'rejected', decided_at = now(), decision_note = 'Listing closed',
            closed_by_listing = true
        where project_id = p_project and status = 'submitted'
        returning id
    )
    insert into public.application_status_history (application_id, from_status, to_status, changed_by)
      select id, 'submitted', 'rejected', p_actor from closed;
  end if;
end;
$$;

revoke execute on function private.set_listing_status(uuid, uuid, text) from public;
grant execute on function private.set_listing_status(uuid, uuid, text) to service_role;

create or replace function public.get_owner_reply_record(p_owner uuid)
returns table (received integer, replied integer, median_hours integer)
language sql
stable
security definer
set search_path = ''
as $$
  with counted as (
    select a.status, a.created_at, a.decided_at, a.closed_by_listing
    from public.applications a
    join public.projects p on p.id = a.project_id
    where p.owner_id = p_owner
      and a.created_at > now() - interval '180 days'
      and a.status <> 'withdrawn'
      and not (a.status = 'submitted' and a.created_at > now() - interval '7 days')
  ),
  replies as (
    select * from counted
    where status in ('accepted', 'rejected') and not closed_by_listing
  )
  select
    (select count(*)::integer from counted),
    (select count(*)::integer from replies),
    (select round(percentile_cont(0.5) within group (
       order by extract(epoch from (decided_at - created_at)) / 3600
     ))::integer from replies);
$$;

-- The 25-listing cap was lifetime (closed listings can't be deleted), which
-- would eventually lock out long-standing owners. Cap open drafts instead.
create or replace function private.limit_draft_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.projects
    where owner_id = new.owner_id and status in ('draft', 'changes_requested')
  ) >= 25 then
    raise exception 'You have 25 unfinished drafts - finish or delete some first' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function private.limit_draft_count() from public;

-- Indexable prefix match (real storage.objects has a (bucket_id, name) index)
-- instead of computing foldername() for every object in the bucket.
create or replace function private.storage_object_count(p_bucket text, p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from storage.objects
  where bucket_id = p_bucket and name like p_user::text || '/%';
$$;

-- Evaluate the admin check once per query (InitPlan), not once per row.
drop policy "Published listings are readable; owners, applicants and admins see their own" on public.projects;
create policy "Published listings are readable; owners, applicants and admins see their own"
  on public.projects for select
  to authenticated
  using (
    status = 'published'
    or owner_id = (select auth.uid())
    or private.has_applied(id, (select auth.uid()))
    or (select private.is_admin((select auth.uid())))
  );

-- Flagged by the Supabase linter (function_search_path_mutable).
alter function public.set_updated_at() set search_path = '';
