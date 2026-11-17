-- 1. Kill switch for the public pays-on-time record.
-- 2. Trigram indexes for the Discover text search.

-- ---------------------------------------------------------------------------
-- 1. Feature flags (owner-operated kill switches)
-- ---------------------------------------------------------------------------

-- Not exposed through the Data API: private schema, and no grants. Only
-- security definer functions read it. The owner flips a flag from the SQL
-- editor, and it takes effect on the next request, with no app release:
--
--   update private.feature_flags set enabled = false, updated_at = now()
--     where key = 'pay_record_public';
--
-- Set it back to true to turn the feature on again.
create table private.feature_flags (
  key text primary key,
  enabled boolean not null,
  updated_at timestamptz default now()
);

revoke all on table private.feature_flags from public, anon, authenticated;

insert into private.feature_flags (key, enabled) values ('pay_record_public', true);

-- Same as 20261107090000, plus the kill switch. With the flag off (or the
-- row missing, so it fails closed) it returns no rows, which the app already
-- shows as "no record yet".
create or replace function public.get_pay_record(p_owner uuid)
returns table (counted integer, on_time integer, late integer, unpaid integer)
language sql
stable
security definer
set search_path = ''
as $$
  with counted as (
    select r.outcome
    from public.payment_reports r
    join public.deal_sheets d on d.id = r.deal_sheet_id
    join public.project_memberships m on m.id = d.membership_id
    join public.projects p on p.id = m.project_id
    join public.profiles reporter on reporter.id = r.reported_by
    where p.owner_id = p_owner
      and (select auth.uid()) is not null
      and r.reported_by = m.user_id
      and r.dispute_status in ('none', 'rejected')
      and d.agreed_at is not null
      and d.owner_confirmed_version = d.version
      and d.member_confirmed_version = d.version
      and reporter.created_at <= d.agreed_at - interval '14 days'
  )
  select * from (
    select
      count(*)::integer,
      (count(*) filter (where outcome = 'on_time'))::integer,
      (count(*) filter (where outcome = 'late'))::integer,
      (count(*) filter (where outcome = 'unpaid'))::integer
    from counted
  ) t (counted, on_time, late, unpaid)
  where t.counted >= 3
    and exists (
      select 1 from private.feature_flags f
      where f.key = 'pay_record_public' and f.enabled
    );
$$;

-- create or replace keeps the grants; restated so this file stands alone.
revoke execute on function public.get_pay_record(uuid) from public, anon;
grant execute on function public.get_pay_record(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Trigram indexes for Discover search
-- ---------------------------------------------------------------------------

-- Discover searches with `status = 'published' and (title ilike '%term%' or
-- public_summary ilike '%term%')` (features/listings/api.ts). A btree can't
-- serve a leading wildcard, so without these it's a sequential scan over
-- published listings: fine at launch, linear past about 10k. Partial on
-- status = 'published' to match the query, so drafts and closed listings
-- cost nothing; the planner BitmapOrs the two indexes. Terms under 3
-- characters still scan (no trigrams), which is fine at that size.
-- Guarded so a Postgres without pg_trgm (e.g. a bare PGlite) still migrates.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_trgm') then
    create schema if not exists extensions;
    create extension if not exists pg_trgm with schema extensions;
    create index if not exists projects_published_title_trgm
      on public.projects using gin (title extensions.gin_trgm_ops)
      where status = 'published';
    create index if not exists projects_published_summary_trgm
      on public.projects using gin (public_summary extensions.gin_trgm_ops)
      where status = 'published';
  end if;
end;
$$;
