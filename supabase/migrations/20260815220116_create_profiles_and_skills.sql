-- Skills: shared, growing lookup table. Free text with autocomplete -
-- new skills are inserted on first use rather than drawn from a seed list.
-- See docs/OPEN_DECISIONS.md.
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  constraint skills_name_length check (char_length(name) between 1 and 100)
);

create unique index skills_name_lower_idx on public.skills (lower(name));

alter table public.skills enable row level security;

create policy "Skills are readable by authenticated users"
  on public.skills for select
  to authenticated
  using (true);

create policy "Authenticated users can add a new skill"
  on public.skills for insert
  to authenticated
  with check (true);

-- Current Supabase projects default to NOT auto-exposing new tables to the
-- Data API roles (see supabase/config.toml's auto_expose_new_tables note) -
-- without these, RLS policies above are unreachable and every request 404s
-- regardless of policy correctness.
grant select, insert on public.skills to authenticated;

-- Profiles: 1:1 with auth.users. Row is only created once a user submits
-- a complete profile form - no auto-created blank row on sign-up, since
-- full_name/headline are required and there's no onboarding wizard (see
-- docs/ARCHITECTURE.md) that would need one pre-seeded.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  headline text not null,
  bio text,
  location text,
  remote_pref text check (remote_pref in ('remote', 'hybrid', 'onsite', 'flexible')),
  availability text,
  -- Not "current_role": that identifier is a reserved PostgreSQL keyword
  -- (see the SQL Key Words appendix) and would fail unquoted in DDL.
  current_title text,
  experience_level text,
  seeking_paid boolean not null default false,
  seeking_partner boolean not null default false,
  portfolio_url text,
  avatar_url text,
  cv_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_seeking_check check (seeking_paid or seeking_partner),
  -- Mirrors features/profile/schemas.ts's zod limits. RLS lets a user write
  -- to this table directly via the REST API, bypassing app-level zod
  -- entirely - these are the actual enforcement, not just UX hints.
  constraint profiles_full_name_length check (char_length(full_name) <= 200),
  constraint profiles_headline_length check (char_length(headline) <= 200),
  constraint profiles_bio_length check (char_length(bio) <= 1000),
  constraint profiles_location_length check (char_length(location) <= 200),
  constraint profiles_availability_length check (char_length(availability) <= 200),
  constraint profiles_current_title_length check (char_length(current_title) <= 200),
  constraint profiles_experience_level_length check (char_length(experience_level) <= 200),
  constraint profiles_portfolio_url_length check (char_length(portfolio_url) <= 500),
  constraint profiles_portfolio_url_scheme check (portfolio_url is null or portfolio_url ~* '^https?://')
);

alter table public.profiles enable row level security;

-- auth.uid() is wrapped as (select auth.uid()) throughout this file so
-- Postgres can hoist it into a single InitPlan instead of re-evaluating it
-- per row - invisible at low row counts, expensive later. See Supabase's
-- RLS performance guidance.
create policy "Profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select, insert, update on public.profiles to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Profile skills: join table, editable only by the owning profile.
create table public.profile_skills (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, skill_id)
);

alter table public.profile_skills enable row level security;

create policy "Profile skills are readable by authenticated users"
  on public.profile_skills for select
  to authenticated
  using (true);

create policy "Users can add their own profile skills"
  on public.profile_skills for insert
  to authenticated
  with check (profile_id = (select auth.uid()));

create policy "Users can remove their own profile skills"
  on public.profile_skills for delete
  to authenticated
  using (profile_id = (select auth.uid()));

grant select, insert, delete on public.profile_skills to authenticated;
