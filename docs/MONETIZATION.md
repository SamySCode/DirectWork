# Monetization

Builds on the reconciled direction in `docs/PRODUCT_STRATEGY.md`. The two
rules that shaped everything here:

1. **Never charge the scarce side.** Professionals finding work pay
   nothing, ever: no verification fees, no application credits, no
   "boost my profile". They're the supply that makes the marketplace
   worth anything.
2. **No money moves between users.** That keeps us out of Stripe Connect,
   KYC, escrow, and HMRC platform reporting until there's real
   transaction volume to justify them.

That leaves charging owners for **reach**. What's built is one paid
plan:

| Plan | Price            | Live listings | Placement                       |
| ---- | ---------------- | ------------- | ------------------------------- |
| Free | £0               | 1             | Normal                          |
| Pro  | £29/month (open) | 10            | Featured at the top of Discover |

"Live" = `in_review`, `published` or `paused`. Drafts and closed listings
don't count, so a free owner can still prepare their next listing.

## Why this model

- **Curation is the product, and a hard cap protects it.** One free live
  listing stops low-effort owners spraying ideas at professionals, which
  was the failure mode every review named. The people who genuinely need
  more slots are agencies, studios and serial founders: the ones most able
  to pay.
- **Featured placement is honest.** It changes sort order only, it's
  labelled "Featured" on the card, and it never bypasses review. It's not
  engagement bait. There's no feed to boost.
- **A subscription over per-listing fees.** It's predictable revenue, it's
  one Stripe Checkout integration with no metering, and it matches how
  agencies buy tools.
- **£29 is a starting guess, not a researched number.** It sits below a
  single job-board post (often £100+) and above "impulse". The Phase 1
  commit-to-pay test (`docs/PRODUCT_STRATEGY.md`) should set the real
  price. Change it in Stripe and in `features/billing/plans.ts`.

## How it's wired

- `supabase/functions/billing`: creates a Stripe Checkout session
  (subscription mode) or a customer-portal session. It returns 503
  `BILLING_DISABLED` until `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO` and
  `APP_URL` are set.
- `supabase/functions/billing-webhook`: the only writer of
  `public.subscriptions`. It handles `customer.subscription.*` events and
  verifies the Stripe-Signature HMAC itself.
- Enforcement is in the database: `private.live_listing_limit()` is checked
  inside `private.submit_listing`. `is_featured` is set at approval and
  refreshed whenever the plan changes. The client copy in
  `features/billing/plans.ts` must mirror those numbers.
- The UI is hidden unless `EXPO_PUBLIC_BILLING_ENABLED=true`, and
  **purchase UI is web-only** (`features/billing/availability.ts`). App
  Store Guideline 3.1.1 and Google Play's payments policy require their own
  in-app purchase for digital subscriptions bought inside a mobile app, and
  forbid pointing users at an outside payment page. A plan bought on the
  web still applies in the apps (Apple 3.1.3(b), multiplatform services),
  because limits come from the database. If mobile purchase is ever wanted,
  that means RevenueCat or StoreKit/Play Billing plus a webhook into the
  same `svc_apply_subscription`, with Apple/Google taking 15–30%.

## Turning it on

1. Create a Stripe product "DirectWork Pro" with a monthly GBP price. Copy
   the price id.
2. `supabase secrets set STRIPE_SECRET_KEY=... STRIPE_PRICE_PRO=price_...
APP_URL=https://<web origin> STRIPE_WEBHOOK_SECRET=whsec_...`
3. Add a Stripe webhook endpoint at
   `https://<project>.supabase.co/functions/v1/billing-webhook` for
   `customer.subscription.created`, `.updated` and `.deleted`.
4. Enable the customer portal in Stripe (cancel + update payment method).
5. Set `EXPO_PUBLIC_BILLING_ENABLED=true` for the web build.
6. Test end to end in Stripe test mode before switching keys to live.

## Levers not built (in rough order of expected value)

- **Concierge matching** (one-off, owner pays): the operator hand-picks
  and double-opt-in introduces 3 vetted professionals. This is the Phase 1
  manual loop, sold. It's probably the highest-value thing to test first,
  because it needs no code: a Stripe Payment Link plus the review queue.
- **Per-listing boost** (one-off, e.g. 30 days featured) for owners who
  don't want a subscription.
- **Verified owner** badge, paid by owners and never by professionals.
  Needs an identity provider decision (`docs/OPEN_DECISIONS.md`).
- **Agreement drafting packs** for partner listings, once a solicitor has
  written real templates (slice 9).
- **Team/org seats**, blocked on the open org-entity decision.

## Costs to cover

- Stripe (UK cards): roughly 1.5% + 20p per charge, so about 64p on £29.
- Supabase: the free tier works for validation. Move to Pro (about $25/mo)
  before launch for daily backups and no project pausing.
- Apple Developer £79/yr, Google Play $25 once.
- Break-even on infrastructure is about 2 Pro subscribers.
