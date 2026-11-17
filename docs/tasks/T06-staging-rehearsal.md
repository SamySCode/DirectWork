# T06: Staging rehearsal checklist

**Model:** Haiku. **Size:** short. The owner runs every command; the
model only guides and reads the output. Claude is blocked from changing
a hosted project, by design.

## Goal

Prove the current code works on the real (staging) Supabase project
before production exists.

## Steps to walk the owner through, one at a time

1. `npm run check` passes locally.
2. `npx supabase db push --dry-run`, then `npx supabase db push`,
   against the linked staging project. Stop on any error and report it;
   do not improvise fixes to migrations.
3. `npx supabase functions deploy` for actions, billing,
   billing-webhook, delete-account and maintenance.
4. Set secrets: `ALLOWED_ORIGINS`, `APP_URL`, `MAINTENANCE_SECRET`.
5. In the dashboard (not `config push`): Site URL and exact redirect
   URLs, minimum password length 10, secure password change on.
6. Sign up with a real email, confirm it, create a profile, post a
   listing, approve it as admin, apply from a second account, accept,
   create a Deal Sheet, confirm it, export data, delete the second
   account.
7. In the SQL Editor confirm: a `legal_acceptances` row exists for the
   new user; `select * from cron.job` shows the retention and
   payment-due jobs; the authenticated role's statement timeout is 3s.

## Check first: the server key (added 2026-11-17)

The five Edge Functions create their privileged database client from
`SUPABASE_SERVICE_ROLE_KEY` (`supabase/functions/_shared/http.ts`,
`serviceClient`). Supabase is retiring that key by the end of 2026 and
reports say newly created projects no longer get one. The London
production project is new, so the functions may fail there with no key.

Before deploying to production:

1. On the project, check Edge Functions > Secrets for which of
   `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_SECRET_KEYS` exist.
2. Change `serviceClient` to prefer the new key and fall back to the old:
   parse `SUPABASE_SECRET_KEYS` (a JSON object) and use its `default`
   entry; otherwise use `SUPABASE_SERVICE_ROLE_KEY`. Add a test for both.
3. Run `npm run test:functions`, then the full journey on staging.

This is a security change: review it on the strongest model before it is
deployed anywhere. It was not made on 2026-11-17 because the function
tests could not be run in that session. `docs/NEXT_STEPS.md` step 4.4
lists this for "before the first store build"; it is needed earlier,
before the first production deploy.

## Done when

Every step is ticked, or the failing step is written up with the exact
error for a stronger model to fix.
