# Open product decisions

Genuine product decisions not yet made. Do not silently resolve these
during implementation — surface them for a decision instead.

- **Messaging scope**: superseded for Phase 1/2 by contact-reveal-on-
  acceptance, see `docs/PRODUCT_STRATEGY.md`. Revisit real messaging scope
  (pre-acceptance DMs, etc.) only in Phase 3.
- **Notifications channel**: deferred to Phase 3 along with the rest of
  messaging/notifications, see `docs/PRODUCT_STRATEGY.md`.
- **Push notifications**: deferred to Phase 3, same reasoning.
- **Agreement content authorship**: jurisdiction confirmed UK — needs
  real solicitor review (governing law: England and Wales) before it's
  load-bearing. Placeholder text stays clearly labelled non-production
  until then. Also now optional per listing and scoped to attached
  materials rather than "the idea" broadly — see `docs/PRODUCT_STRATEGY.md`.
- **Professional search** (provisionally built listing-first, see below):
  does a listing owner get to browse/search professionals directly, or is
  discovery listing-first only? Downstream
  of Phase 1 (docs/PRODUCT_STRATEGY.md) — the operator matches by hand
  during validation, so this doesn't need answering until Phase 2/3.
- **CV/document uploads**: images are built (see Resolved); PDFs/CVs are
  not. Decide whether CV upload is wanted before adding a document bucket.
- **Social login (OAuth)**: v1 reference designs show Google/LinkedIn
  sign-in. No provider is configured in Supabase (email/password only) —
  decide if/which providers are worth the setup before building the UI.
- **Identity verification**: v1 reference designs show "Verified"
  badges/checks on profiles. Not in the current data model — whether/when
  to build it is still open, but the monetization direction is resolved
  (see below): if it's ever paid, project owners pay for it, never the
  professionals being verified.
- **Company/org entity**: does a small company get a distinct
  organization account with multiple managers, or does one person's
  profile own listings on the company's behalf? Lower priority now —
  Phase 1's manual/curated matching (`docs/PRODUCT_STRATEGY.md`) doesn't
  need this either way.

## Decided during the 2026-11-04 build (provisional — review these)

Made under an explicit "build as far as you can, no input needed"
instruction from the product owner. Each is easy to reverse; none has
been validated with real users.

- **Pro price: £29/month**, Free = 1 live listing, Pro = 10 + featured.
  A placeholder until the Phase 1 commit-to-pay test produces a real
  number. See `docs/MONETIZATION.md`.
- **Purchase is web-only** (App Store 3.1.1 / Play billing). Adding
  in-app purchase is a separate decision with a 15–30% store fee.
- **Bundle id / Android package: `com.directwork.app`.** Must be
  confirmed before the first store submission — it can't be changed after.
- **Curation turnaround copy says "usually within a day".** Only true if
  someone works the review queue daily (the operator role in
  `docs/PRODUCT_STRATEGY.md`).
- **Professional search** (open item above): built listing-first only.
  Owners can open applicants' profiles but can't browse professionals.
- **No email/push notifications yet**: the home "Needs you" list and the
  Listings tab badge stand in for them until Phase 3.
- **Display font on headings**: General Sans now sets screen titles and
  card headings, not just the wordmark (`components/README.md`), as part
  of the requested visual refresh.

- **Owner questions instead of messaging** (2026-11-04, product owner
  asked for it): an owner can ask up to 3 questions on a pending
  application, one open at a time, and the applicant answers each once.
  No free chat, no Realtime; questions stop once the application is
  decided (contact reveal takes over). Revisit only if owners consistently
  need more than three.
- **Verified references**: one per person per collaboration, 20–300
  characters, only after both sides confirm "completed", not editable,
  public to signed-in users. The listing title is snapshotted.
- **Availability freshness: 30 days**, with a nudge from day 23. Stale
  profiles drop out of talent counts and are labelled; they are not
  hidden from owners they've already applied to.
- **"Completed" needs 7 days of working together**, and track records
  count distinct people, not collaborations (anti-farming).
- **Moderation**: reporting a listing can take it down for changes;
  reporting a profile is recorded only — suspension is a manual dashboard
  action for now. Reports are capped at 10/day per user. Needs an operator
  working the queue, like curation.
- **Blocks are silent**: the blocked person isn't told; a block shows up as
  "not accepting applications".
- ~~Activity inbox has no retention job yet~~: resolved 2026-11-06, see
  "Decided 2026-11-06" (retention).

## Still open: owner decisions (raised by the 2026-11-05/06 review)

Each has a recommendation from the review. `docs/NEXT_STEPS.md` step 1.2.

- **Legal entity.** Recommended: a private limited company, before the ICO
  fee, Stripe, Apple, Google and the domain (each is per legal person).
  `docs/NEXT_STEPS.md` assumes Ltd.
- **Production region.** Recommended: a new London (eu-west-2) production
  project, with the current Ireland project as staging. Can't be changed
  later without a new project and new app builds. `docs/NEXT_STEPS.md`
  assumes London.
- **Track record when the other person deletes their account.** Today the
  remaining person's outcomes and references go with the deleted account.
  The product review recommends keeping them with the other party
  anonymised. Not changed in the data model; copy was fixed instead
  ("confirmed by both sides", never "verified" or "can't fake").
- **Apple 3.1.3(b).** Web-bought Pro can only be honoured in the iOS app if
  Pro is also sold as an in-app purchase. Choose IAP on iOS, or submit with
  billing off.
- **Launch platforms.** Recommended: web first; stores within 90 days.
- **Email notifications at launch** ("someone applied", "you were
  accepted"). The product review recommends a minimal set at launch; today
  they're deferred to Phase 3.
- **Paid-route pay.** Recommended: a pay amount required, with an hourly
  floor at the National Living Wage.
- **Admin two-factor in the app.** TOTP is enabled; requiring it for admin
  actions is a later build item.

## Decided 2026-11-06

Taken by the review lead with the owner's brief (minimal subscriptions and
lock-in, the safest well-tested options, UK law compliance). Implemented in
`20261105110000_privacy_fixes.sql`, `20261105120000_launch_hardening.sql`
and the app, except where noted. Each is reversible.

- **Minimum age: 18+**, self-declared with a required checkbox at sign-up
  (no date of birth), together with Terms and Privacy acceptance. Versioned
  and recorded in `legal_acceptances`; a re-acceptance screen appears when
  the terms or privacy version changes. (Resolves "Minimum age" and "Terms
  of Service / Privacy Policy": drafts now exist in `features/legal/`,
  pending solicitor review.)
- **Withdrawn applications:** owners still see them, marked withdrawn. The
  withdraw dialog copy says so; access is unchanged.
- **Reports survive account deletion, anonymised**: links to the reporter
  and target are removed, the kind of target is kept. No email hash for now.
  (Resolves "Reports when an account is deleted".)
- **Retention:** read activity 180 days, any activity 365 days; rejected or
  withdrawn applications 12 months after their last change (attachment files
  removed via the storage cleanup queue); resolved reports 3 years if
  actioned, 12 months if dismissed. Accepted applications, memberships,
  outcomes and references are kept while both accounts exist. Runs nightly
  (`pg_cron`); files need the `maintenance` function scheduled. (Resolves
  "Retention periods" and the activity retention note.)
- **Track record on counterpart deletion:** data model not changed now
  (still open above); overclaiming copy fixed.
- **One application per listing per person.** Re-applying only after a
  withdrawal, never after a rejection unless the rejection was the listing
  closing. (Resolves "Re-applying after rejection".)
- **Live-listing limit also checked when resuming a paused listing**
  (closes a downgrade loophole).
- **Images:** bucket limit 2 MB; the app compresses in steps (0.8, 0.65,
  0.5) to fit; per-user caps avatars 3, portfolio 8, listing images 40,
  application attachments 15. (Resolves "Image size cap"; supersedes the
  5 MB figure in "Image limits" below.)
- **Blocks:** with a block in either direction, deciding an application
  fails as "not found" and contact details aren't returned; creating a block
  withdraws pending applications between the two people.
- **Legal hold** for Online Safety Act CSEA reporting:
  `private.legal_holds`; account deletion is refused while a hold exists
  ("Your account can't be deleted right now. Contact support."). Admins add
  holds in SQL (runbook: `docs/NEXT_STEPS.md` 2.20).
- **Admin MFA:** TOTP stays enabled in config; enforcing it in the app is a
  later item.
- **Billing stays off** until legal advice (right-to-work "online matching
  service" rules, Apple 3.1.3(b)). When it goes on: UK billing addresses only.
- **Vendors:** Amazon SES (London) for email, Cloudflare for domain, DNS,
  web hosting and email forwarding, Sentry EU optional. See `docs/STACK.md`.

## Recommendations flagged for reconsideration

- Nothing currently.

## Resolved

- **Image limits** (resolved 2026-11-04; size and per-user caps superseded
  2026-11-06, see above): JPEG/PNG/WebP, 5 MB per file
  (resized to <=1600px JPEG client-side first). Profile photo 1, portfolio
  6, listing images 4, application attachments 3. Enforced by Storage
  bucket limits, database caps, and per-user file caps.

- **Compensation shape (paid route)** (resolved 2026-11-04): a rate type
  (`fixed | hourly | daily`) plus an optional min/max range and currency.
  Partner-route terms stay structured under `project_admission`.
- **TanStack Query** (resolved 2026-11-04): adopted (`lib/query.ts`) once
  enough screens shared data that hand-rolled caching cost more than the
  dependency.

- **Skills taxonomy** (resolved): free text with a curated autocomplete.
  Users can type any skill; matches from the growing `skills` table are
  suggested as they type, and typing something new adds it to that table
  rather than rejecting it. Balances flexibility (no seed list needed for
  MVP) with convergence toward consistent naming over time.
- **Product positioning + verification monetization** (resolved): see
  `docs/PRODUCT_STRATEGY.md`. Curated platform, not an open idea
  marketplace; partner-route listings require structured admission
  criteria; the NDA is optional per listing; verification, if ever
  monetized, is paid for by owners, never by the professionals being
  verified.
- **Jurisdiction** (resolved): UK-first. Legal/tax specifics assume
  English law.
