# Next steps: the launch runbook

Written 2026-11-07 for the owner. It assumes you have done nothing yet
except push the code to GitHub and run `npx supabase login`.

How to read it:

- Do the phases in order. Inside a phase, do the steps in order unless a
  step says it can run in parallel.
- **Who:** _You_ means a person with the accounts, a payment card or a
  legal decision. _Code_ means a Claude Code session (or a developer) in this
  repo. Code never commits, pushes or touches a hosted project unless you
  ask it to.
- **Cost** is what you pay. Prices were checked on 2026-11-05.
- Commands run in a terminal in the repo folder
  (`C:\Users\samee\GitHub\DirectWork`).
- Why each vendor was chosen: `docs/STACK.md`. Which laws apply:
  `docs/legal/uk-law-register.md`.

A few words used below:

- **Staging**: a copy of the backend for testing. Real users never touch it.
- **Production**: the backend real users use.
- **Migration**: a file in `supabase/migrations/` that changes the database.
  Once applied to a hosted project, it must never be edited.
- **Edge Function**: a small server program hosted by Supabase
  (`supabase/functions/`).
- **DNS record**: a setting on your domain that tells the internet where your
  website and email live.

---

## Phase 1: Now (no cost)

### 1.1 Decide the legal entity

- **Who:** You (an accountant can confirm, optional).
- **Do:** Pick a **private limited company (Ltd)**. Recommended because:
  - your personal assets are protected from fines and claims (Online Safety
    Act penalties alone go up to £18m or 10% of revenue);
  - the ICO fee, Stripe, Apple, Google and the domain are each registered to
    one legal person, so changing later means redoing them all;
  - the stores show the company, not your name, as the seller.
    Don't register anything in your own name in the meantime.
- **Cost:** £0 to decide (incorporating is step 2.1).
- **Check it worked:** the decision is written under "Decided" in
  `docs/OPEN_DECISIONS.md`.

### 1.2 Answer the open owner decisions

- **Who:** You.
- **Do:** Read the "Still open: owner decisions" list in
  `docs/OPEN_DECISIONS.md` (track records when the other person deletes
  their account, launch platforms, email notifications, the paid-route pay
  floor and so on). Answer each one, or write "later".
- **Cost:** £0.
- **Check it worked:** every item has an answer or a date.

### 1.3 Run every test on the pending work

- **Who:** Code.
- **Do:** three new migrations are written but not applied anywhere:
  `20261105110000_privacy_fixes.sql`, `20261105120000_launch_hardening.sql` and `20261105130000_schedule_retention.sql` (the nightly pg_cron schedule, kept separate so a refused cron call cannot roll back the rest).
  Run:
  ```
  npm run check
  npm run test:db
  npm run test:functions
  npm run check:functions
  ```
- **Cost:** £0.
- **Check it worked:** all four end with no failures (the database suite had
  95 passing tests on 2026-11-07).

### 1.4 Commit the uncommitted migrations and the rest of the work

- **Who:** You ask, Code does it.
- **Do:** two migrations (`20261105090000`, `20261105100000`) are already
  applied to the current hosted project but exist only as staged files, so
  no commit can rebuild the live database. Say to Claude Code: "commit the
  migrations and the review work on a branch and open a PR". Review the PR on
  GitHub, wait for CI to go green, then merge.
- **Cost:** £0.
- **Check it worked:** `git status` no longer lists anything under
  `supabase/migrations/`, and the PR's CI checks are green.

### 1.5 Upgrade to Expo SDK 58

- **Who:** Code.
- **Do:** the app is on SDK 57; SDK 58 is out, and Expo Go only runs the
  latest SDK.
  ```
  npx expo install expo@^58 --fix
  npx expo-doctor
  npm run check
  ```
  Then test sign-up and sign-in on a phone.
  Guide: <https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/>.
- **Cost:** £0.
- **Check it worked:** `npx expo-doctor` reports no problems and
  `npm run check` passes. From now on, upgrade within about 6–8 weeks of each
  new SDK and never fall more than one behind.

### 1.6 Turn the current Supabase project into staging

- **Who:** You.
- **Do:** in <https://supabase.com/dashboard>:
  1. Open the organisation that holds the current project. Organization
     settings > General: rename it **DirectWork-Staging**. Leave it on Free.
  2. Open the project. Project Settings > General: rename it
     **directwork-staging**.
- **Cost:** £0. (Free projects pause after a week idle; fine for staging.)
- **Check it worked:** the dashboard shows "DirectWork-Staging /
  directwork-staging".

### 1.7 Create the production project in London

- **Who:** You.
- **Do:** this is cheap now and very expensive later: the region can't be
  changed, and the project address is built into every app you ship.
  1. Dashboard > New organization: name **DirectWork**, plan **Free** for now.
  2. New project in that organisation: name **directwork**, region **West EU
     (London) / eu-west-2**. Generate a strong database password and save it
     in a password manager.
  3. Don't push anything to it yet (that's step 2.12).
- **Cost:** £0 until step 2.4.
- **Check it worked:** Project Settings > General shows region `eu-west-2`.
  You now have two free projects, which is the account maximum.

### 1.8 Secure your logins

- **Who:** You.
- **Do:** use a password manager. Turn on two-factor sign-in for GitHub and
  for your Supabase account (Supabase: your avatar > Account preferences >
  Security). Use an authenticator app or a hardware key, never SMS.
- **Cost:** £0 (a hardware key is about £25–50, optional).
- **Check it worked:** signing in to each asks for a second factor.

### 1.9 Read the Online Safety Act drafts

- **Who:** You.
- **Do:** read and correct
  [docs/legal/online-safety-risk-assessment.md](legal/online-safety-risk-assessment.md)
  and [docs/legal/childrens-access-assessment.md](legal/childrens-access-assessment.md).
  You are the **named person accountable** for online safety: put your name
  in both. Don't sign yet; the solicitor sees them first (step 2.9).
- **Cost:** £0.
- **Check it worked:** every `[ ]` blank in the two files is filled in.

---

## Phase 2: Before the closed beta

The closed beta starts the day the first person outside the team signs up.
From that day you are processing real people's data, so everything here must
be done first.

### 2.1 Incorporate the company

- **Who:** You.
- **Do:** register a private limited company at Companies House:
  <https://www.gov.uk/limited-company-formation>. Search the name first
  (Companies House and the UK trade mark register). Usually done within a day.
- **Cost:** £100 online. An accountant is optional (£40–£250/month).
- **Check it worked:** you have a certificate of incorporation and a
  company number.

### 2.2 Apply for a D-U-N-S number (start straight away)

- **Who:** You.
- **Do:** Apple and Google need it to enrol the company as a developer. It can
  take up to about 30 days, so start as soon as the company exists. Use
  Apple's lookup: <https://developer.apple.com/enroll/duns-lookup/>.
- **Cost:** £0.
- **Check it worked:** you receive a 9-digit D-U-N-S number by email.

### 2.3 Pay the ICO data protection fee

- **Who:** You.
- **Do:** pay in the **company's** name:
  <https://ico.org.uk/for-organisations/data-protection-fee/>. Tier 1 (turnover
  up to £632k or up to 10 staff).
- **Cost:** £52/year (£47 by direct debit).
- **Check it worked:** you have a registration number starting `ZA`, and the
  company appears on the ICO's public register.

### 2.4 Upgrade production to Supabase Pro

- **Who:** You.
- **Do:** Dashboard > organisation **DirectWork** > Billing > change plan to
  **Pro**. Leave the **spend cap on**. Pro is needed for backups, no
  auto-pause, 7-day logs and leaked-password protection. Leave staging on Free.
- **Cost:** $25/month (plus VAT on the invoice).
- **Check it worked:** Billing shows Pro; Database > Backups shows daily
  backups.

### 2.5 Buy the domain on Cloudflare

- **Who:** You.
- **Do:** create a Cloudflare account (turn on two-factor). Domain
  Registration > Register: buy the `.com`. For a `.co.uk`, register it at any
  UK registrar and transfer it in. Turn on **DNSSEC** (domain > DNS >
  Settings). Pick one as the main address; redirect the other.
- **Cost:** about $11/year for a `.com`, about $5/year for a `.co.uk`.
- **Check it worked:** the domain shows **Active** in Cloudflare.

### 2.6 Set up support@ and privacy@ with Cloudflare Email Routing

- **Who:** You.
- **Do:** Cloudflare > your domain > Email > Email Routing > Enable (it adds
  the DNS records). Add custom addresses that forward to your own inbox:
  `support@`, `privacy@`, `security@` (and `complaints@` if you want a
  separate one). Verify your inbox when asked.
- **Cost:** £0.
- **Check it worked:** an email sent from another account to each address
  arrives in your inbox.

### 2.7 Fill in the operator details, then run the launch check

- **Who:** You fill in, Code runs the check.
- **Do:** edit `features/legal/operator.json`. Replace every `[ ... ]` with the
  real value: company legal name, "private limited company", company number,
  registered office address, VAT number or "not registered", ICO number,
  data-protection lead (you), and the three email addresses from step 2.6.
  Then:
  ```
  npm run check:launch
  ```
- **Cost:** £0.
- **Check it worked:** the command exits with no placeholder errors. It also
  catches `[PLACEHOLDER]` text left inside the legal documents.

### 2.8 Update the privacy notice for London (and Sentry)

- **Who:** Code.
- **Do:** `features/legal/documents/privacy.ts` still says Supabase keeps the
  data in Ireland. Change it to London (UK) to match step 1.7. If you will
  use Sentry (step 2.18), add it as a processor (EU region) first. Bump
  `PRIVACY_VERSION` in `features/legal/versions.ts` only if users have
  already accepted an earlier version.
- **Cost:** £0.
- **Check it worked:** `npm run check` passes; the in-app Privacy page says
  London.

### 2.9 Solicitor review of the in-app legal documents

- **Who:** You (with a UK solicitor who knows tech platforms and employment
  law).
- **Do:** send them:
  - the in-app documents in `features/legal/documents/` (Terms, Privacy,
    Community & Listing Guidelines, References, Complaints, Cookies, Account
    deletion, Contact);
  - every draft in `docs/legal/`;
  - the "Open questions for the solicitor" in
    `docs/legal/uk-law-register.md` (employment agency scope, online matching
    service, equity offers, who counts as a consumer, and so on).
    Code applies their changes. Start this now; it must be finished before
    public launch at the latest.
- **Cost:** about £750–£3,000 (estimate).
- **Check it worked:** each `docs/legal/` draft has the solicitor's name and
  date in its sign-off lines, and the in-app documents carry their wording.

### 2.10 Amazon SES in London, with SPF, DKIM and DMARC

- **Who:** You (Code can help with the DNS values).
- **Do:** without a real email sender, nobody outside your Supabase team
  receives a confirmation email, so nobody can sign up.
  1. Create an AWS account. Protect the root user with a hardware key or
     authenticator. Create an admin user through IAM Identity Center. Set a
     billing alarm at $5 (Billing > Budgets).
  2. Switch the console region to **Europe (London) eu-west-2**. Open Amazon
     SES > Identities > Create identity > Domain: `mail.<your domain>`, with
     **Easy DKIM**. Add the 3 CNAME records it shows in Cloudflare DNS
     (set them to **DNS only**, grey cloud).
  3. Same identity > Custom MAIL FROM domain: `bounce.mail.<your domain>`. Add
     the MX record (`feedback-smtp.eu-west-2.amazonses.com`) and the SPF TXT
     record it shows.
  4. DMARC on the main domain: Cloudflare > Email > DMARC Management (free)
     gives you a reporting address. Add a TXT record `_dmarc` with
     `v=DMARC1; p=none; rua=mailto:<that address>`. After 2–4 weeks of clean
     reports, change `p=none` to `p=quarantine`, later `p=reject`.
  5. **Open and click tracking off.** Don't add open or click events to any
     SES configuration set, and don't turn on link tracking. Our privacy
     notice promises no tracking.
  6. Leave account-level suppression on for bounces and complaints (the
     default).
  7. Account dashboard > **Request production access**: say "transactional
     account emails only (sign-up confirmation, password reset), low volume,
     bounces and complaints suppressed automatically". Allow 1–3 days.
  8. SMTP settings > Create SMTP credentials. Save the username and password
     in your password manager.
- **Cost:** 10p per 1,000 emails; new AWS accounts get free credits.
- **Check it worked:** SES shows the identity as **Verified**, DKIM
  **Successful**, MAIL FROM **Success**, and the account is out of the
  sandbox.

### 2.11 Connect SES to Supabase as custom SMTP

- **Who:** You.
- **Do:** in the **production** project:
  1. Authentication > Emails > SMTP Settings > enable custom SMTP. Host
     `email-smtp.eu-west-2.amazonaws.com`, port `587`, the SMTP username and
     password from 2.10, sender `no-reply@mail.<your domain>`, sender name
     `DirectWork`.
  2. Authentication > Rate Limits: raise the email limit to about
     100–200 per hour (it drops to 30/hour once custom SMTP is on).
  3. Authentication > Emails > Templates: put the DirectWork name on the
     confirmation and reset emails. Keep them plain, with one link.
     Do the same on staging later if you want staging emails to reach testers.
- **Cost:** £0.
- **Check it worked:** sign up with a Gmail, an Outlook and an iCloud
  address. Each gets the email in the inbox (not spam). In Gmail, "Show
  original" says **SPF: PASS, DKIM: PASS, DMARC: PASS**.

### 2.12 Push the database and the Auth settings (only after 1.3 passes)

- **Who:** You run the commands (or ask Code to, explicitly).
- **Do:** only after every test in step 1.3 passes and step 1.4 is merged.
  Rehearse on staging first, then production.

  ```
  npx supabase link --project-ref <staging ref>
  npx supabase db push --dry-run
  npx supabase db push
  ```

  Then `npm run test:rls:live` against staging (the env vars are listed in
  the test file). If that's clean, repeat `link`, `db push --dry-run` and
  `db push` with the **production** ref. The project ref is the
  `xxxxxxxx` in `https://xxxxxxxx.supabase.co` (Project Settings > General).

  Auth settings: `supabase/config.toml` is written for local development
  (Site URL `localhost`). So:
  1. Run `npx supabase config push` **without** `--yes`. It shows what will
     change and asks you to confirm. Say **no** if it would set the Site URL
     or redirect URLs to anything with `localhost`, then set those two by hand
     (next point) instead.
  2. Authentication > URL Configuration: **Site URL** =
     `https://<your domain>`. **Redirect URLs**: only exact addresses, such as
     `https://<your domain>/sign-in`, `https://<your domain>/update-password`
     and the app's exact native callback.
  3. **Never add `exp://**`, `localhost` or any wildcard to the hosted
     redirect list.** A wildcard lets any web page or any Expo Go app receive
     sign-in and password-reset links, which means account takeover.
  4. Check: minimum password length 10, email confirmation on, secure
     password change on, and turn on "prevent use of leaked passwords" (Pro).
  5. Seed yourself as a reviewer, in SQL Editor (find your user id under
     Authentication > Users):
     ```sql
     insert into public.admins (user_id) values ('<your auth user id>');
     ```

- **Cost:** £0.
- **Check it worked:** `db push --dry-run` lists nothing left to apply;
  Storage shows the four buckets with a 2 MB limit; URL Configuration shows
  only your exact URLs; `npm run test:rls:live` passes.

### 2.13 Turn off Auth audit-log storage

- **Who:** You.
- **Do:** the privacy notice says security logs are kept up to 7 days, but
  Supabase can also copy Auth events (with IP addresses) into the database
  forever. In production: Authentication > Configuration > Audit Logs > turn
  off **"Write audit logs to the database"**. Docs:
  <https://supabase.com/docs/guides/auth/audit-logs>.
- **Cost:** £0.
- **Check it worked:** the setting shows off. After a test sign-in, SQL
  Editor `select count(*) from auth.audit_log_entries;` doesn't grow.

### 2.14 Deploy the Edge Functions and set their secrets

- **Who:** You (or Code, if you ask).
- **Do:** with production linked:
  1. Make a random maintenance secret:
     ```
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
     Save it in your password manager.
  2. Set the secrets:
     ```
     npx supabase secrets set ALLOWED_ORIGINS=https://<your domain> APP_URL=https://<your domain> MAINTENANCE_SECRET=<the secret>
     ```
     (`ALLOWED_ORIGINS` takes a comma-separated list if you have two web
     addresses. Leave the Stripe secrets unset: billing stays off.)
  3. Deploy all five functions, including the new `maintenance` one:
     ```
     npx supabase functions deploy actions delete-account billing billing-webhook maintenance
     ```
- **Cost:** £0 (within Pro's 2 million calls a month).
- **Check it worked:** `npx supabase secrets list` shows the three names;
  Edge Functions in the dashboard lists five functions.

### 2.15 Schedule the maintenance function daily

- **Who:** You (paste the SQL), Code can check it.
- **Do:** the database already deletes expired rows itself every night at
  03:17 (the retention job in the migration uses `pg_cron` when the project
  has it). But **files** (photos, attachments) can only be deleted through the
  Storage API, so the `maintenance` function must be called daily with
  `MAINTENANCE_SECRET`. It isn't scheduled yet. Use Supabase Cron:
  1. Database > Extensions: enable **pg_cron** and **pg_net**.
  2. SQL Editor, in production (replace the two values):
     ```sql
     select vault.create_secret('<the maintenance secret>', 'maintenance_secret');

     select cron.schedule(
       'directwork-maintenance',
       '47 3 * * *',
       $$
       select net.http_post(
         url := 'https://<project ref>.supabase.co/functions/v1/maintenance',
         headers := jsonb_build_object(
           'Content-Type', 'application/json',
           'x-maintenance-key',
           (select decrypted_secret from vault.decrypted_secrets where name = 'maintenance_secret')
         ),
         body := '{}'::jsonb
       );
       $$
     );
     ```
  An external scheduler (for example a GitHub Actions cron job sending the
  same POST with the `x-maintenance-key` header) works too, if you prefer.
- **Cost:** £0.
- **Check it worked:** Integrations > Cron lists `directwork-retention` and
  `directwork-maintenance`. The next day, SQL Editor
  `select status_code from net._http_response order by created desc limit 1;`
  returns `200`.

### 2.16 Two-factor sign-in for admins

- **Who:** You.
- **Do:** admins can see every report and review note.
  1. Your Supabase dashboard login: two-factor on (step 1.8). Anyone else you
     invite to the DirectWork organisation must do the same.
  2. App admin accounts: TOTP is switched on in the Auth settings, but the app
     doesn't yet force admins to use it. That's a Code item for later; until
     then, keep the admin list to you and use a long unique password.
- **Cost:** £0.
- **Check it worked:** `select count(*) from public.admins;` in SQL Editor
  shows only the people you expect.

### 2.17 Host the web app on Cloudflare

- **Who:** Code prepares, You connect the account.
- **Do:**
  1. Code adds a `wrangler.jsonc` (static assets from `./dist`,
     `not_found_handling = "single-page-application"`), cache headers and a
     Content-Security-Policy in `public/_headers` (tested in report-only mode
     first), and a GitHub Actions deploy job.
  2. You create a Cloudflare API token (My Profile > API Tokens > "Edit
     Cloudflare Workers", one account) and save it as a GitHub secret.
  3. Build settings: `EXPO_PUBLIC_SUPABASE_URL` and the publishable key of the
     **production** project; preview deploys point at **staging**.
  4. Workers & Pages > your worker > Settings > Domains: add your domain.
- **Cost:** £0 (static files are free and unlimited).
- **Check it worked:** `https://<your domain>` loads the app; a deep page
  such as `/legal/privacy` loads directly; a test sign-up's confirmation link
  opens the app's sign-in page.

### 2.18 Sentry in its EU region (optional)

- **Who:** You create the account, Code adds the SDK.
- **Do:** create the Sentry organisation and choose **EU (Frankfurt)** data
  storage when asked; it can't be changed later. Code installs it with
  `npx expo install @sentry/react-native`, turns on personal-data scrubbing,
  and adds Sentry to the privacy notice (step 2.8) before it ships. Add the
  free uptime monitor on your web address.
- **Cost:** £0 (5,000 errors/month, one user).
- **Check it worked:** a test error from the web app appears in Sentry, with
  no email address in it.

### 2.19 Register with the NCA for child sexual abuse reporting

- **Who:** You.
- **Do:** since 7 April 2026 every user-to-user service, whatever its size,
  must report child sexual exploitation and abuse (CSEA) content to the
  National Crime Agency and must register on the NCA portal **before** its
  first report. Follow Ofcom's guide:
  <https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/duty-to-report-child-sexual-exploitation-and-abuse-csea-content-know-the-rules-and-how-to-comply>.
  Name yourself as the organisation administrator, and a deputy if you have
  one.
- **Cost:** £0.
- **Check it worked:** you can sign in to the NCA portal as the
  organisation's administrator.

### 2.20 Keep the legal-hold runbook to hand

- **Who:** You.
- **Do:** if you ever find suspected CSEA content, or the police or NCA ask
  you to keep data:
  1. Don't look at more than you must. Never download, screenshot, copy or
     forward it.
  2. Stop the account being deleted, in SQL Editor:
     ```sql
     insert into private.legal_holds (user_id, reason)
     values ('<user id>', 'CSEA report <NCA reference>, <date>');
     ```
     While a hold exists, "Delete account" answers "Your account can't be
     deleted right now. Contact support."
  3. Report it on the NCA portal (immediately if a child is at risk). Answer
     any NCA follow-up within 7 days.
  4. Then take the content down from public view (listing: send back for
     changes; profile: ask Code or remove it in the dashboard).
  5. Keep the NCA report reference for **5 years**, and the content plus
     related data for **1 year**. Record the case in your breach and
     incident log.
  6. After the year: `delete from private.legal_holds where user_id = '<user id>';`
     **Gap:** there's no "preserve this file" switch yet, so a user or the
     nightly clean-up could still remove a held file. Ask Code to add file
     preservation before relying on this, and ask the solicitor how evidence
     should be held.
- **Cost:** £0.
- **Check it worked:** in staging, add a hold for a test account and try
  "Delete account": it must refuse.

### 2.21 Sign off the Online Safety Act assessments

- **Who:** You (after the solicitor's comments in 2.9).
- **Do:** sign and date
  [the illegal-content risk assessment](legal/online-safety-risk-assessment.md)
  and [the children's access assessment](legal/childrens-access-assessment.md).
  The law gives a new service 3 months from its first day, but the terms,
  reporting and takedown duties apply from day one, so finish them now. Put a
  yearly reminder in your calendar.
- **Cost:** £0.
- **Check it worked:** both files have your signature line and a review date.

### 2.22 Adopt the data-protection paperwork

- **Who:** You.
- **Do:** read, correct and sign the internal records in `docs/legal/`:
  record of processing (`ropa.md`), legitimate interests
  (`legitimate-interests-assessments.md`), the appropriate policy document,
  the retention schedule, and the breach, subject access, complaints and
  defamation procedures. Start a breach log and a requests log (a
  spreadsheet is fine).
- **Cost:** £0.
- **Check it worked:** each file is signed; the two logs exist.

---

## Phase 3: Before public launch

### 3.1 Finish the solicitor's changes

- **Who:** You and Code.
- **Do:** every point from step 2.9 is applied in the app. If the Terms or
  Privacy wording changes materially, Code bumps `TERMS_VERSION` or
  `PRIVACY_VERSION`, and existing users see the re-acceptance screen.
- **Cost:** included in 2.9.
- **Check it worked:** `npm run check:launch` and `npm run check` pass, and
  the solicitor confirms in writing.

### 3.2 Employment-agency scope

- **Who:** You (with the solicitor).
- **Do:** DirectWork is probably an "employment agency" under the Employment
  Agencies Act 1973. Ask the solicitor for a scope view, and optionally email
  the Fair Work Agency (<contact@fairworkagency.gov.uk>) as its intermediary
  note invites:
  <https://www.gov.uk/government/publications/eas-note-acting-as-an-intermediary-between-persons-seeking-work-and-a-hirer/acting-as-an-intermediary-between-persons-seeking-work-and-a-hirer>.
  Keep professionals free (charging work-seekers is an offence).
- **Cost:** included in 2.9 if you brief it together.
- **Check it worked:** a written answer is saved in `docs/legal/`.

### 3.3 Backups you control

- **Who:** Code builds, You create the AWS bucket.
- **Do:** a nightly GitHub Actions job: `supabase db dump`, encrypt it, upload
  to an S3 bucket in London with Object Lock (35 days). A weekly copy of the
  Storage buckets. Then **rehearse a restore** into staging once.
- **Cost:** under $1/month.
- **Check it worked:** a restore into staging works and the app runs on it.

### 3.4 Final launch check

- **Who:** You.
- **Do:** someone works the review queue every day (the app promises
  "usually within a day"). Test the full journey on the live site with two
  accounts: sign up, list, review, apply, accept, contact reveal, report,
  block, download my data, delete account.
- **Cost:** £0.
- **Check it worked:** every step works and every email arrives.

---

## Phase 4: Before app-store submission

### 4.1 Apple and Google developer accounts

- **Who:** You.
- **Do:** enrol both **as the company**, using the D-U-N-S number from 2.2.
  - Apple Developer Program: <https://developer.apple.com/support/purchase-activation/>.
  - Google Play Console: <https://support.google.com/googleplay/android-developer/answer/6112435>.
    Organisation accounts skip the 12-tester, 14-day closed test that new
    personal accounts must run.
- **Cost:** Apple £79/year; Google $25 once.
- **Check it worked:** both consoles show the company name as the developer.

### 4.2 Decide on Apple's subscription rule (3.1.3(b))

- **Who:** You.
- **Do:** the code assumes iPhone users may use a Pro plan bought on the web.
  Apple's rule 3.1.3(b) only allows that if the same plan is **also sold as an
  in-app purchase**. Choose one:
  - (a) add Pro as an iOS in-app purchase (Apple takes 15% on the Small
    Business Program); or
  - (b) submit with billing off, and decide again before switching it on.
    Never add "upgrade on the web" links or wording inside the app.
    Rules: <https://developer.apple.com/app-store/review/guidelines/>.
- **Cost:** £0 to decide.
- **Check it worked:** the choice is recorded in `docs/OPEN_DECISIONS.md`.

### 4.3 Install expo-updates before the first store build

- **Who:** Code.
- **Do:** this lets you ship small fixes without a store review, but only if
  it is in the very first build.
  ```
  npx expo install expo-updates
  npx eas-cli update:configure
  ```
  Set `runtimeVersion: { "policy": "fingerprint" }` in `app.json` and use the
  channels `preview` and `production`.
- **Cost:** £0 (free up to 1,000 users receiving updates a month).
- **Check it worked:** a preview build picks up a test `eas update`.

### 4.4 Move the functions to Supabase's new API keys

- **Who:** Code, then You switch them on.
- **Do:** Supabase's legacy service-role key is deprecated by the end of 2026. Code moves the Edge Functions to `SUPABASE_SECRET_KEYS` and checks the
  JWT inside each function; you then turn on the new JWT signing keys in the
  dashboard. Do it before the first store build. Guide:
  <https://supabase.com/docs/guides/api/api-keys>.
- **Cost:** £0.
- **Check it worked:** the full journey (3.4) still works on staging, then on
  production.

### 4.5 Build, list and submit

- **Who:** You and Code.
- **Do:**
  1. Confirm the bundle id `com.directwork.app` (it can't change after the
     first submission).
  2. `npx eas-cli login`, `npx eas-cli init`, set the `EXPO_PUBLIC_*` values
     as EAS environment variables.
  3. `npx eas-cli build --profile preview --platform all`, test on real
     phones (sign-up link, reset link, sign out and in).
  4. Store listings: support URL, privacy policy URL
     (`https://<your domain>/legal/privacy`), the account-deletion URL Google
     requires (`https://<your domain>/legal/account-deletion`), Apple's App
     Privacy label and Google's Data safety form, the age rating, and a demo
     account for the reviewers.
  5. `npx eas-cli build --profile production`, then `npx eas-cli submit`.
- **Cost:** £0 on EAS Free (15 + 15 builds a month).
- **Check it worked:** both stores accept the build for review.

---

## Phase 5: After launch, or when something happens

| When                                                  | What                                                                                                                                                                                                                                                                                                                                                                                                                                           | Who                        | Cost                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------- |
| **Before charging anyone (billing on)**               | Get **immigration advice**: since 1 Oct 2026 an "online matching service" that charges a fee for matches can be treated as the employer of every worker matched (£45,000 per worker). Don't open any paid plan or concierge payment link until a solicitor has answered. Also: UK billing addresses only, consumer cancellation rules, Stripe receipts and policy pages, and the Apple decision (4.2). New subscription rules start 1 Jan 2027 | You + solicitor, then Code | solicitor's fee      |
| First revenue                                         | Tell HMRC (company: within 3 months of starting to trade); keep billing records 6 years                                                                                                                                                                                                                                                                                                                                                        | You                        | accountant           |
| Turnover near £90,000 a year                          | VAT registration; consider Stripe Tax                                                                                                                                                                                                                                                                                                                                                                                                          | You                        | 0.5% per transaction |
| Each year, and before any big feature change          | Review the Online Safety Act risk assessment and children's access assessment                                                                                                                                                                                                                                                                                                                                                                  | You                        | £0                   |
| Each new Expo SDK                                     | Upgrade within 6–8 weeks (as in 1.5)                                                                                                                                                                                                                                                                                                                                                                                                           | Code                       | £0                   |
| More than 1,000 users getting updates, or slow builds | Expo Starter                                                                                                                                                                                                                                                                                                                                                                                                                                   | You                        | $19/month            |
| More than 5,000 errors a month, or a second engineer  | Sentry Team                                                                                                                                                                                                                                                                                                                                                                                                                                    | You                        | $26/month            |
| A second person on support, or 20+ emails a week      | Fastmail with EU data storage                                                                                                                                                                                                                                                                                                                                                                                                                  | You                        | £4.50/person/month   |
| Losing a day's data becomes unacceptable              | Supabase point-in-time recovery                                                                                                                                                                                                                                                                                                                                                                                                                | You                        | about $100/month     |
| Anyone in the EU targeted (EU stores, EU pricing)     | EU representative, EU VAT, Digital Services Act; stay UK-only until then                                                                                                                                                                                                                                                                                                                                                                       | You + solicitor            | varies               |
| A personal-data breach                                | `docs/legal/breach-procedure.md` (ICO within 72 hours)                                                                                                                                                                                                                                                                                                                                                                                         | You                        | £0                   |
| A data request or complaint                           | `docs/legal/subject-access-procedure.md`, `docs/legal/complaints-procedure.md`                                                                                                                                                                                                                                                                                                                                                                 | You                        | £0                   |
| A defamation complaint                                | `docs/legal/defamation-notice-procedure.md` (48-hour steps)                                                                                                                                                                                                                                                                                                                                                                                    | You                        | £0                   |
| Suspected CSEA                                        | Step 2.20                                                                                                                                                                                                                                                                                                                                                                                                                                      | You                        | £0                   |
