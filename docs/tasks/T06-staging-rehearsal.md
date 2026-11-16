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

## Done when

Every step is ticked, or the failing step is written up with the exact
error for a stronger model to fix.
