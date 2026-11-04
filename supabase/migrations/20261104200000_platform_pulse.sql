-- Live, aggregate numbers that give people a reason to act: how many
-- professionals are open to work, and - while an owner writes a listing -
-- how many of them have the skills it needs. Counts only; no identities,
-- and the client shows small numbers as "a few" rather than exact counts.

create function public.get_platform_pulse()
returns table (open_to_paid integer, open_to_partner integer, live_listings integer, completed integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from public.profiles where seeking_paid),
    (select count(*)::integer from public.profiles where seeking_partner),
    (select count(*)::integer from public.projects where status = 'published'),
    (select count(*)::integer from public.project_outcomes
      where outcome = 'completed'
        and confirmed_by_owner_at is not null
        and confirmed_by_member_at is not null);
$$;

-- Professionals (other than the caller) open to this kind of work who list
-- at least one of the given skills. Matching is case-insensitive.
create function public.count_professionals_for(p_skills text[], p_type text)
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
      and case when p_type = 'paid' then p.seeking_paid else p.seeking_partner end
  );
end;
$$;

revoke execute on function public.get_platform_pulse() from public, anon;
revoke execute on function public.count_professionals_for(text[], text) from public, anon;
grant execute on function public.get_platform_pulse() to authenticated;
grant execute on function public.count_professionals_for(text[], text) to authenticated;
