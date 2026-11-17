-- Launch hardening (wave 2 backlog, DEV-DB). Not yet applied anywhere.
-- Standing rules (docs/ACCESS_CONTROL.md): revoke then grant on every new
-- table, function and sequence - the hosted project auto-grants new public
-- objects to anon and authenticated.

-- ---------------------------------------------------------------------------
-- 1. Blocks (red team F7/F8). A block now also:
--   * makes decide_application answer "not found" (either direction), so a
--     blocked owner can't accept the blocker and read their email;
--   * hides contact details on an already-accepted application;
--   * withdraws pending applications between the two people.
-- ---------------------------------------------------------------------------
create or replace function private.decide_application(p_actor uuid, p_application uuid, p_accept boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.applications%rowtype;
  v_to text := case when p_accept then 'accepted' else 'rejected' end;
begin
  select * into v_app from public.applications where id = p_application for update;
  if not found
    or not private.owns_project(v_app.project_id, p_actor)
    or private.blocked_between(p_actor, v_app.applicant_id) then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if v_app.status <> 'submitted' then
    raise exception 'This application has already been decided' using errcode = 'P0001';
  end if;
  update public.applications
    set status = v_to, decided_at = now(), decision_note = left(nullif(btrim(p_note), ''), 500)
    where id = p_application;
  insert into public.application_status_history (application_id, from_status, to_status, changed_by)
    values (p_application, 'submitted', v_to, p_actor);
  -- No agreement step yet (slice 9 waits on real legal text), so acceptance
  -- creates the membership directly - see docs/DATA_MODEL.md.
  if p_accept then
    insert into public.project_memberships (project_id, user_id, application_id, role)
      values (
        v_app.project_id,
        v_app.applicant_id,
        v_app.id,
        case when v_app.application_type = 'partner' then 'partner' else 'contractor' end
      );
  end if;
end;
$$;

create or replace function public.get_application_contact(p_application uuid)
returns table (full_name text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_app public.applications%rowtype;
  v_owner uuid;
  v_other uuid;
begin
  select * into v_app from public.applications where id = p_application;
  if not found or v_app.status <> 'accepted' then
    return;
  end if;
  select owner_id into v_owner from public.projects where id = v_app.project_id;
  if v_uid = v_app.applicant_id then
    v_other := v_owner;
  elsif v_uid = v_owner then
    v_other := v_app.applicant_id;
  else
    return;
  end if;
  if private.blocked_between(v_app.applicant_id, v_owner) then
    return;
  end if;
  return query
    select p.full_name, u.email::text
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = v_other;
end;
$$;

-- The blocker's own applications are withdrawn by them; the blocked
-- person's applications to the blocker's listings are withdrawn by the
-- system (changed_by null).
create function private.withdraw_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  with withdrawn as (
    update public.applications a
      set status = 'withdrawn'
      from public.projects p
      where p.id = a.project_id
        and a.status = 'submitted'
        and (
          (a.applicant_id = new.blocker_id and p.owner_id = new.blocked_id)
          or (a.applicant_id = new.blocked_id and p.owner_id = new.blocker_id)
        )
      returning a.id, a.applicant_id
  )
  insert into public.application_status_history (application_id, from_status, to_status, changed_by)
    select id, 'submitted', 'withdrawn', case when applicant_id = new.blocker_id then new.blocker_id end
    from withdrawn;
  return null;
end;
$$;

revoke execute on function private.withdraw_on_block() from public, anon, authenticated;

create trigger blocks_withdraw_pending
  after insert on public.blocks
  for each row execute function private.withdraw_on_block();

-- ---------------------------------------------------------------------------
-- 2. One application per listing per person. Re-applying is allowed after
-- a withdrawal, or after the listing closing turned you away
-- (closed_by_listing) - never after the owner rejected you. Applications are
-- serialised per applicant so the daily cap can't be overshot in parallel.
-- ---------------------------------------------------------------------------
create or replace function private.prepare_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
begin
  select * into v_project from public.projects where id = new.project_id;
  if not found or v_project.status <> 'published' then
    raise exception 'This listing is not accepting applications' using errcode = 'P0001';
  end if;
  if v_project.owner_id = new.applicant_id then
    raise exception 'You cannot apply to your own listing' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('apply:' || new.applicant_id::text, 0));
  if exists (
    select 1 from public.applications
    where project_id = new.project_id and applicant_id = new.applicant_id
      and status in ('submitted', 'accepted')
  ) then
    raise exception 'You''ve already applied to this listing' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.applications
    where project_id = new.project_id and applicant_id = new.applicant_id
      and status = 'rejected' and not closed_by_listing
  ) then
    raise exception 'You can''t apply to this listing again' using errcode = 'P0001';
  end if;
  -- Rate limit: protects owners from spray-and-pray applicants and the
  -- database from scripted abuse via the REST API.
  if (
    select count(*) from public.applications
    where applicant_id = new.applicant_id and created_at > now() - interval '24 hours'
  ) >= 20 then
    raise exception 'Daily application limit reached - try again tomorrow' using errcode = 'P0001';
  end if;
  new.application_type := v_project.opportunity_type;
  new.status := 'submitted';
  new.decision_note := null;
  new.decided_at := null;
  new.closed_by_listing := false;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Live-listing limit: serialised per owner (parallel submits each saw
-- the other still in draft - red team F4), and re-checked when resuming a
-- paused listing (a downgraded owner could pause and resume past the limit).
-- ---------------------------------------------------------------------------
create or replace function private.submit_listing(p_actor uuid, p_project uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('live_listings:' || p_actor::text, 0));
  select * into v_project from public.projects where id = p_project for update;
  if not found or v_project.owner_id <> p_actor then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  if v_project.status not in ('draft', 'changes_requested') then
    raise exception 'Only drafts can be submitted for review' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.project_required_skills where project_id = p_project) then
    raise exception 'Add at least one required skill before submitting' using errcode = 'P0001';
  end if;
  if v_project.opportunity_type = 'partner'
     and not exists (select 1 from public.project_admission where project_id = p_project) then
    raise exception 'Partner listings need admission criteria before review' using errcode = 'P0001';
  end if;
  if v_project.opportunity_type = 'paid' and v_project.compensation_type is null then
    raise exception 'Paid listings need a pay type before review' using errcode = 'P0001';
  end if;
  if (
    select count(*) from public.projects
    where owner_id = p_actor and status in ('in_review', 'published', 'paused')
  ) >= private.live_listing_limit(p_actor) then
    raise exception 'LISTING_LIMIT: Your plan''s live listing limit is reached' using errcode = 'P0001';
  end if;
  update public.projects
    set status = 'in_review', review_note = null
    where id = p_project;
end;
$$;

create or replace function private.set_listing_status(p_actor uuid, p_project uuid, p_to text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from text;
begin
  perform pg_advisory_xact_lock(hashtextextended('live_listings:' || p_actor::text, 0));
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
  -- Paused listings count towards the limit, so resuming one is allowed
  -- only while the owner is within it (this one included).
  if v_from = 'paused' and p_to = 'published' and (
    select count(*) from public.projects
    where owner_id = p_actor and status in ('in_review', 'published', 'paused')
  ) > private.live_listing_limit(p_actor) then
    raise exception 'LISTING_LIMIT: Your plan''s live listing limit is reached' using errcode = 'P0001';
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

-- ---------------------------------------------------------------------------
-- 4. Activity flood (F-05 / F12). Re-proposing the outcome you already
-- confirmed changes nothing; activity is written only when the outcome or a
-- side's confirmation actually changes; and there is never more than one
-- unread row per (user, kind, collaboration) - a repeat refreshes it.
-- ---------------------------------------------------------------------------
create or replace function private.record_outcome(p_actor uuid, p_membership uuid, p_outcome text, p_summary text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.project_memberships%rowtype;
  v_is_owner boolean;
  v_existing public.project_outcomes%rowtype;
begin
  if p_outcome not in ('completed', 'abandoned') then
    raise exception 'Unknown outcome' using errcode = '22023';
  end if;
  select * into v_membership from public.project_memberships where id = p_membership for update;
  if not found then
    raise exception 'Collaboration not found' using errcode = 'P0002';
  end if;
  v_is_owner := private.owns_project(v_membership.project_id, p_actor);
  if not v_is_owner and v_membership.user_id <> p_actor then
    raise exception 'Collaboration not found' using errcode = 'P0002';
  end if;

  select * into v_existing from public.project_outcomes where membership_id = p_membership;
  if found and v_existing.confirmed_by_owner_at is not null and v_existing.confirmed_by_member_at is not null then
    raise exception 'This outcome is already confirmed by both sides' using errcode = 'P0001';
  end if;

  if found and v_existing.outcome = p_outcome then
    -- Already on file from this side: nothing to change, nobody to tell.
    if (v_is_owner and v_existing.confirmed_by_owner_at is not null)
      or (not v_is_owner and v_existing.confirmed_by_member_at is not null) then
      return;
    end if;
    update public.project_outcomes
      set confirmed_by_owner_at = case when v_is_owner then now() else confirmed_by_owner_at end,
          confirmed_by_member_at = case when v_is_owner then confirmed_by_member_at else now() end,
          summary = coalesce(left(nullif(btrim(p_summary), ''), 500), summary)
      where membership_id = p_membership;
  else
    insert into public.project_outcomes (
      membership_id, outcome, summary, confirmed_by_owner_at, confirmed_by_member_at
    ) values (
      p_membership,
      p_outcome,
      left(nullif(btrim(p_summary), ''), 500),
      case when v_is_owner then now() end,
      case when v_is_owner then null else now() end
    )
    on conflict (membership_id) do update
      set outcome = excluded.outcome,
          summary = excluded.summary,
          confirmed_by_owner_at = excluded.confirmed_by_owner_at,
          confirmed_by_member_at = excluded.confirmed_by_member_at;
  end if;

  update public.project_memberships
    set left_at = now()
    where id = p_membership
      and exists (
        select 1 from public.project_outcomes
        where membership_id = p_membership
          and confirmed_by_owner_at is not null
          and confirmed_by_member_at is not null
      );
end;
$$;

create or replace function private.activity_from_outcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid;
  v_owner uuid;
  v_project uuid;
  v_application uuid;
begin
  if tg_op = 'UPDATE'
    and new.outcome is not distinct from old.outcome
    and (new.confirmed_by_owner_at is null) = (old.confirmed_by_owner_at is null)
    and (new.confirmed_by_member_at is null) = (old.confirmed_by_member_at is null) then
    return null;
  end if;

  select m.user_id, p.owner_id, p.id, m.application_id into v_member, v_owner, v_project, v_application
  from public.project_memberships m join public.projects p on p.id = m.project_id
  where m.id = new.membership_id;

  if new.confirmed_by_owner_at is not null and new.confirmed_by_member_at is not null then
    if tg_op = 'UPDATE' and old.confirmed_by_owner_at is not null and old.confirmed_by_member_at is not null then
      return null;
    end if;
    if new.outcome = 'completed' then
      perform private.notify(v_member, 'outcome_confirmed', v_owner, v_project, v_application, new.membership_id);
      perform private.notify(v_owner, 'outcome_confirmed', v_member, v_project, v_application, new.membership_id);
    end if;
  elsif new.confirmed_by_owner_at is not null then
    perform private.notify(v_member, 'outcome_to_confirm', v_owner, v_project, v_application, new.membership_id);
  elsif new.confirmed_by_member_at is not null then
    perform private.notify(v_owner, 'outcome_to_confirm', v_member, v_project, v_application, new.membership_id);
  end if;
  return null;
end;
$$;

-- Collapse existing duplicates (keep the newest unread) before the index.
update public.activity a
  set read_at = now()
  where a.read_at is null
    and a.membership_id is not null
    and exists (
      select 1 from public.activity b
      where b.user_id = a.user_id and b.kind = a.kind and b.membership_id = a.membership_id
        and b.read_at is null
        and (b.created_at, b.id) > (a.created_at, a.id)
    );

create unique index activity_one_unread_per_membership
  on public.activity (user_id, kind, membership_id)
  where read_at is null and membership_id is not null;

create or replace function private.notify(
  p_user uuid, p_kind text, p_actor uuid,
  p_project uuid default null, p_application uuid default null, p_membership uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity (user_id, kind, actor_id, project_id, application_id, membership_id)
  select p_user, p_kind, p_actor, p_project, p_application, p_membership
  where p_user is not null and p_user is distinct from p_actor
  on conflict (user_id, kind, membership_id) where read_at is null and membership_id is not null
  do update set created_at = now(), actor_id = excluded.actor_id;
$$;

-- ---------------------------------------------------------------------------
-- 5. RPC input caps count every element (cardinality), so a 2-D array can't
-- slip past a check on its first dimension (F-06).
-- ---------------------------------------------------------------------------
create or replace function public.count_professionals_for(p_skills text[], p_type text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_type not in ('paid', 'partner') then
    raise exception 'Unknown opportunity type' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_skills), 0) = 0 then
    return 0;
  end if;
  if cardinality(p_skills) > 15 then
    raise exception 'Too many skills at once' using errcode = 'P0001';
  end if;
  return (
    select count(distinct p.id)::integer
    from public.profiles p
    join public.profile_skills ps on ps.profile_id = p.id
    join public.skills s on s.id = ps.skill_id
    where lower(s.name) in (select lower(btrim(n)) from unnest(p_skills) as n)
      and p.id <> (select auth.uid())
      and p.availability_confirmed_at > now() - interval '30 days'
      and case when p_type = 'paid' then p.seeking_paid else p.seeking_partner end
  );
end;
$$;

create or replace function public.ensure_skills(p_names text[])
returns table (id uuid, name text)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  if coalesce(cardinality(p_names), 0) > 20 then
    raise exception 'Too many skills at once' using errcode = 'P0001';
  end if;
  insert into public.skills (name)
    select distinct on (lower(btrim(n))) btrim(n)
    from unnest(p_names) as n
    where btrim(n) <> ''
  on conflict ((lower(name))) do nothing;
  return query
    select s.id, s.name
    from public.skills s
    where lower(s.name) in (select lower(btrim(n)) from unnest(p_names) as n);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Blank or invisible questions, answers and references (F13). btrim()
-- only strips ASCII spaces; these count what's actually visible.
-- ---------------------------------------------------------------------------
create function private.trim_text(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(
    p_text,
    '^[[:space:]  ᠎ -‏    ⁠　﻿]+|[[:space:]  ᠎ -‏    ⁠　﻿]+$',
    '',
    'g'
  );
$$;

create function private.visible_length(p_text text)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(char_length(regexp_replace(
    p_text,
    '[[:space:] ­͏ ᠎ -‏ -  -⁯　ㅤ﻿]',
    '',
    'g'
  )), 0);
$$;

revoke execute on function private.trim_text(text) from public;
revoke execute on function private.visible_length(text) from public;

create or replace function private.ask_question(p_actor uuid, p_application uuid, p_question text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.applications%rowtype;
begin
  select * into v_app from public.applications where id = p_application for update;
  if not found or not private.owns_project(v_app.project_id, p_actor) then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if v_app.status <> 'submitted' then
    raise exception 'Questions can only be asked while an application is pending' using errcode = 'P0001';
  end if;
  if private.blocked_between(p_actor, v_app.applicant_id) then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if private.visible_length(p_question) < 5 then
    raise exception 'Write a question of at least 5 characters' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.application_questions
    where application_id = p_application and answer is null
  ) then
    raise exception 'Wait for an answer before asking another question' using errcode = 'P0001';
  end if;
  if (select count(*) from public.application_questions where application_id = p_application) >= 3 then
    raise exception 'You can ask up to 3 questions per application' using errcode = 'P0001';
  end if;
  insert into public.application_questions (application_id, question)
    values (p_application, private.trim_text(p_question));
end;
$$;

create or replace function private.answer_question(p_actor uuid, p_question uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question public.application_questions%rowtype;
  v_app public.applications%rowtype;
begin
  select * into v_question from public.application_questions where id = p_question for update;
  if found then
    select * into v_app from public.applications where id = v_question.application_id;
  end if;
  if not found or v_app.applicant_id <> p_actor then
    raise exception 'Question not found' using errcode = 'P0002';
  end if;
  if v_question.answer is not null then
    raise exception 'You''ve already answered this question' using errcode = 'P0001';
  end if;
  if v_app.status <> 'submitted' then
    raise exception 'This application has already been decided' using errcode = 'P0001';
  end if;
  if private.visible_length(p_answer) < 1 then
    raise exception 'Write an answer first' using errcode = '22023';
  end if;
  update public.application_questions
    set answer = private.trim_text(p_answer), answered_at = now()
    where id = p_question;
end;
$$;

create or replace function private.write_reference(p_actor uuid, p_membership uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.project_memberships%rowtype;
  v_owner uuid;
  v_title text;
begin
  select * into v_membership from public.project_memberships where id = p_membership;
  if found then
    select owner_id, title into v_owner, v_title from public.projects where id = v_membership.project_id;
  end if;
  if not found or p_actor not in (v_owner, v_membership.user_id) then
    raise exception 'Collaboration not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.project_outcomes
    where membership_id = p_membership
      and outcome = 'completed'
      and confirmed_by_owner_at is not null
      and confirmed_by_member_at is not null
  ) then
    raise exception 'References can be written once you''ve both confirmed the work was completed'
      using errcode = 'P0001';
  end if;
  if private.visible_length(p_body) < 20 then
    raise exception 'A reference needs at least 20 characters' using errcode = '22023';
  end if;
  insert into public.work_references (membership_id, author_id, subject_id, project_title, body)
    values (
      p_membership,
      p_actor,
      case when p_actor = v_owner then v_membership.user_id else v_owner end,
      v_title,
      private.trim_text(p_body)
    );
exception
  when unique_violation then
    raise exception 'You''ve already written a reference for this collaboration' using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. skills.created_by is moderation data, not something other users need
-- (legal review gap B): column-level SELECT without it.
-- ---------------------------------------------------------------------------
revoke select on public.skills from authenticated;
grant select (id, name, created_at) on public.skills to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Storage.
-- ---------------------------------------------------------------------------
-- 2 MB per file (the client compresses adaptively to fit).
update storage.buckets
  set file_size_limit = 2097152
  where id in ('avatars', 'portfolio', 'listing-images', 'application-attachments');

drop policy "Per-user file caps" on storage.objects;
create policy "Per-user file caps"
  on storage.objects as restrictive for insert
  to authenticated
  with check (
    private.storage_object_count(bucket_id, (select auth.uid())) < case bucket_id
      when 'avatars' then 3
      when 'portfolio' then 8
      when 'listing-images' then 40
      when 'application-attachments' then 15
      else 0
    end
  );

-- An attachment upload needs a pending application of the uploader's that
-- still has room (fewer than 3 attachment rows), not just any pending one
-- (red team F5: one application unlocked a 60-file private locker).
create function private.can_upload_attachment(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.applications a
    where a.applicant_id = p_user
      and a.status = 'submitted'
      and (select count(*) from public.application_attachments aa where aa.application_id = a.id) < 3
  );
$$;

revoke execute on function private.can_upload_attachment(uuid) from public;
grant execute on function private.can_upload_attachment(uuid) to authenticated, service_role;

drop policy "Attachment uploads need a pending application" on storage.objects;
create policy "Attachment uploads need a pending application"
  on storage.objects as restrictive for insert
  to authenticated
  with check (
    bucket_id <> 'application-attachments'
    or private.can_upload_attachment((select auth.uid()))
  );

-- Cleanup queue. Rows are added when a file stops being referenced (image
-- rows deleted - including by cascade on account deletion or retention - or
-- an avatar replaced/removed). The maintenance Edge Function claims a batch,
-- removes the files through the Storage API, then completes them. A claim
-- is a 15-minute lease, so a crashed run's rows come back.
create table private.storage_cleanup (
  id bigserial primary key,
  bucket text not null,
  path text not null,
  queued_at timestamptz not null default now(),
  claimed_at timestamptz,
  unique (bucket, path)
);

revoke all on private.storage_cleanup from public, anon, authenticated;
revoke all on sequence private.storage_cleanup_id_seq from public, anon, authenticated;

create function private.enqueue_storage_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket text;
  v_path text;
begin
  if tg_table_name = 'profiles' then
    v_bucket := 'avatars';
    v_path := old.avatar_url;
    if tg_op = 'UPDATE' and new.avatar_url is not distinct from old.avatar_url then
      return null;
    end if;
  else
    v_bucket := case tg_table_name
      when 'application_attachments' then 'application-attachments'
      when 'listing_images' then 'listing-images'
      when 'portfolio_images' then 'portfolio'
    end;
    v_path := old.storage_path;
  end if;
  if v_bucket is not null and v_path is not null then
    insert into private.storage_cleanup (bucket, path) values (v_bucket, v_path)
      on conflict (bucket, path) do nothing;
  end if;
  return null;
end;
$$;

revoke execute on function private.enqueue_storage_cleanup() from public, anon, authenticated;

create trigger application_attachments_cleanup
  after delete on public.application_attachments
  for each row execute function private.enqueue_storage_cleanup();
create trigger listing_images_cleanup
  after delete on public.listing_images
  for each row execute function private.enqueue_storage_cleanup();
create trigger portfolio_images_cleanup
  after delete on public.portfolio_images
  for each row execute function private.enqueue_storage_cleanup();
create trigger profiles_avatar_cleanup
  after update of avatar_url or delete on public.profiles
  for each row execute function private.enqueue_storage_cleanup();

create function private.claim_storage_cleanup(p_limit integer)
returns table (id bigint, bucket text, path text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  -- A path that's referenced again (e.g. an avatar switched back) isn't
  -- orphaned: drop it from the queue rather than delete a live file.
  delete from private.storage_cleanup q
  where (q.bucket = 'avatars' and exists (select 1 from public.profiles p where p.avatar_url = q.path))
    or (q.bucket = 'portfolio' and exists (select 1 from public.portfolio_images i where i.storage_path = q.path))
    or (q.bucket = 'listing-images' and exists (select 1 from public.listing_images i where i.storage_path = q.path))
    or (q.bucket = 'application-attachments'
        and exists (select 1 from public.application_attachments i where i.storage_path = q.path));
  return query
    with picked as (
      select q.id from private.storage_cleanup q
      where (q.claimed_at is null or q.claimed_at < now() - interval '15 minutes')
        -- Grace period: a path queued moments ago may be mid re-upload.
        and q.queued_at < now() - interval '10 minutes'
        -- Legal hold (OSA/CSEA preservation): keep a held user's files.
        and not exists (
          select 1 from private.legal_holds h where h.user_id::text = split_part(q.path, '/', 1)
        )
      order by q.id
      limit least(greatest(coalesce(p_limit, 100), 1), 1000)
      for update skip locked
    )
    update private.storage_cleanup q
      set claimed_at = now()
      from picked
      where q.id = picked.id
      returning q.id, q.bucket, q.path;
end;
$$;

create function private.complete_storage_cleanup(p_ids bigint[])
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.storage_cleanup where id = any (p_ids);
$$;

-- Retention (docs/OPEN_DECISIONS.md, decided 2026-11-06):
--   activity: read 180 days, any 365 days;
--   rejected/withdrawn applications: 12 months after their last change
--     (history, questions and attachment rows cascade; the attachment files
--     are queued above);
--   resolved reports: actioned 3 years, dismissed 12 months.
-- Never touched: pending or accepted applications, memberships, outcomes,
-- references. p_now exists for tests.
create function private.apply_retention(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity integer;
  v_applications integer;
  v_reports integer;
begin
  -- Nothing touching a user under a legal hold is deleted (OSA/CSEA
  -- preservation): their activity, applications on either side, and
  -- reports they filed or that are about them or their listings.
  delete from public.activity x
    where (x.read_at < p_now - interval '180 days' or x.created_at < p_now - interval '365 days')
      and not exists (select 1 from private.legal_holds h where h.user_id = x.user_id);
  get diagnostics v_activity = row_count;

  delete from public.applications a
    where a.status in ('rejected', 'withdrawn') and a.updated_at < p_now - interval '12 months'
      and not exists (
        select 1 from private.legal_holds h
        where h.user_id = a.applicant_id
           or h.user_id = (select p.owner_id from public.projects p where p.id = a.project_id)
      );
  get diagnostics v_applications = row_count;

  delete from public.reports r
    where ((r.status = 'actioned' and r.resolved_at < p_now - interval '3 years')
        or (r.status = 'dismissed' and r.resolved_at < p_now - interval '12 months'))
      and not exists (
        select 1 from private.legal_holds h
        where h.user_id in (
          r.reporter_id, r.profile_id,
          (select p.owner_id from public.projects p where p.id = r.project_id)
        )
      );
  get diagnostics v_reports = row_count;

  return jsonb_build_object(
    'activity', v_activity, 'applications', v_applications, 'reports', v_reports
  );
end;
$$;

revoke execute on function private.can_upload_attachment(uuid) from public;
revoke execute on function private.claim_storage_cleanup(integer) from public, anon, authenticated;
revoke execute on function private.complete_storage_cleanup(bigint[]) from public, anon, authenticated;
revoke execute on function private.apply_retention(timestamptz) from public, anon, authenticated;
grant execute on function private.claim_storage_cleanup(integer) to service_role;
grant execute on function private.complete_storage_cleanup(bigint[]) to service_role;
grant execute on function private.apply_retention(timestamptz) to service_role;

create function public.svc_claim_storage_cleanup(p_limit integer)
returns table (id bigint, bucket text, path text)
language sql security invoker set search_path = ''
as $$ select * from private.claim_storage_cleanup(p_limit); $$;

create function public.svc_complete_storage_cleanup(p_ids bigint[])
returns void language sql security invoker set search_path = ''
as $$ select private.complete_storage_cleanup(p_ids); $$;

create function public.svc_apply_retention()
returns jsonb language sql security invoker set search_path = ''
as $$ select private.apply_retention(); $$;

revoke execute on function public.svc_claim_storage_cleanup(integer) from public, anon, authenticated;
revoke execute on function public.svc_complete_storage_cleanup(bigint[]) from public, anon, authenticated;
revoke execute on function public.svc_apply_retention() from public, anon, authenticated;
grant execute on function public.svc_claim_storage_cleanup(integer) to service_role;
grant execute on function public.svc_complete_storage_cleanup(bigint[]) to service_role;
grant execute on function public.svc_apply_retention() to service_role;

-- The daily pg_cron schedule lives in its own migration
-- (20261105130000_schedule_retention.sql) so a refused cron call can't roll
-- back everything above.

-- ---------------------------------------------------------------------------
-- 9. Legal: terms/privacy/18+ acceptance, data export, legal holds.
-- ---------------------------------------------------------------------------
create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document text not null check (document in ('terms', 'privacy', 'age_18')),
  version text not null check (version ~ '^[A-Za-z0-9._+-]{1,32}$'),
  accepted_at timestamptz not null default now(),
  unique (user_id, document, version)
);

alter table public.legal_acceptances enable row level security;

create policy "Users see their own legal acceptances"
  on public.legal_acceptances for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.legal_acceptances from anon, authenticated;
grant select on public.legal_acceptances to authenticated;

-- Shared by the sign-up trigger and record_legal_acceptance. Invalid
-- versions are skipped (the CHECK would otherwise abort the insert).
create function private.store_legal_acceptance(
  p_user uuid, p_terms text, p_privacy text, p_age boolean
)
returns void
language sql
security definer
set search_path = ''
as $$
  -- Document versions are dated (YYYY-MM-DD, optional suffix such as
  -- "+billing") and can't be in the future: otherwise accepting a made-up
  -- "9999-..." version would satisfy every later re-acceptance check.
  -- One day of slack covers time zones. The age confirmation is '18+'.
  insert into public.legal_acceptances (user_id, document, version)
  select p_user, d.document, d.version
  from (values ('terms', p_terms), ('privacy', p_privacy), ('age_18', case when p_age then '18+' end))
    as d (document, version)
  where (d.document = 'age_18' and d.version = '18+')
     or (d.document <> 'age_18'
         and d.version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}([+._A-Za-z0-9-]{0,21})$'
         and left(d.version, 10) <= to_char((now() at time zone 'utc') + interval '1 day', 'YYYY-MM-DD'))
  on conflict (user_id, document, version) do nothing;
$$;

-- Sign-up passes options.data = { terms_version, privacy_version,
-- age_confirmed: true }. AFTER INSERT only: metadata is client-writable
-- later (auth.updateUser), so it is never re-read as the record. Never
-- raises - a failing trigger here would break sign-up for everyone.
create function private.record_signup_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb;
begin
  begin
    v_meta := coalesce(to_jsonb(new) -> 'raw_user_meta_data', '{}'::jsonb);
    if jsonb_typeof(v_meta) = 'object' then
      perform private.store_legal_acceptance(
        new.id,
        v_meta ->> 'terms_version',
        v_meta ->> 'privacy_version',
        coalesce(v_meta -> 'age_confirmed' = 'true'::jsonb, false)
      );
    end if;
  exception when others then
    raise warning 'record_signup_acceptance failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke execute on function private.store_legal_acceptance(uuid, text, text, boolean) from public, anon, authenticated;
revoke execute on function private.record_signup_acceptance() from public, anon, authenticated;

create trigger on_auth_user_created_record_acceptance
  after insert on auth.users
  for each row execute function private.record_signup_acceptance();

-- Re-acceptance after a version change (and acceptance for anyone who
-- signed up without it). Always for the caller; idempotent.
create function public.record_legal_acceptance(p_terms_version text, p_privacy_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if coalesce(p_terms_version, '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}([+._A-Za-z0-9-]{0,21})$'
    or coalesce(p_privacy_version, '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}([+._A-Za-z0-9-]{0,21})$'
    or left(p_terms_version, 10) > to_char((now() at time zone 'utc') + interval '1 day', 'YYYY-MM-DD')
    or left(p_privacy_version, 10) > to_char((now() at time zone 'utc') + interval '1 day', 'YYYY-MM-DD') then
    raise exception 'Unknown document version' using errcode = '22023';
  end if;
  perform private.store_legal_acceptance(v_uid, p_terms_version, p_privacy_version, true);
end;
$$;

revoke execute on function public.record_legal_acceptance(text, text) from public, anon;
grant execute on function public.record_legal_acceptance(text, text) to authenticated;

create function public.get_my_legal_status()
returns table (terms_version text, privacy_version text)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select version from public.legal_acceptances
      where user_id = (select auth.uid()) and document = 'terms'
      order by accepted_at desc, version desc limit 1),
    (select version from public.legal_acceptances
      where user_id = (select auth.uid()) and document = 'privacy'
      order by accepted_at desc, version desc limit 1);
$$;

revoke execute on function public.get_my_legal_status() from public, anon;
grant execute on function public.get_my_legal_status() to authenticated;

-- UK GDPR access/portability: the caller's own data, nobody else's.
-- SECURITY INVOKER, so RLS and column grants apply on top of the explicit
-- own-rows filters. Not included: the account email (the app has it from
-- the session), other people's applications to your listings (theirs),
-- reports about you and blocks against you (would reveal the reporter /
-- blocker), billing ids (Stripe holds the billing records).
create function public.export_my_data()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'schema_version', 1,
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
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- Online Safety Act CSEA reporting / preservation: while a hold exists the
-- account can't be deleted. Admins add holds by SQL (docs/LAUNCH.md
-- runbook). ON DELETE RESTRICT is the backstop if anything tries anyway.
create table private.legal_holds (
  user_id uuid primary key references auth.users (id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now()
);

revoke all on private.legal_holds from public, anon, authenticated;

create function private.has_legal_hold(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.legal_holds where user_id = p_user);
$$;

revoke execute on function private.has_legal_hold(uuid) from public, anon, authenticated;
grant execute on function private.has_legal_hold(uuid) to service_role;

create function public.svc_has_legal_hold(p_user uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.has_legal_hold(p_user); $$;

revoke execute on function public.svc_has_legal_hold(uuid) from public, anon, authenticated;
grant execute on function public.svc_has_legal_hold(uuid) to service_role;

-- Catch-all, as in 20261104090000: nothing in private runs for PUBLIC.
revoke execute on all functions in schema private from public;
