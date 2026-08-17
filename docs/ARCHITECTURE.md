# Architecture

Read `docs/PRODUCT_STRATEGY.md` first — it explains why the slice order
below is trimmed and reordered from the original 11-slice plan, and what
conditions bring the deferred slices back.

## Product boundary

DirectWork is a direct professional project and job marketplace, not a
social network. It must never grow a social feed, public posts, likes,
follower counts, or engagement-driven content. Every screen should favour
useful professional information, clear opportunities, and direct
collaboration.

## Stack

- **Client**: Expo + React Native + TypeScript (strict) + Expo Router +
  React Native Web. One codebase targets iOS, Android and Web. Platform-
  specific files only when genuinely necessary.
- **Backend**: Supabase — Postgres, Auth, Storage, Realtime, Row Level
  Security, and Edge Functions for the operations that must not be trusted
  to the client (see `docs/ACCESS_CONTROL.md`).
- **Data fetching**: TanStack Query on top of the Supabase JS client
  (recommendation, open to revisiting — see `docs/OPEN_DECISIONS.md`).
- **Validation**: zod schemas in `features/<feature>/schemas.ts`, reused by
  client forms and Edge Functions.
- **Migrations**: plain SQL under `supabase/migrations/`, applied via the
  Supabase CLI. Types generated with `supabase gen types typescript`.
- No custom backend server, no microservices, no GraphQL, no
  Elasticsearch, no custom ML recommendation engine, no marketplace
  payments in the MVP.

## Repository layout

```
app/          Expo Router routes
components/   Shared, feature-agnostic UI primitives
features/     Feature-scoped logic (api, schemas, hooks, components)
lib/          Cross-cutting infrastructure (supabase client, env validation)
supabase/     Migrations and Edge Functions
docs/         This documentation
```

No monorepo tooling (Turborepo/Nx) — unnecessary for a single app. Revisit
only if a genuine second package (e.g. a shared types package) emerges.

## Route map (Expo Router)

```
app/
  (auth)/sign-in.tsx
  (auth)/sign-up.tsx
  (auth)/forgot-password.tsx
  (onboarding)/profile-setup.tsx
  (onboarding)/skills.tsx
  (onboarding)/interests.tsx        # paid / partner / both
  (tabs)/_layout.tsx
  (tabs)/dashboard.tsx              # summary, not a feed
  (tabs)/discover/index.tsx         # browse + search + filter
  (tabs)/discover/[projectId].tsx   # listing detail
  (tabs)/applications/index.tsx     # my applications
  (tabs)/messages/index.tsx
  (tabs)/messages/[projectId].tsx
  (tabs)/profile/index.tsx          # my profile (edit)
  profile/[userId].tsx              # public profile view
  project/create.tsx
  project/[projectId]/manage.tsx    # owner: edit, applications, members
  project/[projectId]/apply.tsx
  project/[projectId]/workspace.tsx # members-only
  agreement/[applicationId].tsx     # accept-agreement flow
  settings/index.tsx
```

## Vertical slices (implementation order)

Reordered and trimmed per `docs/PRODUCT_STRATEGY.md` Phase 2 — the goal
is the smallest software that supports a validated manual matching loop,
not the fullest possible marketplace.

1. Repository & tooling foundation (this shell) ✅
2. Authentication (sign up/in/out, recovery, cross-platform sessions) ✅
3. Professional profiles (minimal fields, skills, paid/partner interest)
   — in progress

**Phase 1 checkpoint** (`docs/PRODUCT_STRATEGY.md`): manual validation,
mostly non-engineering. May not need slices 4+ at all to run — a form
and a spreadsheet can test the loop faster than building UI for it.
Don't start slice 4 until this has produced real signal.

4. Curated listings with admission criteria (structured fields for the
   partner route — what's already built, time commitment, milestone,
   proposed terms — not free-text prose)
5. Discovery (simple browse/search — heavy filtering is premature at low
   listing volume)
6. Invite/apply + mutual acceptance (trimmed: no full audit-trail state
   machine yet, just submitted → accepted/rejected)
7. Contact reveal on mutual acceptance (pulled forward from the old
   messaging slice — not real-time chat, just unlocking contact info)
8. Trial-project status + completion/attestation record (the outcome
   ledger — see `docs/DATA_MODEL.md`)
9. Optional, scoped partner agreement flow (per-listing opt-in, scoped to
   attached materials, not "the idea" — only build once real legal text
   replaces the placeholder)

**Deferred to Phase 3**, conditional on Phase 1/2 producing real signal:
fuller application state machine + audit trail, Realtime messaging,
private workspace, notifications, SEO/static rendering, monetization
(Stripe Checkout for owner-side paid listings — not Connect).

10. Cross-platform polish & deployment prep (EAS)

Each slice should be implementable and testable independently. Full
marketplace payments, advanced AI, matching, and heavier workspace
tooling remain later phases, not MVP.

## Deferred until explicitly started

The following have **not** been set up yet, by design — this shell exists
so they can be plugged in without restructuring anything:

- `npx create-expo-app` (or `npx expo install` into this structure) —
  generates its own `app.json`, `babel.config.js`, `metro.config.js`, and
  native scaffolding
- Supabase project creation + `supabase init` in `supabase/`
- `@supabase/supabase-js`, `expo-router`, `react-native-web`, and other
  runtime dependencies — intentionally not listed in `package.json` yet so
  we don't hand-pick versions that may not match the Expo SDK's compatible
  set at integration time; use `npx expo install <pkg>` when that day comes
- EAS build/submit configuration
