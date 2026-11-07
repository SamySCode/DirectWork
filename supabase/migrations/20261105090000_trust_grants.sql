-- Exact privileges for the trust-and-activity tables.
--
-- 20261104230000 granted what each table needs but never revoked the
-- hosted project's automatic "grant all to anon, authenticated" on new
-- public tables. RLS still filtered rows, but anon could reach the tables
-- at all, and signed-in users held table-wide INSERT/UPDATE/DELETE that
-- overrode the column grants (e.g. editing any column of their own
-- activity rows, or updating their own reports' status). Same fix as
-- 20261104220000 I2: revoke everything, restate exactly what's needed.
-- Revoking a table privilege also drops its column privileges, so every
-- column grant is restated.

revoke all on
  public.blocks, public.reports, public.application_questions,
  public.work_references, public.activity
from anon, authenticated;

grant select, delete on public.blocks to authenticated;
grant insert (blocked_id) on public.blocks to authenticated;

grant select on public.reports to authenticated;
grant insert (profile_id, project_id, reason, details) on public.reports to authenticated;

-- Asked and answered only through the actions Edge Function.
grant select on public.application_questions to authenticated;

-- Written only through the actions Edge Function.
grant select on public.work_references to authenticated;

-- Rows are written by triggers; the client may only mark them read.
grant select on public.activity to authenticated;
grant update (read_at) on public.activity to authenticated;
