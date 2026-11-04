-- Trust and activity (2026-11-04): an activity inbox, verified work
-- references, report/block with a moderation queue, availability freshness,
-- and owner questions on applications.
--
-- Cost notes: no Realtime anywhere. The inbox is written by triggers in the
-- same transaction as the event and read on demand (one indexed query).

-- ---------------------------------------------------------------------------
-- Blocks. Private to the blocker; the blocked person is never told.
-- Effects: neither side can apply to the other's listings or ask/answer
-- questions, and the blocker's Discover hides the other's listings.
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

create policy "Users see their own blocks"
  on public.blocks for select
  to authenticated
  using (blocker_id = (select auth.uid()));

create policy "Users block as themselves"
  on public.blocks for insert
  to authenticated
  with check (blocker_id = (select auth.uid()));

create policy "Users unblock their own blocks"
  on public.blocks for delete
  to authenticated
  using (blocker_id = (select auth.uid()));

grant select, delete on public.blocks to authenticated;
grant insert (blocked_id) on public.blocks to authenticated;

create function private.blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

revoke execute on function private.blocked_between(uuid, uuid) from public;

-- Same message as a closed listing: a block is never revealed.
create function private.check_application_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.blocked_between(
    new.applicant_id,
    (select owner_id from public.projects where id = new.project_id)
  ) then
    raise exception 'This listing is not accepting applications' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function private.check_application_block() from public;

create trigger applications_check_block
  before insert on public.applications
  for each row execute function private.check_application_block();

-- ---------------------------------------------------------------------------
-- Reports and the moderation queue.
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  reason text not null
    check (reason in ('spam', 'scam', 'misleading', 'inappropriate', 'harassment', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reports_one_target check (num_nonnulls(profile_id, project_id) = 1),
  constraint reports_details_length check (char_length(details) <= 500)
);

create index reports_reporter_idx on public.reports (reporter_id, created_at desc);
create index reports_profile_idx on public.reports (profile_id);
create index reports_project_idx on public.reports (project_id);
create index reports_resolved_by_idx on public.reports (resolved_by);
create index reports_open_idx on public.reports (created_at) where status = 'open';
-- One open report per person per target.
create unique index reports_one_open_per_target
  on public.reports (reporter_id, coalesce(profile_id, project_id))
  where status = 'open';

alter table public.reports enable row level security;

create policy "Reporters see their own reports; admins see all"
  on public.reports for select
  to authenticated
  using (
    reporter_id = (select auth.uid())
    or (select private.is_admin((select auth.uid())))
  );

create policy "Users report as themselves"
  on public.reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()));

grant select on public.reports to authenticated;
grant insert (profile_id, project_id, reason, details) on public.reports to authenticated;

create function private.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.profile_id = new.reporter_id
    or new.project_id in (select id from public.projects where owner_id = new.reporter_id) then
    raise exception 'You can''t report yourself' using errcode = 'P0001';
  end if;
  if (
    select count(*) from public.reports
    where reporter_id = new.reporter_id and created_at > now() - interval '24 hours'
  ) >= 10 then
    raise exception 'Too many reports today - try again tomorrow' using errcode = 'P0001';
  end if;
  new.details := nullif(btrim(new.details), '');
  new.status := 'open';
  new.resolved_by := null;
  new.resolved_at := null;
  return new;
end;
$$;

revoke execute on function private.prepare_report() from public;

create trigger reports_prepare
  before insert on public.reports
  for each row execute function private.prepare_report();

-- Admin decision. "action" on a listing takes it down for changes (the owner
-- sees the note and can fix and resubmit); on a profile it is recorded for
-- manual follow-up (suspension is a dashboard action for now).
create function private.resolve_report(p_actor uuid, p_report uuid, p_action boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
begin
  if not private.is_admin(p_actor) then
    raise exception 'Only reviewers can do this' using errcode = '42501';
  end if;
  select * into v_report from public.reports where id = p_report for update;
  if not found or v_report.status <> 'open' then
    raise exception 'This report has already been handled' using errcode = 'P0001';
  end if;
  if p_action and v_report.project_id is not null then
    if coalesce(btrim(p_note), '') = '' then
      raise exception 'Tell the owner what to change' using errcode = 'P0001';
    end if;
    update public.projects
      set status = 'changes_requested', review_note = left(p_note, 1000), is_featured = false
      where id = v_report.project_id and status in ('in_review', 'published', 'paused');
  end if;
  -- Close every open report on the same target in one go.
  update public.reports
    set status = case when p_action then 'actioned' else 'dismissed' end,
        resolved_by = p_actor,
        resolved_at = now()
    where status = 'open'
      and coalesce(profile_id, project_id) = coalesce(v_report.profile_id, v_report.project_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Availability freshness. Saying you're open to work is a claim with a
-- shelf life: it counts for 30 days after you last confirmed it (or edited
-- what you're looking for). Stale profiles drop out of talent counts and are
-- labelled, so owners only see people who are actually around.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column availability_confirmed_at timestamptz not null default now();

-- Editing what you are looking for, or an explicit confirm, renews the clock;
-- nothing else can set it.
create function private.refresh_availability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('directwork.confirm_availability', true) = 'on'
    or new.seeking_paid is distinct from old.seeking_paid
    or new.seeking_partner is distinct from old.seeking_partner
    or new.availability is distinct from old.availability then
    new.availability_confirmed_at := now();
  else
    new.availability_confirmed_at := old.availability_confirmed_at;
  end if;
  return new;
end;
$$;

revoke execute on function private.refresh_availability() from public;

create trigger profiles_refresh_availability
  before update on public.profiles
  for each row execute function private.refresh_availability();

-- "Still available": a one-tap confirm for the signed-in user.
create function public.confirm_availability()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
begin
  -- Transaction-local flag the trigger reads as a deliberate confirm.
  perform set_config('directwork.confirm_availability', 'on', true);
  update public.profiles set availability_confirmed_at = v_now where id = (select auth.uid());
  return v_now;
end;
$$;

revoke execute on function public.confirm_availability() from public, anon;
grant execute on function public.confirm_availability() to authenticated;


create or replace function public.get_platform_pulse()
returns table (open_to_paid integer, open_to_partner integer, live_listings integer, completed integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from public.profiles
      where seeking_paid and availability_confirmed_at > now() - interval '30 days'),
    (select count(*)::integer from public.profiles
      where seeking_partner and availability_confirmed_at > now() - interval '30 days'),
    (select count(*)::integer from public.projects where status = 'published'),
    (select count(*)::integer from public.project_outcomes
      where outcome = 'completed'
        and confirmed_by_owner_at is not null
        and confirmed_by_member_at is not null);
$$;

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
  if coalesce(array_length(p_skills, 1), 0) = 0 then
    return 0;
  end if;
  if array_length(p_skills, 1) > 15 then
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

-- ---------------------------------------------------------------------------
-- Questions on applications: the useful part of messaging (an owner asks,
-- the applicant answers) without open-ended chat. At most one open question
-- at a time and three per application, only while it's pending.
-- ---------------------------------------------------------------------------
create table public.application_questions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  question text not null,
  answer text,
  asked_at timestamptz not null default now(),
  answered_at timestamptz,
  constraint application_questions_question_length
    check (char_length(question) between 5 and 500),
  constraint application_questions_answer_length check (char_length(answer) between 1 and 1000),
  constraint application_questions_no_contact
    check (not private.has_contact_details(concat_ws(' ', question, answer))) not valid
);

create index application_questions_application_idx
  on public.application_questions (application_id, asked_at);

alter table public.application_questions enable row level security;

create policy "Questions follow application visibility"
  on public.application_questions for select
  to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id));

grant select on public.application_questions to authenticated;

create function private.ask_question(p_actor uuid, p_application uuid, p_question text)
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
    values (p_application, btrim(p_question));
end;
$$;

create function private.answer_question(p_actor uuid, p_question uuid, p_answer text)
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
  update public.application_questions
    set answer = btrim(p_answer), answered_at = now()
    where id = p_question;
end;
$$;

-- ---------------------------------------------------------------------------
-- Verified work references. Only possible once both sides have confirmed a
-- collaboration as completed, one per person per collaboration, written
-- about the other party. Public on profiles, and can't be edited - which is
-- what makes them worth more than a self-written endorsement.
-- ---------------------------------------------------------------------------
create table public.work_references (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.project_memberships (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.profiles (id) on delete cascade,
  -- Snapshot: the listing may no longer be visible to readers of the profile.
  project_title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique (membership_id, author_id),
  constraint work_references_body_length check (char_length(body) between 20 and 300),
  constraint work_references_no_contact check (not private.has_contact_details(body)) not valid
);

create index work_references_subject_idx on public.work_references (subject_id, created_at desc);
create index work_references_author_idx on public.work_references (author_id);

alter table public.work_references enable row level security;

create policy "References are readable by signed-in users"
  on public.work_references for select
  to authenticated
  using (true);

grant select on public.work_references to authenticated;

create function private.write_reference(p_actor uuid, p_membership uuid, p_body text)
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
  insert into public.work_references (membership_id, author_id, subject_id, project_title, body)
    values (
      p_membership,
      p_actor,
      case when p_actor = v_owner then v_membership.user_id else v_owner end,
      v_title,
      btrim(p_body)
    );
exception
  when unique_violation then
    raise exception 'You''ve already written a reference for this collaboration' using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------------
-- Activity inbox. One row per thing that needs someone's attention, written
-- by triggers on the underlying tables so it can't drift from reality.
-- ---------------------------------------------------------------------------
create table public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'application_received', 'application_accepted', 'application_declined', 'application_closed',
    'listing_published', 'listing_changes_requested',
    'outcome_to_confirm', 'outcome_confirmed', 'reference_received',
    'question_asked', 'question_answered'
  )),
  actor_id uuid references public.profiles (id) on delete set null,
  project_id uuid references public.projects (id) on delete cascade,
  application_id uuid references public.applications (id) on delete cascade,
  membership_id uuid references public.project_memberships (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index activity_user_idx on public.activity (user_id, created_at desc);
create index activity_unread_idx on public.activity (user_id) where read_at is null;
create index activity_actor_idx on public.activity (actor_id);
create index activity_project_idx on public.activity (project_id);
create index activity_application_idx on public.activity (application_id);
create index activity_membership_idx on public.activity (membership_id);

alter table public.activity enable row level security;

create policy "Users see their own activity"
  on public.activity for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users mark their own activity read"
  on public.activity for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select on public.activity to authenticated;
grant update (read_at) on public.activity to authenticated;

create function private.notify(
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
  where p_user is not null and p_user is distinct from p_actor;
$$;

revoke execute on function private.notify(uuid, text, uuid, uuid, uuid, uuid) from public;

create function private.activity_from_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := (select owner_id from public.projects where id = new.project_id);
begin
  if tg_op = 'INSERT' then
    perform private.notify(v_owner, 'application_received', new.applicant_id, new.project_id, new.id);
  elsif old.status = 'submitted' and new.status in ('accepted', 'rejected') then
    perform private.notify(
      new.applicant_id,
      case
        when new.status = 'accepted' then 'application_accepted'
        when new.closed_by_listing then 'application_closed'
        else 'application_declined'
      end,
      v_owner, new.project_id, new.id
    );
  end if;
  return null;
end;
$$;

create trigger applications_activity
  after insert or update of status on public.applications
  for each row execute function private.activity_from_application();

create function private.activity_from_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' and old.status = 'in_review' then
    perform private.notify(new.owner_id, 'listing_published', null, new.id);
  elsif new.status = 'changes_requested' and old.status <> 'changes_requested' then
    perform private.notify(new.owner_id, 'listing_changes_requested', null, new.id);
  end if;
  return null;
end;
$$;

create trigger projects_activity
  after update of status on public.projects
  for each row execute function private.activity_from_listing();

create function private.activity_from_outcome()
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

create trigger project_outcomes_activity
  after insert or update on public.project_outcomes
  for each row execute function private.activity_from_outcome();

create function private.activity_from_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(new.subject_id, 'reference_received', new.author_id, m.project_id, m.application_id, m.id)
  from public.project_memberships m where m.id = new.membership_id;
  return null;
end;
$$;

create trigger work_references_activity
  after insert on public.work_references
  for each row execute function private.activity_from_reference();

create function private.activity_from_question()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.applications%rowtype;
  v_owner uuid;
begin
  select * into v_app from public.applications where id = new.application_id;
  select owner_id into v_owner from public.projects where id = v_app.project_id;
  if tg_op = 'INSERT' then
    perform private.notify(v_app.applicant_id, 'question_asked', v_owner, v_app.project_id, v_app.id);
  elsif old.answer is null and new.answer is not null then
    perform private.notify(v_owner, 'question_answered', v_app.applicant_id, v_app.project_id, v_app.id);
  end if;
  return null;
end;
$$;

create trigger application_questions_activity
  after insert or update of answer on public.application_questions
  for each row execute function private.activity_from_question();

revoke execute on function private.activity_from_application() from public;
revoke execute on function private.activity_from_listing() from public;
revoke execute on function private.activity_from_outcome() from public;
revoke execute on function private.activity_from_reference() from public;
revoke execute on function private.activity_from_question() from public;

-- ---------------------------------------------------------------------------
-- Edge Function entry points (service_role only), as for the other actions.
-- ---------------------------------------------------------------------------
revoke execute on function private.resolve_report(uuid, uuid, boolean, text) from public;
revoke execute on function private.ask_question(uuid, uuid, text) from public;
revoke execute on function private.answer_question(uuid, uuid, text) from public;
revoke execute on function private.write_reference(uuid, uuid, text) from public;
grant execute on function private.resolve_report(uuid, uuid, boolean, text) to service_role;
grant execute on function private.ask_question(uuid, uuid, text) to service_role;
grant execute on function private.answer_question(uuid, uuid, text) to service_role;
grant execute on function private.write_reference(uuid, uuid, text) to service_role;

create function public.svc_resolve_report(p_actor uuid, p_report uuid, p_action boolean, p_note text)
returns void language sql security invoker set search_path = ''
as $$ select private.resolve_report(p_actor, p_report, p_action, p_note); $$;

create function public.svc_ask_question(p_actor uuid, p_application uuid, p_question text)
returns void language sql security invoker set search_path = ''
as $$ select private.ask_question(p_actor, p_application, p_question); $$;

create function public.svc_answer_question(p_actor uuid, p_question uuid, p_answer text)
returns void language sql security invoker set search_path = ''
as $$ select private.answer_question(p_actor, p_question, p_answer); $$;

create function public.svc_write_reference(p_actor uuid, p_membership uuid, p_body text)
returns void language sql security invoker set search_path = ''
as $$ select private.write_reference(p_actor, p_membership, p_body); $$;

revoke execute on function public.svc_resolve_report(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.svc_ask_question(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.svc_answer_question(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.svc_write_reference(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.svc_resolve_report(uuid, uuid, boolean, text) to service_role;
grant execute on function public.svc_ask_question(uuid, uuid, text) to service_role;
grant execute on function public.svc_answer_question(uuid, uuid, text) to service_role;
grant execute on function public.svc_write_reference(uuid, uuid, text) to service_role;
