-- Cap a single signed-in Data API request at 3 seconds (hosted default for
-- `authenticated` is 8s; `anon` is already lower). This bounds the cost of
-- generic PostgREST filter abuse, e.g. an expensive imatch/ilike regex over
-- an unindexed text column. It caps one request, not a concurrent flood.
-- Kept in its own file so that if the platform refuses it, only this
-- migration fails.
--
-- Rollout: apply to staging first, then check pg_stat_statements for any
-- legitimate authenticated query near 3s (mean and max) before production.
-- service_role (Edge Functions) and postgres (cron) are not affected.
--
-- Revert (SQL editor, or a new migration). Use set, not reset: reset drops
-- the role setting entirely instead of restoring Supabase's 8s default.
--
--   alter role authenticated set statement_timeout = '8s';
--   notify pgrst, 'reload config';
alter role authenticated set statement_timeout = '3s';

-- PostgREST applies the role's settings per request; reload so it picks up
-- the new value without a restart.
notify pgrst, 'reload config';
