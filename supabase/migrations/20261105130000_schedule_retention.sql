-- Daily retention where pg_cron exists (hosted Supabase). PGlite has none;
-- the tests call private.apply_retention() directly. Kept apart from
-- 20261105120000 so that if the platform refuses the cron call, only this
-- small migration fails and the hardening above stays applied.
-- Re-running updates the job of the same name. File removal still needs the
-- maintenance Edge Function on a schedule (docs/NEXT_STEPS.md).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    execute $cron$select cron.schedule('directwork-retention', '17 3 * * *', 'select private.apply_retention()')$cron$;
  end if;
end;
$$;
