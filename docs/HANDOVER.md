# Handover

Written 2026-11-16 at the end of a long build session, so that nothing
depends on remembering that conversation. It records context that is not
written anywhere else. For what to do next, read `docs/ROADMAP.md` and
`docs/tasks/README.md`.

## Where everything is

| What                                                      | Where                                               |
| --------------------------------------------------------- | --------------------------------------------------- |
| Plan, phases, the day-90 stop-or-continue test            | `docs/ROADMAP.md`                                   |
| Work items, one per cheap session                         | `docs/tasks/`                                       |
| How to work with Claude without burning usage             | `docs/WORKING_WITH_CLAUDE.md`                       |
| Step-by-step launch setup (accounts, deploys, legal)      | `docs/NEXT_STEPS.md`                                |
| Bills, caps, monthly checklist, incidents                 | `docs/OPERATIONS.md`                                |
| Decisions made and still open                             | `docs/OPEN_DECISIONS.md`                            |
| Security design and every hardening pass                  | `docs/ACCESS_CONTROL.md`                            |
| Legal drafts to sign                                      | `docs/legal/`                                       |
| Marketing: messaging, copy, videos, competitors, launch   | `docs/marketing/`                                   |
| Deal Sheet design and its legal safeguards                | `docs/specs/deal-sheet.md`                          |
| The twelve review reports, preview scripts, owner's notes | `.private/` (on this computer only, never pushed)   |
| Cost dashboard                                            | <https://claude.ai/artifact/6JAFQeSLbnurv79ApHpNsn> |

## State on 2026-11-16

- All work is on the branch `build/launch-hardening`, which is pushed to
  GitHub. **It is not merged**: `main` (the branch GitHub shows first)
  still holds the older version until a pull request from
  `build/launch-hardening` into `main` is opened and merged at
  <https://github.com/SamySCode/DirectWork/compare/main...build/launch-hardening>.
- Checks: 703 app tests, 127 database tests, 75 server-function tests,
  dependency and secret scans, all passing.
- Nothing newer than migration `20261105100000` is applied to any
  Supabase project. The one hosted project (`zgoqieldstaisvudndda`,
  Ireland, Free plan) is the future staging copy; the London production
  project does not exist yet.
- No web deployment, no domain, no custom email, no store accounts.
  Billing is off. The app is free.
- Tasks done: T01, T08, T13. Next: T02 and T03 (accessibility), T07
  (founder metrics), then T04 (Expo SDK 58, before 31 January 2027).

## Why things are the way they are

Short reasons for choices a future session might otherwise undo.

- **Free at launch, billing off.** Since 1 October 2026 a UK "online
  matching service" that charges a fee for matches can be treated as the
  employer for right-to-work checks (fines up to £60,000 per worker).
  Whether a listing fee or subscription counts is unanswered. The free
  route to an answer is the Home Office Employer Enquiry Helpline.
  Consumer subscription rules also change on 1 January 2027 and the
  checkout is not built for them.
- **Price.** £29 a month was a placeholder the owner rejected as too
  expensive. The test price is £9. The competitor review recommends a
  different first product: a paid Deal Sheet toolkit for owners, because
  it is a fee for documents, not for a match.
- **No paid solicitor before launch.** Free routes are used instead
  (`docs/NEXT_STEPS.md` step 2.9). The legal drafts say "for solicitor
  review"; the owner can still sign them as the accountable person.
- **"Paid on time" record.** Shown as a plain count ("Paid on time on 4
  of 5 reported payments, reported by professionals"), never as a badge
  or a judgement. The owner considered a "good payer" badge and decided
  against it: a badge is DirectWork's own verdict, which the legal
  defences for hosting user content do not cover. A kill switch turns
  the record off at once:
  `update private.feature_flags set enabled = false where key = 'pay_record_public';`
- **No disclaimer removes defamation risk.** Protection comes from
  following the notice procedure in `docs/legal/defamation-notice-procedure.md`,
  the dispute route, consent given when an owner confirms a Deal Sheet,
  and showing only undisputed facts.
- **18 and over.** A self-declared tick box at sign-up. The written
  children's access assessment in `docs/legal/` is still required; the
  tick box alone is not enough under the Online Safety Act.
- **No CAPTCHA.** Cloudflare Turnstile does not run inside phone apps
  without an embedded web page, and Supabase enforces CAPTCHA for every
  client at once, which could lock the apps out of sign-in.
- **No messages to users.** Only sign-up confirmation and password
  reset. Guard tests fail if email, text or push sending is added. The
  competitor review says retention may need opt-in email digests; that
  is a decision for after day 90.
- **Remembered sign-in email is opt-in** (added 2026-11-17). An unticked
  box on sign-in; unticking deletes it at once. It isn't strictly
  necessary, so PECR needs consent, and the Privacy and Cookies & Storage
  notices say so (Privacy version 2026-11-17). Never pre-tick it or store
  the email without the tick.
- **Images.** 2 MB limit, device-made thumbnails for lists. A one-year
  cache was rejected because deleted photos would stay reachable.
- **Thumbnails, privacy checks and the 3-second query limit** exist to
  keep database and bandwidth cost flat as users grow and to blunt abuse.
- **Moderation cannot be fully hands-off.** The Online Safety Act
  expects a person to review reports and listings.
- **The Supabase address cannot sit behind the owner's Cloudflare.** It
  relies on Supabase's own protection plus the app's limits. With the
  spend cap on, the worst case is a slowed service, not a bill.
- **Launch is online only** (no events or meetings), so the plan is
  `docs/marketing/online-launch.md` and the expected numbers are lower.
- **This is an experiment with a stop point**, not a business yet. The
  competitor review put the odds of one city becoming self-sustaining at
  under one in five; the online plan put meeting the day-90 thresholds
  at about one in ten.

## Open decisions (the owner has not answered these)

1. Decided 2026-11-17: UK-wide product, with ads geo-targeted to the
   Leeds and Bradford area and the University of Bradford (the owner's
   old university) as the first partner to approach. The narrower niche
   suggested by the online plan is not adopted.
2. Day-90 thresholds: keep 8 confirmed outcomes and 35 listings, or
   lower them for an online-only launch (suggested: 3 and 15) while
   keeping a fixed stop point.
3. Run as an individual for now, or form a limited company before
   launch. Advice given: individual is fine while the app is free; form
   the company before taking money, signing partner agreements, or
   passing a few hundred active users.
4. Whether the waitlist collects email addresses (needs an opt-in box
   and a privacy notice line) or links straight to sign-up.
5. Whether owner profiles show business details (Companies House
   number, Fair Payment Code) before launch or after day 90.
6. What happens to the other person's track record when someone deletes
   their account (today it is deleted too).
7. Apple: sell Pro inside the iPhone app, or ship the iPhone app with
   billing off.

## Things only the owner can do

In rough order. Details are in `docs/NEXT_STEPS.md`.

1. Open a pull request from `build/launch-hardening` into `main` and
   merge it (the branch itself is already pushed).
2. Run `npm run hooks:install` once (switches on the secret scan before
   each commit).
3. Check the employment contract (see `.private/OWNER_NOTES.md`).
4. Free checks: trade mark search for "DirectWork" (the first results
   page showed only dead or different marks; classes 9, 35 and 42 still
   need checking), Home Office helpline, Fair Work Agency email.
5. Accounts: Cloudflare, domain, Amazon SES, the London Supabase project
   on Pro, Apple and Google developer accounts, ICO fee.
6. Set the bill caps in `docs/OPERATIONS.md` section 3.
7. Apply migrations and deploy functions to staging
   (`docs/tasks/T06-staging-rehearsal.md`). Claude is blocked from
   changing a hosted project.
8. Never run `supabase config push`; set the Site URL and redirect URLs
   in the dashboard.
9. Read and sign the documents in `docs/legal/`.

## Known gaps, none blocking a closed beta

- The design changes (T01) have not been looked at on a real phone or in
  dark mode on a device.
- Accessibility audit not done yet (T02, T03).
- Photos uploaded before thumbnails existed have no thumbnail; they show
  the full image after one failed request. There are none in production.
- Discover text search scans the table at a few thousand rows (6 to 9
  ms); the indexes exist for when it grows.
- One advisory that can be triggered in the shipped app
  (`decode-uri-component`) remains until the SDK 58 upgrade.
- The "what changed since you confirmed" view on a Deal Sheet only works
  on the device you confirmed on.
- Late payment letters are for deals in pounds only. The Bank of England
  rate for 30 June 2026 (3.75%) came from news reports; check it against
  the Bank's own page before launch, and add a new rate every 1 January
  and 1 July.
- Several facts in the marketing research could not be checked and are
  marked "unverified" in those files. Check the IPSE and FreeAgent
  figures against their sources before publishing them.
- The reviewers' own test scripts and the finance model's script were
  lost when Windows cleaned its temp folder. Their reports and the cost
  dashboard survive.

## Seeing the app without a backend

The preview scripts are in `.private/preview/`. Once:
`cd .private/preview && npm install && npx playwright install chromium && node make-fake-images.js`.
Then, from the repo root:

```
npx expo export --platform web --output-dir .private/preview/dist
cd .private/preview && node preview.js dist
```

A browser window opens at <http://localhost:8137> with every Supabase
call faked (`preview-mock.js` holds the sample data). When the app gains
a new server function, add a canned answer for it there, or the screen
that uses it will look broken in the preview only.

Two switches for `preview.js`, set before the command:
`PREVIEW_DELAY_MS=2000` holds every answer back so the loading
placeholders stay on screen long enough to look at, and
`PREVIEW_SKIP_TERMS=1` starts past the "Updated terms" screen, and
`PREVIEW_SIGNED_IN=1` opens on Home as the sample user.
`skeleton-shots.js` screenshots every screen mid-load in light and dark.
