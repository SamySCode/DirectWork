# Open product decisions

Genuine product decisions not yet made. Do not silently resolve these
during implementation — surface them for a decision instead.

- **Skills taxonomy**: fixed curated list, free-text tags, or free text
  with a curated autocomplete?
- **Company/org entity**: does a small company get a distinct
  organization account with multiple managers, or does one person's
  profile own listings on the company's behalf for MVP?
- **Compensation shape**: fixed vs hourly vs range vs equity-only for the
  partner route — what fields does a "paid" listing actually need?
- **Messaging scope**: only inside an accepted project (current
  assumption), or also pre-acceptance owner <-> applicant DMs during
  review?
- **Notifications channel**: in-app + Realtime only, or also email?
  Supabase sends auth emails only, not custom transactional email — that
  would need a separate provider (e.g. Resend).
- **Push notifications**: Apple/Google credentials for Expo push not yet
  set up — needed before slice 10/11.
- **Agreement content authorship**: placeholder legal text will be
  drafted and clearly labelled as non-production unless real template
  text is supplied.
- **Professional search**: does a listing owner get to browse/search
  professionals directly in MVP, or is discovery listing-first only
  (professionals browse projects, owners don't browse people) for v1?
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
  badges/checks on profiles. Not in the current data model — decide
  whether any verification is in scope for MVP or a later phase before
  designing for it.

## Recommendations flagged for reconsideration

- TanStack Query as the data-fetching layer — not mandated by the
  product spec, added to avoid hand-rolled cache/loading/error state.
