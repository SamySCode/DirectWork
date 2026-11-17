-- Daily "payment due" activity where pg_cron exists (hosted Supabase). PGlite
-- has none; the tests call private.emit_payment_due() directly. Kept apart
-- from 20261107090000 so that if the platform refuses the cron call, only
-- this small migration fails and the Deal Sheet schema stays applied.
-- 06:07 UTC is early morning UK time all year, so the notice lands on the
-- due date itself (the function works out "today" in Europe/London).
-- Re-running updates the job of the same name.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    execute $cron$select cron.schedule('directwork-payment-due', '7 6 * * *', 'select private.emit_payment_due()')$cron$;
  end if;
end;
$$;
