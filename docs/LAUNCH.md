# Going live

A checklist from "works on my machine" to "in the stores". Items marked
**(you)** need an account, a payment, a legal decision or a real person.
Code can't do them.

The full ordered runbook, with commands, costs and checks, is
`docs/NEXT_STEPS.md`. Vendor choices are in `docs/STACK.md`. This page is
the short checklist.

## 1. Database and backend

State on 2026-11-07:

- The current hosted project (Ireland, eu-west-1) has every migration up to
  `20261105100000` applied. It becomes **staging**.
- `20261105110000_privacy_fixes.sql` and
  `20261105120000_launch_hardening.sql` are written and tested locally but
  **not applied anywhere**.
- Production will be a **new project in London (eu-west-2)** with nothing
  applied yet.

- [ ] **(you)** Create the London production project (NEXT_STEPS 1.7) and
      upgrade it to Pro before the first non-team user (2.4).
- [ ] Run `npm run test:db`, `npm run test:functions` and
      `npm run check:functions` first. Push only if they pass.
- [ ] Apply migrations, staging first, then production:
      `npx supabase link --project-ref <ref>`, then
      `npx supabase db push --dry-run`, then `npx supabase db push`.
- [ ] Storage buckets are created by the migrations; confirm the four
      buckets exist with a 2 MB limit (Dashboard > Storage).
- [ ] Deploy functions:
      `npx supabase functions deploy actions delete-account billing billing-webhook maintenance`.
- [ ] Set function secrets: `ALLOWED_ORIGINS=https://<web origin>` (comma-separate
      several; unset = localhost only), `APP_URL=https://<web origin>` and
      `MAINTENANCE_SECRET=<random>`. Add the Stripe ones in
      `docs/MONETIZATION.md` only when billing is switched on.
- [ ] Schedule the `maintenance` function daily (pg_cron + pg_net, or an
      external cron sending the `x-maintenance-key` header). Without it,
      deleted images and attachments are never removed from Storage. Row
      retention runs on its own via `pg_cron` at 03:17.
- [ ] Hosted Auth settings. **Don't run `config push --yes`**:
      `supabase/config.toml` has a localhost Site URL and local redirect
      URLs, and pushing them blind would open an account-takeover path. Run
      `npx supabase config push` without `--yes`, read the diff, and set the
      URL settings in the dashboard instead (NEXT_STEPS 2.12):
  - Email confirmations **on**, secure password change **on**, minimum
    password length **10**, leaked-password protection **on** (Pro).
  - Site URL = web origin. Redirect URLs: **exact URLs only** (the web
    origin's `/sign-in` and `/update-password`, and the app's exact native
    callback). **Never `exp://**`, never localhost, never a wildcard.**
  - **(you)** Custom SMTP through **Amazon SES (London)** with SPF, DKIM and
    DMARC, open/click tracking off (NEXT_STEPS 2.10-2.11). **Sign-up is
    broken for real users without it**: Supabase's built-in mailer only
    delivers to members of your Supabase organisation's team. Then raise the
    Auth email rate limit to about 100–200/hour.
  - Turn off "Write audit logs to the database" (the privacy notice promises
    7-day security logs).
  - Customise the confirmation and reset email templates with the brand.
- [ ] **(you)** Seed at least one reviewer, or nothing can go live:
      `insert into public.admins (user_id) values ('<auth user id>');`
- [ ] Run the live RLS check against the hosted project:
      `npm run test:rls:live` (env vars documented in the file).
- [ ] Admin two-factor: TOTP is enabled in Auth. Making the app require it
      for admins is a later item; until then keep the admin list minimal and
      use two-factor on every Supabase dashboard login.
- [ ] Before the first store build: move the Edge Functions off the legacy
      `SUPABASE_SERVICE_ROLE_KEY` (deprecated by end-2026) to the new secret
      keys and JWT signing keys.

## 2. Web

- [ ] `npx expo export --platform web` produces `dist/`, a single-page app.
      Host it on **Cloudflare Workers Static Assets** with
      `not_found_handling = "single-page-application"` (NEXT_STEPS 2.17).
- [ ] `public/_headers` sets HSTS, nosniff, frame-deny, referrer and
      permissions headers. Cloudflare reads it as is.
- [ ] Add a Content-Security-Policy once the production origin exists, and
      test it in report-only mode first. `connect-src` needs the Supabase URL;
      react-native-web needs `style-src 'unsafe-inline'`.
- [ ] Set `EXPO_PUBLIC_*` env vars in the build settings (production values
      for production, staging values for previews).

## 3. Mobile (EAS)

- [ ] **(you)** Confirm the bundle id / package `com.directwork.app` in
      `app.json`. It can't be changed after the first store submission.
- [ ] Install `expo-updates` with a `fingerprint` runtime policy **before the
      first store build** (NEXT_STEPS 4.3).
- [ ] `npx eas-cli login`, then `npx eas-cli init` (adds the project id to
      `app.json`).
- [ ] Store `EXPO_PUBLIC_*` values as EAS environment variables for the
      `preview` and `production` environments (`eas.json` references them).
- [ ] `npx eas-cli build --profile preview --platform all` and test on real
      devices: sign-up email link, password reset link (deep link), and
      sign-out/in.
- [ ] **(you)** Apple Developer (£79/yr) and Google Play ($25) accounts,
      **both as the company** (needs a D-U-N-S number; start early).
- [ ] **(you)** Decide Apple 3.1.3(b): web-bought Pro is only allowed in the
      iOS app if Pro is also sold as an in-app purchase (NEXT_STEPS 4.2).
- [ ] `npx eas-cli build --profile production`, then `npx eas-cli submit`.
- [ ] Store listings: screenshots, description, support URL, privacy policy
      URL (`/legal/privacy`), account-deletion URL for Google
      (`/legal/account-deletion`), and the App Privacy / Data safety forms.
      The app collects name, email, professional details and usage within
      the app. No tracking, no ads.

## 4. Legal: blocking for public launch

None of this is legal advice. A UK solicitor should review it. The full
register is `docs/legal/uk-law-register.md`.

- [ ] **(you)** Choose the legal entity (Ltd recommended), then pay the ICO
      data protection fee in its name.
- [ ] **(you)** Fill in `features/legal/operator.json`, then run
      `npm run check:launch` (fails while any placeholder remains).
- [ ] **(you)** Solicitor review of the in-app documents
      (`features/legal/documents/`: Terms, Privacy, Community & Listing
      Guidelines, References, Complaints & Appeals, Cookies, Account
      deletion, Contact) and the drafts in `docs/legal/`.
      Already built: an unskippable "I'm 18 or over and I agree" checkbox at
      sign-up, recorded with versions, and a re-acceptance screen when the
      versions change.
- [ ] **(you)** Online Safety Act 2023: sign the illegal-content risk
      assessment and the children's access assessment
      (`docs/legal/online-safety-risk-assessment.md`,
      `docs/legal/childrens-access-assessment.md`) and name the accountable
      person. The 18+ self-declaration is evidence for the children's access
      assessment, **not a substitute for it**: the assessment is required
      either way.
- [ ] **(you)** Register on the NCA portal for CSEA reporting (in force
      7 April 2026, any service size). Legal holds
      (`private.legal_holds`) stop account deletion while evidence must be
      kept; runbook in NEXT_STEPS 2.20.
- [ ] **(you)** Data (Use and Access) Act 2025: data-protection complaints
      must be acknowledged within 30 days (`docs/legal/complaints-procedure.md`).
- [ ] Retention periods: decided 2026-11-06 and built
      (`docs/legal/retention-schedule.md`), pending the migration deploy and
      the maintenance schedule.
- [ ] **(you)** Employment Agencies Act scope: solicitor view. Keep
      professionals free (charging work-seekers is an offence).
- [ ] **(you)** Billing stays **off** until immigration advice on the
      "online matching service" rules (in force 1 Oct 2026), the Apple
      3.1.3(b) decision, and a consumer-law-compliant checkout.

## 5. Operations

- [ ] **(you)** Name the operator who works the review queue daily. The
      "usually within a day" copy promises it.
- [ ] Error monitoring: Sentry in its EU region (optional), with personal
      data scrubbed. Add it to the privacy notice first.
- [ ] Uptime check on the web origin, plus Supabase's own status alerts.
- [ ] Off-site encrypted backups and a rehearsed restore (NEXT_STEPS 3.3).
- [ ] Decide on email notifications for "someone applied" and "you were
      accepted". Today people only find out by opening the app (home badge
      and "Needs you" list).

## Already done in code

- RLS on every table, column-level grants, transitions behind an Edge
  Function, database tests, unit/component tests and Edge Function tests in
  CI. See `docs/ACCESS_CONTROL.md`.
- Abuse caps (listings, applications per day, new skills per day, reports
  per day, files per user).
- In-app account deletion (App Store 5.1.1(v)), which cancels Stripe first
  and is refused during a legal hold.
- Legal documents in the app, reachable signed-out; 18+ and terms
  acceptance at sign-up; re-acceptance on version change; "Download my data".
- Purchase UI is web-only, to stay within App Store 3.1.1 and Play billing
  rules.
- Brand icon, adaptive icon, splash and favicon.
- CI: lint, typecheck, format, database tests, and a web build on every PR.
