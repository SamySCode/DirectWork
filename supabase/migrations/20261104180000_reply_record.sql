-- Owner reply record: the anti-ghosting signal shown on every listing.
-- Most job-seekers never hear back from most applications; job boards are
-- starting to show employer responsiveness for exactly that reason. Here
-- it's computed from data we already have and can't be self-reported.
--
-- Aggregates only - never exposes individual applications - so it's safe to
-- show any signed-in user. Last 180 days, so owners can recover from a bad
-- patch. Rules:
--   * withdrawn applications don't count either way;
--   * an application still waiting under 7 days isn't held against anyone yet;
--   * auto-rejections from closing a listing don't count as replies - closing
--     with people still waiting is exactly the behaviour this surfaces.

create function public.get_owner_reply_record(p_owner uuid)
returns table (received integer, replied integer, median_hours integer)
language sql
stable
security definer
set search_path = ''
as $$
  with counted as (
    select a.status, a.created_at, a.decided_at, a.decision_note
    from public.applications a
    join public.projects p on p.id = a.project_id
    where p.owner_id = p_owner
      and a.created_at > now() - interval '180 days'
      and a.status <> 'withdrawn'
      and not (a.status = 'submitted' and a.created_at > now() - interval '7 days')
  ),
  replies as (
    select * from counted
    where status in ('accepted', 'rejected')
      and decision_note is distinct from 'Listing closed'
  )
  select
    (select count(*)::integer from counted),
    (select count(*)::integer from replies),
    (select round(percentile_cont(0.5) within group (
       order by extract(epoch from (decided_at - created_at)) / 3600
     ))::integer from replies);
$$;

revoke execute on function public.get_owner_reply_record(uuid) from public, anon;
grant execute on function public.get_owner_reply_record(uuid) to authenticated;
