# Product strategy

This document exists because the original "any idea meets any skilled
person" framing was stress-tested by two rounds of an 8-agent AI council
(architecture/security review, then feasibility/monetization) plus an
independent second-opinion review of the council's own output, and the
repositioning below is what survived all three passes. Treat this as the
agreed direction, not a suggestion — but also as a **living document**:
Phase 1 below is designed to produce real data that should update it.

Jurisdiction: **UK-first** (confirmed). Legal/tax specifics below (NDA
enforceability, HMRC platform reporting) assume English law.

## The core risk, and why this exists

Every independent pass converged on the same root risk: it's not known
whether skilled professionals will actually engage with this, and no
amount of correct RLS policies or clean application state machinery
answers that question. The plan below spends near-zero engineering time
before testing it, then builds only what a validated manual loop needs.

## Reconciling the council vs. the second opinion

Where they agreed (adopted as-is): don't gate the scarce side (skilled
professionals) with a mandatory NDA; build a verified outcome/completion
record — it's more differentiated and durable than the NDA; validate
manually before writing more application/listing code; don't let "any
idea + any executor" reach the marketplace unfiltered; defer real
marketplace payments (Stripe Connect).

Where the second opinion correctly softened the council's overreach: a
click-accept **can** form a valid contract under English law (Law
Commission guidance) — the weakness isn't "clicking accept means
nothing," it's that _this project's specific implementation_ (mutable
template, no governing-law/jurisdiction clause, scoped to "the idea"
rather than defined confidential materials, no identity behind the
signature) is weak evidence of a well-formed one. Fix the drafting and
scope, don't discard the mechanism. Similarly, "structurally impossible
to monetize" and "this category always fails" were both too absolute —
harder and indirect, not zero/impossible.

One sharp catch from the second opinion that changes something: **never
charge the scarce side (professionals) for identity verification** — that
repeats the exact "tax the scarce side" mistake everyone flagged
elsewhere. If verification is ever monetized, project owners pay for it,
not the professionals being verified.

## Phase 0 — Reposition (in effect now)

- **Reframe**: not an idea marketplace — a curated platform for serious
  professionals to form small project teams and prove they can work
  together. This fixes the supply asymmetry (idea-havers are abundant,
  skilled executors are scarce) by gating the abundant side instead of
  the scarce one.
- **Partner-route listings require admission criteria**, structured
  fields, not prose: what's already built (prototype/research/
  validation), a concrete weekly time commitment, exact skills needed, a
  defined first milestone, proposed equity/terms, and evidence the owner
  is contributing something beyond the idea itself. A vague idea plus
  "I'll give you 5%, sign this NDA first" should never reach the
  marketplace — that's the specific failure mode both reviews
  independently named as fatal.
- **The NDA becomes optional per listing, scoped to specific attached
  materials** (documents, code, customer data) — never mandatory, never
  scoped to "the idea" as a whole. Keep the mechanism already designed
  (versioned templates, immutable acceptance record — worth doing
  regardless of the enforceability debate), but it needs real legal
  drafting (governing law, jurisdiction, defined confidential
  information) before it's load-bearing, and placeholder text stays
  clearly labelled as such until then.
- **Add an outcome/completion record to the data model** before
  `projects` exists — see `docs/DATA_MODEL.md`. Near-unanimous across
  every pass that this, not the NDA, is the actual differentiated,
  eventually-monetizable asset: a verified track record neither LinkedIn
  endorsements nor a résumé can fake.
- **Contact-reveal pulled forward**, well before the old messaging slice
  — doesn't need to be real-time chat yet, "reveal contact info on
  mutual acceptance" is enough to let real conversations happen during
  Phase 1.

## Phase 1 — Manual validation, before writing more feature code

The highest-leverage step available, and not really optional if an
honest answer matters. This may not need the app at all — a form and a
spreadsheet can run this faster than building UI for it.

- Recruit skilled professionals **first**, by hand, in one niche —
  they're the actual test; idea-havers will always show up and aren't.
- Accept only projects meeting the Phase 0 admission criteria.
- Make introductions by hand — double opt-in, no software gate yet.
- Track one honest number: of N introductions, how many reach a real
  conversation, how many start a trial collaboration, how many are still
  active at 30 days.
- Ask owners to _commit_ (not just say) they'd pay something for a
  curated match — the actual monetization signal, cheaper than building
  Checkout first.

**Requires one team member to become the operator** — recruiting,
rejecting weak projects, chasing introductions. Not a technical decision,
but load-bearing: if nobody takes that role, this plan doesn't work
regardless of what gets built. This is a team decision, not one made in
this document.

**Kill/pivot criterion**: if a small number of genuine, sticking
collaborations can't be produced by hand, no amount of additional
engineering fixes that — it means the positioning or niche needs to
change, not the RLS policies.

## Phase 2 — Build only what the validated loop needs

Curated profiles, structured listings (with the admission-criteria
fields), invite/apply, mutual acceptance, contact reveal, trial-project
status, the completion/attestation record. Explicitly cut for now:
escrow/payments, complex workspace, Realtime chat, the full
application-state-machine sophistication, universal NDA. See
`docs/ARCHITECTURE.md` for how this reorders the slice plan.

## Phase 3 — Resume fuller build-out, conditional on Phase 1/2 signal

Fuller applications/status machinery, the refined optional-NDA flow with
real legal review, SEO/static rendering (justified once there are real
listings worth indexing), and monetization experiments — Stripe
**Checkout** (not Connect — no KYC/escrow needed) for owner-side paid
listings/org seats, once Phase 1 shows willingness to pay. Full
marketplace payments (Connect) stays deferred until there's real
transaction volume to justify the KYC/escrow/tax-reporting overhead —
also genuinely reduces near-term compliance burden: HMRC's digital
platform reporting obligations only engage once payments are actually
processed or reliably tracked.

## Monetization approach (reconciled)

- **Near-term (Phase 1)**: willingness-to-pay commitment only, no real
  charging.
- **Phase 2–3**: Stripe Checkout for owner-side paid listings/quotas/org
  seats. Never charge professionals for verification or access — charge
  owners for reach, quality signal, or curation.
- **Partner route**: no take-rate is possible (no transaction to tax),
  but indirect revenue is real and not urgent to chase yet: curated
  cohort fees, paid agreement-drafting packs, recruitment fees if a
  project later raises funding.
- **Full marketplace payments (Connect)**: correctly deferred, revisit
  once real transaction volume justifies it.
