# Operations: running DirectWork hands-off

Written 2026-11-12 for the owner. It covers what runs by itself, the 15
minutes a month that are yours, the settings that cap every bill, and what to
do when something goes wrong. Set-up steps live in
[NEXT_STEPS.md](NEXT_STEPS.md); this file is for after they are done.

Four standing rules, each backed by an automated check:

| Rule                                        | What enforces it                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| No surprise bills                           | Spend caps and budgets in section 3. Every paid service is either capped or fixed-price.                                              |
| No leaked secret keys                       | The pre-commit hook, two CI secret scans, `.gitignore`, and a test that fails if client code reads a non-public variable (section 4). |
| No message to a user without permission     | A test that fails if any email, SMS or push package or API call appears (section 5).                                                  |
| Nothing a stranger can run up or knock over | Cloudflare in front of the web app; rate limits, a 3-second query timeout and row-level security behind the API (section 6).          |

Prices marked † were checked on 2026-11-05 for NEXT_STEPS.md and not
re-checked here. The Supabase cost-control, Expo pricing, gitleaks and
Turnstile pages were read on 2026-11-12; the Cloudflare, AWS, GitHub and ICO
points were not re-read that day. Prices
change: look at the linked page before you rely on a number.

---

## 1. What runs by itself

| Job                        | When                              | What it does                                                                                                                                             | How you know it broke                                                                  |
| -------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Retention (`pg_cron`)      | 03:17 daily, in the database      | Deletes expired activity, old rejected or withdrawn applications and resolved reports (`docs/legal/retention-schedule.md`).                              | Integrations > Cron shows a failed run for `directwork-retention`.                     |
| Maintenance function       | 03:47 daily, once you schedule it | Runs retention and deletes files nobody references any more. **Not scheduled until you do NEXT_STEPS 2.15.**                                             | `select status_code from net._http_response order by created desc limit 1;` is not 200 |
| Database backups           | Daily (Supabase Pro)              | Seven days of backups.                                                                                                                                   | Database > Backups shows no backup for yesterday.                                      |
| Dependabot                 | Monthly                           | Opens up to three grouped update PRs (npm and GitHub Actions). Expo packages are left to `npx expo install --fix`.                                       | No PRs for two months.                                                                 |
| CI on every PR and on main | On push                           | Lint, types, formatting, unit tests, database tests, Edge Function tests, the dependency audit gate, two secret scans and a web build with the real CSP. | A red cross on the PR. Don't merge red PRs.                                            |
| Rate limits and timeouts   | Always                            | Per-user limits on every Edge Function; 3-second statement timeout for signed-in queries; Supabase Auth's own limits.                                    | Users report "You're doing that too often".                                            |

Nothing above sends anything to a user outside the app.

---

## 2. The monthly 15-minute checklist

Put a recurring calendar entry on the 1st of each month.

1. **GitHub (3 min).** Merge the Dependabot PRs if CI is green. If one is
   red, leave it and ask Code to look. Check the Security tab for alerts.
2. **Supabase usage (3 min).** Organisation > Usage. Every bar should be
   well under its quota. Organisation > Billing: the **spend cap is still
   ON** and the upcoming invoice is the plan price and nothing else.
3. **Supabase health (3 min).** Integrations > Cron: both jobs succeeded
   last night. Database > Backups: yesterday's backup exists. Advisors >
   Security: no new warnings.
4. **AWS (2 min).** Billing > Bills: SES is pennies. SES > Reputation:
   bounce rate under 5%, complaint rate under 0.1%.
5. **Review queue and reports (2 min).** In the app, the review and
   moderation screens are empty or being worked. (This one is daily while
   listings are coming in: the app promises "usually within a day".)
6. **Renewals (2 min).** Look at the table in section 3.3 for anything due
   in the next 60 days.

Every three months: run `npm run audit:prod` and look at
`.github/audit-allowlist.json`. Entries expire on purpose; an expired entry
turns CI red until someone fixes or re-justifies it.

---

## 3. Settings that cap every bill

### 3.1 Supabase

- **Spend cap: ON.** Organisation **DirectWork** > Billing > Cost Control >
  Spend cap. It is on by default on Pro; never turn it off.
  - With the cap on, when a usage item goes over its quota, further use of
    that item is blocked until the next billing cycle. You are not charged
    for the overage; the service is restricted instead. For users that
    means errors (for example images not loading once egress is used up)
    until the cycle resets or you choose to lift the cap.
  - Covered by the cap: disk size, egress, Edge Function invocations, logs,
    monthly active users, Realtime, storage size and image transformations.
  - **Not covered** (you only pay for these if you switch them on, so
    don't): extra compute, branching, read replicas, custom domain, extra
    disk IOPS, a dedicated IPv4 address, log drains, phone MFA and
    point-in-time recovery.
  - Source: <https://supabase.com/docs/guides/platform/cost-control>
- **Keep one project in the paid organisation.** Compute is billed per
  project and is outside the cap. Pro includes credit for one small
  project; a second project in the same organisation adds a monthly compute
  charge. That is why staging sits in its own free organisation
  (NEXT_STEPS 1.6). Don't create branches or extra projects under
  **DirectWork**.
- **Usage alerts.** Supabase's cost-control page says the spend cap does not
  offer notifications when a cost threshold is reached, and recommends the
  usage page instead. So: (a) the monthly check in section 2 is the alert,
  and (b) Organisation > Billing > make the **billing email** an address
  you read, because quota and invoice emails go there. With the cap on, the
  worst case of missing an alert is a restricted service, never a bill.
- **Cost:** $25/month† plus VAT. No annual commitment.

### 3.2 Amazon SES (the only thing that sends email)

SES has no hard spend cap, so the limit is set where the emails start:

- **Supabase Auth rate limit** (Authentication > Rate Limits > emails per
  hour): 100–200. This is the real ceiling. At 200 an hour, round the
  clock, for a month, that is about 149,000 emails, or roughly $15 at SES's
  $0.10 per 1,000†. An attacker can't make it send more.
- **Per-address throttle:** one confirmation or reset email per address per
  minute (`max_frequency` in the Auth settings). Keep it.
- **SES sending quota:** leave it at whatever AWS grants. Don't ask for an
  increase you don't need.
- **SMTP credentials:** the IAM user SES creates for SMTP can only send
  mail. Don't reuse it or attach other policies.
- **AWS Budgets alert at £5:** Billing and Cost Management > Budgets >
  Create budget > "Monthly cost budget", amount **$6** (AWS bills in
  dollars), alerts at 50%, 80% and 100% of actual cost and 100% of
  forecast, to your email. A budget alerts; it does not stop spending. The
  rate limit above is what stops it.
- Use the AWS account for SES and nothing else until backups (NEXT_STEPS
  3.3) are added, so any other line on the bill is a red flag.

### 3.3 Every recurring charge

Fill in the last column the day you pay each one, and put the date in your
calendar two weeks early.

| What                                               | Amount                        | How often           | Can it grow by itself?                                                            | Renewal date                       |
| -------------------------------------------------- | ----------------------------- | ------------------- | --------------------------------------------------------------------------------- | ---------------------------------- |
| Supabase Pro (production)                          | $25† + VAT                    | Monthly             | No, with the spend cap on and one project                                         | [day of month]                     |
| Supabase (staging)                                 | £0                            | –                   | No (free plan has no billing)                                                     | –                                  |
| Amazon SES                                         | About $0.10 per 1,000 emails† | Monthly, in arrears | Only up to the Auth email rate limit (about $15 worst case)                       | –                                  |
| Cloudflare (web hosting, DNS, DDoS, email routing) | £0                            | –                   | No (free plan; static assets are not metered)                                     | –                                  |
| Domain (`.com` at Cloudflare)                      | About $11†                    | Yearly              | No. Turn auto-renew ON so it can't lapse                                          | [date]                             |
| Expo EAS                                           | £0                            | –                   | No. Free plan has no overage pricing; builds and updates just stop at the limit   | –                                  |
| Apple Developer Program                            | £79†                          | Yearly              | No. If it lapses the iOS app is removed from sale                                 | [date]                             |
| Google Play Console                                | $25†                          | Once                | No                                                                                | –                                  |
| ICO data protection fee                            | £52† (£47 by direct debit)    | Yearly              | No. Not paying is a fine of up to £4,000                                          | [date; a year after first payment] |
| Companies House confirmation statement             | £50†                          | Yearly              | No. Late filing can get the company struck off                                    | [date; a year after incorporation] |
| Company accounts and tax return                    | £0 if you file yourself       | Yearly              | Late-filing penalties start at £150                                               | [date]                             |
| GitHub                                             | £0                            | –                   | No, while no payment method is on the account. Actions stop at the free allowance | –                                  |
| Stripe                                             | £0 fixed (a % per payment)    | –                   | Billing is off. No charges until you clear the billing gate (NEXT_STEPS Phase 5)  | –                                  |
| Sentry (optional)                                  | £0                            | –                   | No. Events are dropped over the free quota                                        | –                                  |

Expo free plan limits, for reference: 15 Android and 15 iOS builds, updates
to 1,000 monthly active users, 100 GiB bandwidth. "The Free plan has no
update overage pricing; it is limited to its included monthly active users."
Starter is $19/month if you outgrow it. Source: <https://expo.dev/pricing>

Rules that keep this table true:

- Don't add a payment card to a service that works without one (GitHub,
  Expo, Cloudflare, Sentry).
- Don't accept an "upgrade" or "add-on" prompt in any dashboard without
  adding it to this table first.
- A virtual card with a monthly limit (most UK business accounts offer one)
  for Supabase and AWS is a cheap last line of defence.

---

## 4. Secret keys

**What is public, by design:** `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `EXPO_PUBLIC_BILLING_ENABLED`.
They are compiled into the app and anyone can read them. Row-level security
is what protects the data, not these values.

**What is secret, and where it lives** (never in this repo, never in an
`EXPO_PUBLIC_` variable, never in a chat or an email):

| Secret                                              | Lives in                                       |
| --------------------------------------------------- | ---------------------------------------------- |
| Supabase secret / service-role key                  | Supabase only (functions get it automatically) |
| Database password                                   | Password manager                               |
| `MAINTENANCE_SECRET`                                | Supabase function secrets + Vault              |
| Stripe keys and webhook secret (when billing is on) | Supabase function secrets                      |
| SES SMTP username and password                      | Supabase Auth SMTP settings                    |
| Cloudflare API token                                | GitHub Actions secret                          |
| Apple and Google signing keys                       | Expo EAS (let EAS manage them)                 |

**Guards in the repo:**

1. **Pre-commit hook.** Run once per clone:

   ```
   npm run hooks:install
   ```

   (It runs `git config core.hooksPath scripts/git-hooks`; git can't turn
   hooks on by itself. On macOS or Linux also run
   `chmod +x scripts/git-hooks/pre-commit`.) From then on every commit runs
   `scripts/secret-scan.js` on the staged files and refuses the commit if
   it sees a Supabase secret key, a service-role token, a Stripe live key,
   an AWS key, a private key, a GitHub token, or a file such as `.env` or
   `*.p8`. It prints the file and line, never the secret.

2. **CI, two scans.** `npm run scan:secrets` (the same rules over every
   tracked file) and **gitleaks** over the full history.
   - Why gitleaks: it is the most widely used open-source scanner, and its
     official GitHub Action needs no licence key for repositories owned by
     a personal account ("If you are scanning repos that belong to a
     personal account, then no license key is required":
     <https://github.com/gitleaks/gitleaks-action>).
   - **If the repository moves to a GitHub organisation** (for example when
     the company is formed), the action needs a licence key. It is free:
     request it at <https://gitleaks.io>, then add it as the repository
     secret `GITLEAKS_LICENSE`. Until you do, that CI job fails; the
     project's own scan keeps working either way.
   - Also turn on GitHub's own **secret scanning and push protection**
     (repository Settings > Advanced Security). It is free for public
     repositories; for a private repository on a free account it may not be
     offered, which is why the two scans above exist.

3. **`.gitignore`** covers `.env*` (except `.env.example`), `*.pem`,
   `*.p8`, `*.p12`, `*.jks`, `*.keystore`, `signing_keys.json`,
   `google-services.json` and `GoogleService-Info.plist`.

4. **Test.** `scripts/__tests__/security-guards.test.ts` fails if any file
   under `app/`, `features/`, `lib/` or `components/` reads an environment
   variable that isn't `EXPO_PUBLIC_*`, mentions `service_role` or
   `sb_secret`, or adds a fourth public variable without the test being
   updated.

**Dependencies.** `npm run audit:prod` fails CI on any high or critical
advisory in production dependencies. Exceptions go in
`.github/audit-allowlist.json` with the advisory id, package, reason and an
expiry date; an entry past its date fails CI again. To fix advisories run
`npm audit fix` (never `--force`: it downgrades Expo), then
`npx expo install --check`.

---

## 5. No unsolicited communications

**The product cannot send email, SMS or push notifications.** There is no
mail, SMS or push package in `package.json`, no `expo-notifications`, no
notification permission in `app.json`, and no code that calls a mail, SMS or
push service. The Edge Functions make exactly one kind of outbound request
(to Stripe, for billing). "Notifications" in DirectWork are rows in the
in-app Activity list, seen only when the person opens the app.

`scripts/__tests__/security-guards.test.ts` ("no unsolicited
communications") fails if any of that changes: a banned package, a mail/SMS/
push API host, SMTP use, a push-token call, a database-side HTTP call, or a
server-side Supabase Auth call that would send a message. Someone adding
email later has to edit that test on purpose, and that is the moment to ask
for your permission.

**The only emails** are Supabase Auth's own, sent through SES:

- confirm your email address (after the person signs up, or asks for the
  email again), and
- reset your password (after the person asks for it).

Under the Privacy and Electronic Communications Regulations (PECR) the
consent rules apply to **direct marketing**. These are service messages:
each is sent because the person just asked for it, each is needed to use the
account, and neither promotes anything. Keep them that way:

- Don't add offers, "invite a friend", news or app-store links to the
  templates (Authentication > Emails > Templates). One link, plain text.
- Leave open and click tracking off in SES (NEXT_STEPS 2.10).
- Don't export user emails into a mailing tool. A newsletter or launch
  announcement to users is marketing: it needs opt-in consent (or the narrow
  "soft opt-in"), an unsubscribe link, and a decision from you first. The
  waitlist on the landing page is separate and needs its own consent wording.
- In the Supabase dashboard, leave phone sign-in, SMS providers and the
  "Send email" / "Send SMS" Auth hooks off. `supabase/config.toml` has them
  off and the test checks it, but the hosted dashboard is the source of
  truth.

ICO guidance on what counts as direct marketing:
<https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/>

---

## 6. Denial-of-service and abuse

**Web app: behind Cloudflare.** The static site is served from Cloudflare's
network on the free plan, which includes unmetered DDoS protection: there is
no bandwidth bill and no charge for attack traffic
(<https://www.cloudflare.com/plans/>). Static asset requests are free. An
attack on `https://<your domain>` costs you nothing.

**API: not behind your Cloudflare. Be clear-eyed about this.** The app talks
straight to `https://<project ref>.supabase.co`. That host name is public
(it is in the app) and you can't put your own Cloudflare rules in front of
it without a paid add-on. What protects it:

- Supabase's own platform protection and per-IP limits on Auth endpoints.
- The spend cap: a flood can exhaust a quota and degrade the service for the
  rest of the cycle, but it cannot create a bill.
- Row-level security written so one request can't scan a whole table, and a
  **3-second statement timeout** for signed-in queries, so a costly query is
  cut off.
- Per-user rate limits on every Edge Function (actions 60/min, billing
  10/min, account deletion 3/hour), a 16 KB body cap, and a cheap token
  pre-check so junk requests never reach Auth.
- Edge Functions answer browsers only from the origins in `ALLOWED_ORIGINS`
  (never `*`). Only `billing-webhook` (Stripe signature) and `maintenance`
  (secret header) skip the gateway's JWT check, and neither answers browsers
  at all. Tests cover both.
- Sign-up needs a confirmed email; emails are limited per address and per
  hour.

What is left: a determined attacker could make the API slow or use up the
month's egress, and users would see errors until you act (section 7) or the
cycle resets. That is an availability risk, not a cost or data risk.

**Web security headers** (`public/_headers`): a Content-Security-Policy that
only allows scripts from the site itself and connections to the one Supabase
project, plus HSTS, no-sniff, frame blocking and cross-origin isolation
headers. Deploy with **`npm run build:web`**, not a bare `expo export`: it
writes the Supabase host from `EXPO_PUBLIC_SUPABASE_URL` into the policy and
fails if it can't. If the placeholder `SUPABASE_PROJECT_HOST` ever reached
production, the site would load but every request would be refused; rebuild
with the variable set. The browser console shows one "refused to evaluate"
report per page load from a library probing for `eval`; it is expected and
harmless, and the fix is not to allow `eval`.

### CAPTCHA (optional, not built)

Cloudflare Turnstile on sign-up and password reset was assessed on
2026-11-12 and **not implemented**:

- Supabase enforces CAPTCHA for the whole project: once it is on, every
  sign-up, sign-in and reset must carry a token, including from the iOS and
  Android apps.
- Turnstile has no native SDK. Cloudflare's guidance is that "for native
  mobile applications, Turnstile does not run natively": the app must embed
  a WebView that loads a web page containing the widget
  (<https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/>).
  That means a new native dependency (`react-native-webview`), a hosted
  challenge page, message passing between the two, and a sign-up flow that
  breaks if any part fails. It would also loosen the Content-Security-Policy
  (Cloudflare's script and frame origins).
- The risk it addresses is already bounded: Auth's per-IP limits, the
  per-hour email cap and email confirmation.

Turn it on only if you see a real sign-up flood (hundreds of unconfirmed
accounts a day in Authentication > Users). Then ask Code to: add the widget
to the three web forms and the WebView for native, pass `captchaToken` to
`signUp`, `signInWithPassword` and `resetPasswordForEmail`, add
`https://challenges.cloudflare.com` to `script-src` and `frame-src`, ship
the apps, **wait until most users have updated**, and only then enable
Authentication > Attack Protection > CAPTCHA with the Turnstile secret.
Enabling it first locks every existing app out of sign-in.

---

## 7. Incidents

Do the first line of each block straight away; the rest can wait an hour.

### A complaint about the public pay record

Turn it off for everyone, instantly, no app release. SQL Editor, production:

```sql
update private.feature_flags set enabled = false, updated_at = now()
  where key = 'pay_record_public';
```

The app then shows "no record yet" everywhere. Set `enabled = true` to turn
it back on. Then follow `docs/legal/defamation-notice-procedure.md`.

### A sign-up flood, spam accounts, or the API under attack

1. **Pause sign-ups:** Authentication > Sign In / Providers > turn off
   **"Allow new users to sign up"**. Existing users carry on; nobody new
   can register. Turn it back on when it stops.
2. Authentication > Rate Limits: lower "sign-ups and sign-ins" and
   "emails per hour".
3. If the web app itself is being hit: Cloudflare > your domain > Security >
   turn on **Under Attack Mode**.
4. Check Organisation > Usage. If a quota is exhausted the service is
   already restricted; **don't turn the spend cap off** to "fix" it while
   an attack is running.
5. Last resort: Project Settings > General > **Pause project**. Everything
   stops, nothing is lost.
6. Supabase support: <https://supabase.com/dashboard/support/new>.

### A secret key may have leaked

Rotate first, investigate second. Deleting the commit is not enough: assume
anything pushed has been copied.

| Key                                 | How to rotate                                                                                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase secret or service-role key | Project Settings > API Keys: create a new secret key, delete the old one. Redeploy the functions if they hold a copy. For a legacy `service_role` JWT, rotate the JWT secret (this signs everyone out). |
| Database password                   | Project Settings > Database > Reset database password.                                                                                                                                                  |
| `MAINTENANCE_SECRET`                | Make a new one (NEXT_STEPS 2.14), `npx supabase secrets set MAINTENANCE_SECRET=...`, and update the Vault secret the cron job reads (2.15).                                                             |
| Stripe keys                         | Stripe > Developers > API keys > Roll key; Webhooks > roll the signing secret. Update the function secrets.                                                                                             |
| SES SMTP credentials                | AWS IAM > the SMTP user > delete the access key; SES > SMTP settings > create new credentials; paste them into Supabase Auth > SMTP.                                                                    |
| Cloudflare API token                | My Profile > API Tokens > Roll. Update the GitHub secret.                                                                                                                                               |
| GitHub token                        | Settings > Developer settings > revoke.                                                                                                                                                                 |
| The publishable key                 | Not a secret. No action.                                                                                                                                                                                |

Then: check the service's logs for use you don't recognise, and if personal
data may have been reached, start `docs/legal/breach-procedure.md` (the ICO
clock is 72 hours from when you became aware).

### An unexpected charge

1. Find the line item (Supabase: Organisation > Billing > upcoming invoice.
   AWS: Billing > Bills).
2. Supabase: confirm the spend cap is on and no add-on (compute, IPv4, PITR,
   branching, a second project) was switched on. Switch it off.
3. AWS: if it isn't SES, something else is running. Delete it, and rotate
   the AWS credentials.
4. Add what you learned to the table in section 3.3.

### A bad release

Web: in Cloudflare, roll back to the previous deployment. Apps: once
`expo-updates` is in (NEXT_STEPS 4.3), republish the previous update.
Database migrations are never edited after they are applied; a fix is a new
migration.

### Illegal content, a data request, a breach

`docs/NEXT_STEPS.md` 2.20 (legal hold and NCA report),
`docs/legal/subject-access-procedure.md`, `docs/legal/breach-procedure.md`.
