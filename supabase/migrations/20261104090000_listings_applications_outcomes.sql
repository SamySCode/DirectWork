-- Slices 4-8 + monetization: curated listings, applications, memberships,
-- the mutually-confirmed outcome ledger, and owner-side plans.
-- See docs/DATA_MODEL.md and docs/ACCESS_CONTROL.md.
--
-- Shape of the access model in this file:
--   * RLS + column-level grants handle who can read rows and which plain
--     fields an owner/applicant may write directly.
--   * Every status change lives in a private.* function that only the
--     service_role can execute. The `actions` Edge Function authenticates
--     the caller and passes their id in as `p_actor` - the client can
--     never call these directly (CLAUDE.md: sensitive transitions go
--     through Edge Functions, RLS is the backstop).
--   * auth.uid() is wrapped as (select auth.uid()) everywhere - see the
--     standing rules in docs/ACCESS_CONTROL.md.

-- ---------------------------------------------------------------------------
-- Profiles: allow "here to hire" as a valid reason to have a profile.
-- The original check forced project owners to pretend they were job-seeking.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column wants_to_hire boolean not null default false;

alter table public.profiles drop constraint profiles_seeking_check;
alter table public.profiles
  add constraint profiles_intent_check check (seeking_paid or seeking_partner or wants_to_hire);

-- ---------------------------------------------------------------------------
-- private schema: RLS helpers (executable by authenticated, used inside
-- policies) and state-transition functions (service_role only). Not in the
-- Data API's exposed schemas, so none of this is reachable as REST/RPC.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
-- Functions default to EXECUTE for PUBLIC, and a per-schema
-- `alter default privileges ... revoke` can't remove a global default - so
-- the end of this file revokes PUBLIC execute on everything in private
-- explicitly. The supabase/tests/db suite asserts this.

-- ---------------------------------------------------------------------------
-- Operators (curation reviewers). Seeded by hand - see supabase/README.md.
-- Deliberately a separate table, not a profiles column: users can update
-- their own profile row.
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

create policy "Users can see whether they are an admin"
  on public.admins for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select on public.admins to authenticated;

create function private.is_admin(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = p_user);
$$;

grant execute on function private.is_admin(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Plans. Professionals are never charged (docs/PRODUCT_STRATEGY.md) - plans
-- only gate owner-side reach: how many listings can be live at once, and
-- whether they're featured. Written only by the billing webhook.
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'inactive'
    check (status in ('inactive', 'active', 'trialing', 'past_due', 'canceled')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can read their own subscription"
  on public.subscriptions for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select on public.subscriptions to authenticated;

create function private.has_pro(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = p_user
      and plan = 'pro'
      and status in ('active', 'trialing', 'past_due')
      and (current_period_end is null or current_period_end > now())
  );
$$;

-- Kept in one place so the client's plan copy (features/billing/plans.ts)
-- has a single number to mirror.
create function private.live_listing_limit(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.has_pro(p_user) then 10 else 1 end;
$$;

grant execute on function private.has_pro(uuid) to service_role;
grant execute on function private.live_listing_limit(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Projects (listings)
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null,
  public_summary text not null,
  opportunity_type text not null check (opportunity_type in ('paid', 'partner')),
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'changes_requested', 'published', 'paused', 'completed', 'abandoned')),
  location text,
  remote_pref text check (remote_pref in ('remote', 'hybrid', 'onsite', 'flexible')),
  commitment text check (commitment in ('few_hours', 'part_time', 'full_time')),
  duration text,
  -- Paid route only. Shape resolved in docs/OPEN_DECISIONS.md: a rate type
  -- plus an optional min/max range, whole currency units.
  compensation_type text check (compensation_type in ('fixed', 'hourly', 'daily')),
  compensation_min integer check (compensation_min >= 0),
  compensation_max integer check (compensation_max >= 0),
  currency text not null default 'GBP' check (currency in ('GBP', 'EUR', 'USD')),
  review_note text,
  is_featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_title_length check (char_length(title) between 3 and 120),
  constraint projects_summary_length check (char_length(public_summary) between 20 and 2000),
  constraint projects_location_length check (char_length(location) <= 200),
  constraint projects_duration_length check (char_length(duration) <= 100),
  constraint projects_review_note_length check (char_length(review_note) <= 1000),
  constraint projects_compensation_range check (
    compensation_min is null or compensation_max is null or compensation_min <= compensation_max
  )
);

create index projects_discover_idx on public.projects (status, is_featured desc, published_at desc);
create index projects_owner_idx on public.projects (owner_id);

create trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute function public.set_updated_at();

alter table public.projects enable row level security;

-- Applications are declared below; the helpers that reference them are
-- security definer so a projects policy reading applications (and vice
-- versa) can't recurse into each other's RLS.
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  applicant_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  application_type text not null check (application_type in ('paid', 'partner')),
  status text not null default 'submitted'
    check (status in ('submitted', 'accepted', 'rejected', 'withdrawn')),
  cover_note text not null,
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_cover_note_length check (char_length(cover_note) between 20 and 1500),
  constraint applications_decision_note_length check (char_length(decision_note) <= 500)
);

-- One live application per person per listing; a withdrawn/rejected one
-- doesn't block re-applying later.
create unique index applications_one_live_idx
  on public.applications (project_id, applicant_id)
  where status in ('submitted', 'accepted');
create index applications_applicant_idx on public.applications (applicant_id, created_at desc);
create index applications_project_idx on public.applications (project_id, status);

create trigger applications_set_updated_at
  before update on public.applications
  for each row
  execute function public.set_updated_at();

create function private.owns_project(p_project uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.projects where id = p_project and owner_id = p_user);
$$;

create function private.has_applied(p_project uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.applications where project_id = p_project and applicant_id = p_user
  );
$$;

create function private.can_edit_project(p_project uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects
    where id = p_project and owner_id = p_user and status in ('draft', 'changes_requested')
  );
$$;

grant execute on function private.owns_project(uuid, uuid) to authenticated, service_role;
grant execute on function private.has_applied(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_edit_project(uuid, uuid) to authenticated, service_role;

create policy "Published listings are readable; owners, applicants and admins see their own"
  on public.projects for select
  to authenticated
  using (
    status = 'published'
    or owner_id = (select auth.uid())
    or private.has_applied(id, (select auth.uid()))
    or private.is_admin((select auth.uid()))
  );

create policy "Owners can create draft listings"
  on public.projects for insert
  to authenticated
  with check (owner_id = (select auth.uid()) and status = 'draft');

-- Edits only while the listing is outside the marketplace - a published
-- listing must go back to draft (via the actions function) and through
-- review again, otherwise curation could be bypassed after approval.
create policy "Owners can edit listings that are not live"
  on public.projects for update
  to authenticated
  using (owner_id = (select auth.uid()) and status in ('draft', 'changes_requested'))
  with check (owner_id = (select auth.uid()) and status in ('draft', 'changes_requested'));

create policy "Owners can delete drafts"
  on public.projects for delete
  to authenticated
  using (owner_id = (select auth.uid()) and status = 'draft');

-- Column-level grants: status, review_note, is_featured, published_at and
-- owner_id are never client-writable, whatever the RLS policy allows.
grant select, delete on public.projects to authenticated;
grant insert (
  title, public_summary, opportunity_type, location, remote_pref, commitment, duration,
  compensation_type, compensation_min, compensation_max, currency
) on public.projects to authenticated;
grant update (
  title, public_summary, opportunity_type, location, remote_pref, commitment, duration,
  compensation_type, compensation_min, compensation_max, currency
) on public.projects to authenticated;

-- Cap drafts so the table can't be flooded by one account.
create function private.limit_draft_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.projects where owner_id = new.owner_id) >= 25 then
    raise exception 'You have reached the maximum number of listings' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger projects_limit_draft_count
  before insert on public.projects
  for each row
  execute function private.limit_draft_count();

-- ---------------------------------------------------------------------------
-- Partner-route admission criteria - required before a partner listing can
-- be submitted for review (docs/PRODUCT_STRATEGY.md Phase 0).
-- ---------------------------------------------------------------------------
create table public.project_admission (
  project_id uuid primary key references public.projects (id) on delete cascade,
  what_exists_already text not null,
  weekly_commitment_hours integer not null check (weekly_commitment_hours between 1 and 60),
  first_milestone text not null,
  proposed_terms text not null,
  owner_contribution text not null,
  constraint admission_what_exists_length check (char_length(what_exists_already) between 20 and 1000),
  constraint admission_milestone_length check (char_length(first_milestone) between 10 and 500),
  constraint admission_terms_length check (char_length(proposed_terms) between 5 and 500),
  constraint admission_contribution_length check (char_length(owner_contribution) between 10 and 500)
);

alter table public.project_admission enable row level security;

create policy "Admission criteria follow listing visibility"
  on public.project_admission for select
  to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));

create policy "Owners can add admission criteria while editing"
  on public.project_admission for insert
  to authenticated
  with check (private.can_edit_project(project_id, (select auth.uid())));

create policy "Owners can change admission criteria while editing"
  on public.project_admission for update
  to authenticated
  using (private.can_edit_project(project_id, (select auth.uid())))
  with check (private.can_edit_project(project_id, (select auth.uid())));

create policy "Owners can remove admission criteria while editing"
  on public.project_admission for delete
  to authenticated
  using (private.can_edit_project(project_id, (select auth.uid())));

grant select, insert, update, delete on public.project_admission to authenticated;

-- ---------------------------------------------------------------------------
-- Required skills per listing
-- ---------------------------------------------------------------------------
create table public.project_required_skills (
  project_id uuid not null references public.projects (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  primary key (project_id, skill_id)
);

create index project_required_skills_skill_idx on public.project_required_skills (skill_id);

alter table public.project_required_skills enable row level security;

create policy "Required skills follow listing visibility"
  on public.project_required_skills for select
  to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));

create policy "Owners can add required skills while editing"
  on public.project_required_skills for insert
  to authenticated
  with check (private.can_edit_project(project_id, (select auth.uid())));

create policy "Owners can remove required skills while editing"
  on public.project_required_skills for delete
  to authenticated
  using (private.can_edit_project(project_id, (select auth.uid())));

grant select, insert, delete on public.project_required_skills to authenticated;

-- ---------------------------------------------------------------------------
-- Applications: applicants insert directly (project_id + cover_note only);
-- everything else is set by the trigger or by private.* transitions.
-- ---------------------------------------------------------------------------
alter table public.applications enable row level security;

create policy "Applicants and listing owners can read applications"
  on public.applications for select
  to authenticated
  using (
    applicant_id = (select auth.uid())
    or private.owns_project(project_id, (select auth.uid()))
  );

create policy "Users can apply as themselves"
  on public.applications for insert
  to authenticated
  with check (applicant_id = (select auth.uid()) and status = 'submitted');

grant select on public.applications to authenticated;
grant insert (project_id, cover_note) on public.applications to authenticated;

create function private.prepare_application()
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
  return new;
end;
$$;

create trigger applications_prepare
  before insert on public.applications
  for each row
  execute function private.prepare_application();

-- Append-only audit trail, written only by private.* transitions.
create table public.application_status_history (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications (id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index application_status_history_app_idx on public.application_status_history (application_id);

alter table public.application_status_history enable row level security;

create policy "History follows application visibility"
  on public.application_status_history for select
  to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id));

grant select on public.application_status_history to authenticated;

create function private.log_initial_application_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.application_status_history (application_id, from_status, to_status, changed_by)
  values (new.id, null, new.status, new.applicant_id);
  return new;
end;
$$;

create trigger applications_log_initial_status
  after insert on public.applications
  for each row
  execute function private.log_initial_application_status();

-- ---------------------------------------------------------------------------
-- Memberships: created only by private.decide_application on acceptance.
-- ---------------------------------------------------------------------------
create table public.project_memberships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  application_id uuid not null unique references public.applications (id) on delete cascade,
  role text not null check (role in ('partner', 'contractor')),
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

create index project_memberships_user_idx on public.project_memberships (user_id);
create index project_memberships_project_idx on public.project_memberships (project_id);

alter table public.project_memberships enable row level security;

create policy "Members and listing owners can read memberships"
  on public.project_memberships for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.owns_project(project_id, (select auth.uid()))
  );

grant select on public.project_memberships to authenticated;

-- ---------------------------------------------------------------------------
-- Outcome ledger. Per membership rather than per project (the earlier
-- proposal keyed it by project_id, which can't represent more than one
-- collaborator). Either side proposes; it only counts once both confirm
-- the same outcome.
-- ---------------------------------------------------------------------------
create table public.project_outcomes (
  membership_id uuid primary key references public.project_memberships (id) on delete cascade,
  outcome text not null check (outcome in ('completed', 'abandoned')),
  summary text,
  confirmed_by_owner_at timestamptz,
  confirmed_by_member_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_outcomes_summary_length check (char_length(summary) <= 500)
);

create trigger project_outcomes_set_updated_at
  before update on public.project_outcomes
  for each row
  execute function public.set_updated_at();

alter table public.project_outcomes enable row level security;

create policy "Outcomes follow membership visibility"
  on public.project_outcomes for select
  to authenticated
  using (exists (select 1 from public.project_memberships m where m.id = membership_id));

grant select on public.project_outcomes to authenticated;

-- ---------------------------------------------------------------------------
-- Read-side RPCs (public schema, exposed). Security definer, each doing its
-- own authorization check.
-- ---------------------------------------------------------------------------

-- Contact reveal on mutual acceptance: the other party's email, only once an
-- application is accepted, only to the two people involved.
create function public.get_application_contact(p_application uuid)
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
  return query
    select p.full_name, u.email::text
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = v_other;
end;
$$;

revoke execute on function public.get_application_contact(uuid) from public, anon;
grant execute on function public.get_application_contact(uuid) to authenticated;

-- Public track record: mutually confirmed outcomes only.
create function public.get_track_record(p_user uuid)
returns table (completed integer, total integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where o.outcome = 'completed')::integer,
    count(*)::integer
  from public.project_outcomes o
  join public.project_memberships m on m.id = o.membership_id
  join public.projects p on p.id = m.project_id
  where (m.user_id = p_user or p.owner_id = p_user)
    and o.confirmed_by_owner_at is not null
    and o.confirmed_by_member_at is not null;
$$;

revoke execute on function public.get_track_record(uuid) from public, anon;
grant execute on function public.get_track_record(uuid) to authenticated;

create function public.get_listing_quota()
returns table (live integer, max_live integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from public.projects
      where owner_id = (select auth.uid()) and status in ('in_review', 'published', 'paused')),
    private.live_listing_limit((select auth.uid()));
$$;

revoke execute on function public.get_listing_quota() from public, anon;
grant execute on function public.get_listing_quota() to authenticated;

-- ---------------------------------------------------------------------------
-- State transitions - service_role only, called by supabase/functions/actions.
-- Each takes the authenticated caller's id as p_actor and does its own
-- authorization, so the Edge Function stays a thin gate.
-- ---------------------------------------------------------------------------

create function private.submit_listing(p_actor uuid, p_project uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
begin
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

create function private.review_listing(p_actor uuid, p_project uuid, p_approve boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
begin
  if not private.is_admin(p_actor) then
    raise exception 'Only reviewers can do this' using errcode = '42501';
  end if;
  select * into v_project from public.projects where id = p_project for update;
  if not found or v_project.status <> 'in_review' then
    raise exception 'Listing is not awaiting review' using errcode = 'P0001';
  end if;
  if p_approve then
    update public.projects
      set status = 'published',
          review_note = null,
          published_at = coalesce(published_at, now()),
          is_featured = private.has_pro(owner_id)
      where id = p_project;
  else
    if coalesce(btrim(p_note), '') = '' then
      raise exception 'Tell the owner what to change' using errcode = 'P0001';
    end if;
    update public.projects
      set status = 'changes_requested', review_note = left(p_note, 1000)
      where id = p_project;
  end if;
end;
$$;

-- Owner-driven lifecycle moves. Allowed transitions:
--   in_review         -> draft       (withdraw from review)
--   published         -> paused | draft (edit + re-review) | completed | abandoned
--   paused            -> published | draft | completed | abandoned
create function private.set_listing_status(p_actor uuid, p_project uuid, p_to text)
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
  update public.projects set status = p_to where id = p_project;
  -- Closing a listing turns away anyone still waiting, rather than leaving
  -- them in limbo.
  if p_to in ('completed', 'abandoned') then
    with closed as (
      update public.applications
        set status = 'rejected', decided_at = now(), decision_note = 'Listing closed'
        where project_id = p_project and status = 'submitted'
        returning id
    )
    insert into public.application_status_history (application_id, from_status, to_status, changed_by)
      select id, 'submitted', 'rejected', p_actor from closed;
  end if;
end;
$$;

create function private.decide_application(p_actor uuid, p_application uuid, p_accept boolean, p_note text)
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
  if not found or not private.owns_project(v_app.project_id, p_actor) then
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

create function private.withdraw_application(p_actor uuid, p_application uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.applications
    set status = 'withdrawn'
    where id = p_application and applicant_id = p_actor and status = 'submitted';
  if not found then
    raise exception 'Only a pending application of yours can be withdrawn' using errcode = 'P0001';
  end if;
  insert into public.application_status_history (application_id, from_status, to_status, changed_by)
    values (p_application, 'submitted', 'withdrawn', p_actor);
end;
$$;

-- Either party records an outcome. Proposing a different outcome than the
-- one on file resets the other side's confirmation; matching it confirms.
create function private.record_outcome(p_actor uuid, p_membership uuid, p_outcome text, p_summary text)
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

-- Billing webhook writes plan state here; also refreshes featured placement
-- on the owner's live listings so a downgrade takes effect immediately.
create function private.apply_subscription(
  p_user uuid,
  p_plan text,
  p_status text,
  p_customer text,
  p_subscription text,
  p_period_end timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (
    user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end, updated_at
  ) values (p_user, p_plan, p_status, p_customer, p_subscription, p_period_end, now())
  on conflict (user_id) do update
    set plan = excluded.plan,
        status = excluded.status,
        stripe_customer_id = coalesce(excluded.stripe_customer_id, public.subscriptions.stripe_customer_id),
        stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.subscriptions.stripe_subscription_id),
        current_period_end = excluded.current_period_end,
        updated_at = now();
  update public.projects
    set is_featured = private.has_pro(p_user)
    where owner_id = p_user and status in ('published', 'paused');
end;
$$;

grant execute on function private.submit_listing(uuid, uuid) to service_role;
grant execute on function private.review_listing(uuid, uuid, boolean, text) to service_role;
grant execute on function private.set_listing_status(uuid, uuid, text) to service_role;
grant execute on function private.decide_application(uuid, uuid, boolean, text) to service_role;
grant execute on function private.withdraw_application(uuid, uuid) to service_role;
grant execute on function private.record_outcome(uuid, uuid, text, text) to service_role;
grant execute on function private.apply_subscription(uuid, text, text, text, text, timestamptz) to service_role;

-- Edge Functions reach private.* through these thin public wrappers because
-- the Data API only exposes the public schema. Execute is service_role-only,
-- so they are not callable with a user's JWT.
create function public.svc_submit_listing(p_actor uuid, p_project uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.submit_listing(p_actor, p_project); $$;

create function public.svc_review_listing(p_actor uuid, p_project uuid, p_approve boolean, p_note text)
returns void language sql security invoker set search_path = ''
as $$ select private.review_listing(p_actor, p_project, p_approve, p_note); $$;

create function public.svc_set_listing_status(p_actor uuid, p_project uuid, p_to text)
returns void language sql security invoker set search_path = ''
as $$ select private.set_listing_status(p_actor, p_project, p_to); $$;

create function public.svc_decide_application(p_actor uuid, p_application uuid, p_accept boolean, p_note text)
returns void language sql security invoker set search_path = ''
as $$ select private.decide_application(p_actor, p_application, p_accept, p_note); $$;

create function public.svc_withdraw_application(p_actor uuid, p_application uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.withdraw_application(p_actor, p_application); $$;

create function public.svc_record_outcome(p_actor uuid, p_membership uuid, p_outcome text, p_summary text)
returns void language sql security invoker set search_path = ''
as $$ select private.record_outcome(p_actor, p_membership, p_outcome, p_summary); $$;

create function public.svc_apply_subscription(
  p_user uuid, p_plan text, p_status text, p_customer text, p_subscription text, p_period_end timestamptz
)
returns void language sql security invoker set search_path = ''
as $$ select private.apply_subscription(p_user, p_plan, p_status, p_customer, p_subscription, p_period_end); $$;

revoke execute on function public.svc_submit_listing(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.svc_review_listing(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.svc_set_listing_status(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.svc_decide_application(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.svc_withdraw_application(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.svc_record_outcome(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.svc_apply_subscription(uuid, text, text, text, text, timestamptz) from public, anon, authenticated;

grant execute on function public.svc_submit_listing(uuid, uuid) to service_role;
grant execute on function public.svc_review_listing(uuid, uuid, boolean, text) to service_role;
grant execute on function public.svc_set_listing_status(uuid, uuid, text) to service_role;
grant execute on function public.svc_decide_application(uuid, uuid, boolean, text) to service_role;
grant execute on function public.svc_withdraw_application(uuid, uuid) to service_role;
grant execute on function public.svc_record_outcome(uuid, uuid, text, text) to service_role;
grant execute on function public.svc_apply_subscription(uuid, text, text, text, text, timestamptz) to service_role;

-- See the note at the top of the private schema section. Explicit role
-- grants above are unaffected; this only removes the implicit PUBLIC one.
revoke execute on all functions in schema private from public;

-- ---------------------------------------------------------------------------
-- Skills are a shared table any signed-in user can insert into (free-text
-- autocomplete, docs/OPEN_DECISIONS.md) - cap new skills per user per day so
-- one account can't flood everyone's suggestions. Existing rows have no
-- creator and are unaffected.
-- ---------------------------------------------------------------------------
alter table public.skills
  add column created_by uuid default auth.uid() references auth.users (id) on delete set null;

create index skills_created_by_idx on public.skills (created_by, created_at);

create function private.limit_skill_creation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null and (
    select count(*) from public.skills
    where created_by = new.created_by and created_at > now() - interval '24 hours'
  ) >= 50 then
    raise exception 'Too many new skills today - try again tomorrow' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger skills_limit_creation
  before insert on public.skills
  for each row
  execute function private.limit_skill_creation();

-- created_by comes from the column default only; the existing insert grant
-- is table-wide, so narrow it to the one column clients may set.
revoke insert on public.skills from authenticated;
grant insert (name) on public.skills to authenticated;

revoke execute on function private.limit_skill_creation() from public;
