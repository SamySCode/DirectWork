# Open product decisions

Genuine product decisions not yet made. Do not silently resolve these
during implementation — surface them for a decision instead.

- **Company/org entity**: does a small company get a distinct
  organization account with multiple managers, or does one person's
  profile own listings on the company's behalf for MVP?
- **Compensation shape (paid route)**: fixed vs hourly vs range — what
  fields does a "paid" listing actually need? Partner-route terms are now
  structured fields under `project_admission`, see `docs/DATA_MODEL.md`.
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
- **Professional search**: does a listing owner get to browse/search
  professionals directly, or is discovery listing-first only? Downstream
  of Phase 1 (docs/PRODUCT_STRATEGY.md) — the operator matches by hand
  during validation, so this doesn't need answering until Phase 2/3.
- **CV/document limits**: acceptable file types and size caps for
  uploads.
- **Social login (OAuth)**: v1 reference designs show Google/LinkedIn
  sign-in. No provider is configured in Supabase (email/password only) —
  decide if/which providers are worth the setup before building the UI.
- **Terms of Service / Privacy Policy**: referenced in a reference
  sign-up design; no such documents exist yet. Needed before any
  required-acknowledgement checkbox can be built (same "not legal advice,
  needs real review" caveat as the partner agreement template).
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

## Recommendations flagged for reconsideration

- TanStack Query as the data-fetching layer — not mandated by the
  product spec, added to avoid hand-rolled cache/loading/error state.

## Resolved

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
