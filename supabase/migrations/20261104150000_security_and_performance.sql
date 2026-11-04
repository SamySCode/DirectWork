-- Security hardening + Supabase usage optimisation.
-- See docs/ACCESS_CONTROL.md ("Security pass") for the reasoning.

-- ---------------------------------------------------------------------------
-- Rate limiting for Edge Functions (fixed window, per key). Lives in
-- Postgres so it holds across every function instance without extra infra.
-- Called by supabase/functions/_shared/middleware.ts via the service role.
-- ---------------------------------------------------------------------------
create table private.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

create index rate_limits_window_idx on private.rate_limits (window_start);

-- Returns true if this hit is allowed. Old windows are swept opportunistically
-- (1 in 100 calls) so the table never grows unbounded and no cron is needed.
create function private.hit_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_hits integer;
begin
  insert into private.rate_limits (key, window_start, hits)
    values (p_key, v_window, 1)
    on conflict (key, window_start) do update set hits = private.rate_limits.hits + 1
    returning hits into v_hits;
  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_max;
end;
$$;

create function public.svc_hit_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language sql security invoker set search_path = ''
as $$ select private.hit_rate_limit(p_key, p_max, p_window_seconds); $$;

revoke execute on function private.hit_rate_limit(text, integer, integer) from public;
revoke execute on function public.svc_hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function private.hit_rate_limit(text, integer, integer) to service_role;
grant execute on function public.svc_hit_rate_limit(text, integer, integer) to service_role;
grant select, insert, update, delete on private.rate_limits to service_role;

-- ---------------------------------------------------------------------------
-- Foreign keys without a covering index: every cascade/set-null on the
-- parent (e.g. deleting a user) would otherwise scan the whole child table,
-- and RLS/joins on them do the same. The db test suite now fails on any
-- unindexed foreign key, so this can't regress.
-- ---------------------------------------------------------------------------
create index profile_skills_skill_idx on public.profile_skills (skill_id);
create index application_status_history_changed_by_idx
  on public.application_status_history (changed_by);

-- ---------------------------------------------------------------------------
-- Batch skill lookup/creation: one round trip for a whole skills list,
-- instead of 2-3 requests per skill. Security invoker, so the caller's RLS,
-- column grants and the per-user creation cap all still apply.
-- ---------------------------------------------------------------------------
create function public.ensure_skills(p_names text[])
returns table (id uuid, name text)
language plpgsql
security invoker
set search_path = ''
as $$
-- The RETURNS TABLE columns (id, name) shadow skills' own columns; make
-- unqualified references mean the table column.
#variable_conflict use_column
begin
  if coalesce(array_length(p_names, 1), 0) > 20 then
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

revoke execute on function public.ensure_skills(text[]) from public, anon;
grant execute on function public.ensure_skills(text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage abuse caps. Bucket size/type limits stop big or non-image files,
-- but not *many* files - uploads go straight to Storage, outside our Edge
-- Function rate limits. Cap objects per user per bucket, generously above
-- what the UI can produce (old files are deleted when replaced/removed).
-- ---------------------------------------------------------------------------
create function private.storage_object_count(p_bucket text, p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from storage.objects
  where bucket_id = p_bucket and (storage.foldername(name))[1] = p_user::text;
$$;

revoke execute on function private.storage_object_count(text, uuid) from public;
grant execute on function private.storage_object_count(text, uuid) to authenticated, service_role;

create policy "Per-user file caps"
  on storage.objects as restrictive for insert
  to authenticated
  with check (
    private.storage_object_count(bucket_id, (select auth.uid())) < case bucket_id
      when 'avatars' then 5
      when 'portfolio' then 12
      when 'listing-images' then 120
      when 'application-attachments' then 60
      else 0
    end
  );

-- Attachments can only be uploaded by someone with a pending application -
-- they're always uploaded straight after applying.
create policy "Attachment uploads need a pending application"
  on storage.objects as restrictive for insert
  to authenticated
  with check (
    bucket_id <> 'application-attachments'
    or exists (
      select 1 from public.applications a
      where a.applicant_id = (select auth.uid()) and a.status = 'submitted'
    )
  );
