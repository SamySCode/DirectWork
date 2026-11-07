# Stack: vendor decision record

Decided 2026-11-07, from the lead engineer's review of 2026-11-05. This page
records what we use, why, what came second, what it costs and how we'd leave.
Change a row only with a written reason. The step-by-step setup is in
`docs/NEXT_STEPS.md`.

The brief behind every choice: the most proven option, as few subscriptions
and as little lock-in as possible, UK data where it's cheap to get, and
Supabase as the backend (no custom server).

| Area                              | Choice                                                                                                                                          | Why                                                                                                                                                                            | Runner-up                                                              | Cost at launch                                                                | Cost at ~10k users                                                                             | Exit path                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Backend and database              | **Supabase**. New production project in **London (eu-west-2)**; the current Ireland project becomes **staging** in its own free org             | Postgres, Auth, Storage and Edge Functions from one vendor. Our security model (RLS, column grants, tests) is plain Postgres. London keeps the main copy of the data in the UK | Neon + a separate auth service + Cloudflare R2 (3 vendors, rework RLS) | $0 until the first real user, then **Pro $25/month** (includes Micro compute) | $25–60/month                                                                                   | `supabase db dump` restores into any Postgres 17; self-hosted Supabase runs the same code |
| Backups                           | Supabase Pro daily backups (7 days), plus a nightly encrypted dump to AWS S3 London with Object Lock, plus a weekly copy of the Storage buckets | Supabase backups don't include Storage files and can be deleted with the project; an immutable off-site copy survives a stolen password                                        | Cloudflare R2                                                          | under $1/month                                                                | $1–3/month (point-in-time recovery ~$100/month only if a day's data loss becomes unacceptable) | Plain SQL dump files                                                                      |
| Sign-in                           | **Supabase Auth**: email and password, minimum 10 characters, leaked-password check (Pro), TOTP two-factor for admins                           | Built in, no extra vendor; passkeys later when Supabase makes them generally available                                                                                         | —                                                                      | included                                                                      | included                                                                                       | Users and password hashes export with the database                                        |
| Account emails                    | **Amazon SES, London**, as Supabase's custom SMTP. SPF, DKIM and DMARC on a `mail.` subdomain; open and click tracking off                      | Cheapest proven sender with a UK region; built-in bounce and complaint suppression                                                                                             | Postmark (about $15/month, US-only data)                               | ≈ $0 (10p per 1,000 emails; new accounts get credits)                         | $1–5/month                                                                                     | Change four SMTP fields in Supabase to Postmark or Mailgun                                |
| Web hosting                       | **Cloudflare Workers Static Assets** (Pages is equivalent) serving `npx expo export --platform web`                                             | Static files are served free and unlimited; works with our `public/_headers`; same account as DNS                                                                              | EAS Hosting (100k requests/month cap)                                  | $0                                                                            | $0                                                                                             | The output is a plain folder; any static host works                                       |
| Domain and DNS                    | **Cloudflare Registrar + DNS**                                                                                                                  | Sold at cost, free WHOIS privacy, one-click DNSSEC                                                                                                                             | Porkbun                                                                | ~$11/year per .com (.co.uk: register elsewhere and transfer in)               | same                                                                                           | Domains transfer to any registrar                                                         |
| support@ and privacy@ mailboxes   | **Cloudflare Email Routing** to your existing inbox; Fastmail later                                                                             | Free, no new account                                                                                                                                                           | Google Workspace                                                       | $0                                                                            | £4.50/person/month with Fastmail once a second person handles support                          | Change the MX records                                                                     |
| Error monitoring (optional)       | **Sentry, EU (Frankfurt) region**, with personal data scrubbed                                                                                  | Covers web and native; EU storage on the free plan                                                                                                                             | Expo Observe (no web, paid tier for errors)                            | $0 (5k errors/month, 1 user)                                                  | $26/month (Team)                                                                               | Remove the SDK; errors are not business data                                              |
| Uptime                            | Sentry Uptime (1 free monitor) plus Supabase status alerts                                                                                      | No extra account                                                                                                                                                               | UptimeRobot / Better Stack free                                        | $0                                                                            | ~$1 per extra monitor                                                                          | Nothing to move                                                                           |
| Payments (off until legal advice) | **Stripe Checkout + Billing**, web only, UK billing addresses only                                                                              | Already built; lowest fees for UK cards; Stripe Tax can be added at VAT registration                                                                                           | Paddle (merchant of record, ~6% vs ~3%)                                | per sale: ≈ 84p on £29 (1.5% + 20p card fee + 0.7% Billing)                   | same                                                                                           | Subscriptions can be migrated; our data model stores only plan status                     |
| Mobile builds and updates         | **EAS Build, Submit and Update** with `expo-updates` (fingerprint runtime)                                                                      | Made for Expo; builds iOS from Windows; over-the-air fixes                                                                                                                     | Xcode Cloud + local Gradle (needs a Mac)                               | $0 (15 + 15 builds/month, 1,000 update users)                                 | $19/month Starter                                                                              | `npx expo prebuild` gives normal native projects                                          |
| Analytics                         | **None from a third party.** Metrics come from SQL                                                                                              | No cookie banner, no extra processor, nothing to disclose                                                                                                                      | Plausible (web only, later)                                            | $0                                                                            | $0                                                                                             | —                                                                                         |
| Secrets                           | EAS environment variables, Supabase function secrets, GitHub Environments, a password manager and hardware keys for vendor logins               | No extra vendor                                                                                                                                                                | Doppler / Infisical                                                    | $0                                                                            | $0                                                                                             | —                                                                                         |
| CI and dependency updates         | **GitHub Actions + Dependabot** (already set up). Expo SDK upgrades by hand with `npx expo install --fix`                                       | Already configured; bots can't run `expo install --fix`                                                                                                                        | Renovate                                                               | $0                                                                            | $0–low                                                                                         | Standard YAML                                                                             |
| App stores                        | Apple Developer Program and Google Play, **both as an organisation** (needs a free D-U-N-S number)                                              | The company, not you personally, is shown as seller; organisation Google accounts skip the 12-tester, 14-day closed test                                                       | Personal accounts (rejected)                                           | £79/year (Apple) + $25 once (Google)                                          | same                                                                                           | Apps can be transferred between accounts, with effort                                     |

## Totals

- **Accounts you hold: 9.** GitHub (have it), Supabase (one login, two
  organisations), Cloudflare, AWS, Stripe, Expo, Sentry, Apple Developer,
  Google Play Console. Sentry is optional, so 8 is the floor.
- **Fixed subscriptions at launch: 2.** Supabase Pro ($25/month) and Apple
  Developer (£79/year). Everything else is free or pay-per-use.
- **Optional later:** Expo Starter ($19/month, past 1,000 update users),
  Sentry Team ($26/month, past 5k errors/month or a second engineer),
  Fastmail (£4.50/month per person).
- **Likely running cost:** about £34/month (including VAT on the Supabase
  invoice) from launch to roughly 10,000 users, about £64/month at 100,000
  (finance model, likely case). Stripe fees are on top, per sale.
- **Cash to launch:** about £153 up front (Google Play, first year of Apple,
  ICO fee, a .com), plus £100 to incorporate a company, plus the solicitor
  (£750–£3,000 estimate).

Why not fewer accounts: dropping AWS would move email to Cloudflare's email
service, which is still in beta, and that service gates sign-up. Dropping
Sentry leaves the web app with no crash reporting.

## Deadlines that come from these choices

- **Supabase legacy API keys are deprecated by the end of 2026.** The Edge
  Functions still read `SUPABASE_SERVICE_ROLE_KEY`; move them to the new
  secret keys and asymmetric JWT signing keys before the first store build
  (<https://supabase.com/docs/guides/api/api-keys>).
- **The region can't be changed later without a new project**, and the
  project URL is compiled into every mobile build. Create the London project
  before any real data or store build exists.
- **`expo-updates` must be in the first store build**, or the first fix
  needs a full store release.
- **Stay at most one Expo SDK behind.** Expo Go only runs the latest SDK,
  and Google Play raises its target API level every year.

## Sources

Supabase pricing <https://supabase.com/pricing>, regions
<https://supabase.com/docs/guides/platform/regions>, backups
<https://supabase.com/docs/guides/platform/backups>; SES pricing
<https://aws.amazon.com/ses/pricing/>; Cloudflare Registrar
<https://developers.cloudflare.com/registrar/>, Email Routing limits
<https://developers.cloudflare.com/email-routing/limits/>; Sentry data
location <https://docs.sentry.io/organization/data-storage-location/>,
pricing <https://sentry.io/pricing/>; Stripe UK pricing
<https://stripe.com/gb/pricing>; Expo pricing <https://expo.dev/pricing>.
All checked by the team on 2026-11-05.
