# Going live

A checklist from "works on my machine" to "in the stores". Items marked
**(you)** need an account, a payment, a legal decision or a real person.
Code can't do them.

## 1. Database and backend

- [ ] **(you)** `npx supabase login`, then
      `npx supabase link --project-ref <ref>`.
- [ ] Apply migrations: `npx supabase db push`. Neither migration has been
      applied to the hosted project yet. Run `npm run test:db` first; it
      runs the same SQL against Postgres locally.
- [ ] Storage buckets are created by the migration; confirm they exist
      (Dashboard > Storage) after `db push`.
- [ ] Deploy functions:
      `npx supabase functions deploy actions delete-account billing billing-webhook`.
- [ ] Set function secrets: `ALLOWED_ORIGINS=https://<web origin>` (comma-separate
      several; unset = localhost only), plus the
      Stripe ones in `docs/MONETIZATION.md` if billing is on.
- [ ] Hosted auth settings (Dashboard > Authentication), to match
      `supabase/config.toml`:
  - Email confirmations **on**, secure password change **on**, minimum
    password length **8**.
  - Site URL = web origin. Redirect URLs: `https://<web origin>/**`,
    `directwork://**`.
  - **(you)** Custom SMTP (Resend, Postmark, etc.). Supabase's built-in
    mailer is rate-limited to a handful of emails per hour and isn't meant
    for production.
  - Customise the confirmation and reset email templates with the brand.
- [ ] **(you)** Seed at least one reviewer, or nothing can go live:
      `insert into public.admins (user_id) values ('<auth user id>');`
- [ ] Run the live RLS check against the hosted project:
      `npm run test:rls:live` (env vars documented in the file).
- [ ] **(you)** Upgrade to Supabase Pro before real users arrive: daily
      backups, no auto-pause, and higher auth email limits.

## 2. Web

- [ ] `npx expo export --platform web` produces `dist/`, a single-page app.
      Host it anywhere static (Netlify, Cloudflare Pages, Vercel) with an SPA
      fallback to `index.html`.
- [ ] `public/_headers` sets HSTS, nosniff, frame-deny, referrer and
      permissions headers on Netlify/Cloudflare. Other hosts need the same
      headers in their own config.
- [ ] Add a Content-Security-Policy once the production origin exists, and
      test it there first. `connect-src` needs the Supabase URL; react-native-web
      needs `style-src 'unsafe-inline'`.
- [ ] Set `EXPO_PUBLIC_*` env vars in the host's build settings.

## 3. Mobile (EAS)

- [ ] **(you)** Confirm the bundle id / package `com.directwork.app` in
      `app.json`. It can't be changed after the first store submission.
- [ ] `npx eas-cli login`, then `npx eas-cli init` (adds the project id to
      `app.json`).
- [ ] Store `EXPO_PUBLIC_*` values as EAS environment variables for the
      `preview` and `production` environments (`eas.json` references them).
- [ ] `npx eas-cli build --profile preview --platform all` and test on real
      devices: sign-up email link, password reset link (deep link), and
      sign-out/in.
- [ ] **(you)** Apple Developer (£79/yr) and Google Play ($25) accounts.
- [ ] `npx eas-cli build --profile production`, then `npx eas-cli submit`.
- [ ] Store listings: screenshots, description, support URL, privacy policy
      URL, and the App Privacy / Data safety forms. The app collects name,
      email, professional details and usage within the app. No tracking, no
      ads.

## 4. Legal: blocking for public launch

None of this is legal advice. A UK solicitor should review it.

- [ ] **(you)** Privacy policy (UK GDPR). Both stores require one, and
      sign-up should link to it. It must cover what's stored (profile,
      listings, applications, outcomes), who sees what (profiles are visible
      to signed-in users; email only on mutual acceptance), processors
      (Supabase, Stripe, the email provider), retention, and the in-app
      deletion route.
- [ ] **(you)** Terms of service, including the curation rules (what
      reviewers reject) and the fact that DirectWork isn't a party to any
      deal.
- [ ] **(you)** ICO registration (data protection fee), likely required for
      a UK business processing personal data.
- [ ] Once those exist: add links on the sign-up screen and the Profile
      menu. This is deliberately not built yet; see `docs/OPEN_DECISIONS.md`.

## 5. Operations

- [ ] **(you)** Name the operator who works the review queue daily. The
      "usually within a day" copy promises it.
- [ ] Error monitoring (Sentry's Expo SDK is the usual choice) before
      launch, so crashes on real devices are visible.
- [ ] Uptime check on the web origin, plus Supabase's own status alerts.
- [ ] Decide on email notifications for "someone applied" and "you were
      accepted". Today people only find out by opening the app (home badge
      and "Needs you" list). This is the most likely early complaint, and
      it's deferred to Phase 3 by `docs/PRODUCT_STRATEGY.md`.

## Already done in code

- RLS on every table, column-level grants, transitions behind an Edge
  Function, 43 database tests, 232 unit/component tests and Edge Function
  tests in CI. See the security pass in `docs/ACCESS_CONTROL.md`.
- Abuse caps (listings, applications per day, new skills per day).
- In-app account deletion (App Store 5.1.1(v)), which cancels Stripe
  first.
- Purchase UI is web-only, to stay within App Store 3.1.1 and Play billing
  rules.
- Brand icon, adaptive icon, splash and favicon.
- CI: lint, typecheck, format, database tests, and a web build on every PR.
