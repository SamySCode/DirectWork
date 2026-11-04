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
  (auth)/welcome.tsx               # front door: what this is, sign up / sign in
  (auth)/sign-in.tsx, sign-up.tsx, forgot-password.tsx
  update-password.tsx              # password-reset link lands here (web + native)
  onboarding.tsx                   # 3 steps: intent -> about you -> skills
  (tabs)/home.tsx                  # "needs you" actions + skill-matched picks, not a feed
  (tabs)/discover/index.tsx        # browse + search + filter (infinite list)
  (tabs)/applications/index.tsx    # my applications
  (tabs)/listings/index.tsx        # my listings + plan quota
  (tabs)/profile/index.tsx         # my profile + account menu
  listing/new.tsx, listing/[id]/edit.tsx
  listing/[id]/index.tsx           # detail; owners also get lifecycle + applicants
  application/[id].tsx             # applicant view: progress, contact, outcome
  people/[id].tsx                  # public profile + track record
  account/edit.tsx
  billing.tsx                      # hidden unless EXPO_PUBLIC_BILLING_ENABLED
  review.tsx                       # operator curation queue (admins only)
```

The root guard (`features/auth/hooks.ts` `useProtectedRoute`) keeps people
on the right step: signed out -> welcome, no profile -> onboarding,
otherwise the app.

## Vertical slices (implementation order)

Reordered and trimmed per `docs/PRODUCT_STRATEGY.md` Phase 2 — the goal
is the smallest software that supports a validated manual matching loop,
not the fullest possible marketplace.

1. Repository & tooling foundation ✅
2. Authentication (sign up/in/out, recovery, cross-platform sessions) ✅
3. Professional profiles + onboarding ✅
4. Curated listings with admission criteria + operator review queue ✅
5. Discovery (search, type/remote filters, skill-match highlighting) ✅
6. Apply + mutual acceptance (submitted -> accepted/rejected/withdrawn) ✅
7. Contact reveal on mutual acceptance ✅
8. Collaboration + mutually-confirmed outcome ledger / track record ✅
9. Optional, scoped partner agreement flow — **not built**: still waits on
   real legal text replacing the placeholder (docs/OPEN_DECISIONS.md)

**Build-ahead note (2026-11-04):** the Phase 1 checkpoint (manual
validation before slice 4, `docs/PRODUCT_STRATEGY.md`) was
explicitly overridden by the product owner, who asked for the app to be
built as far as possible in one pass. Slices 4-8 plus owner-side billing
(see `docs/MONETIZATION.md`) were built together. The Phase 1 manual
validation in `docs/PRODUCT_STRATEGY.md` is still the recommended way to
find out whether the loop works — the software now supports running it
in-app instead of on a spreadsheet.

Still deferred to Phase 3, conditional on real signal: Realtime messaging,
private workspace, notifications (email/push), SEO/static rendering,
fuller audit-trail UI.

10. Cross-platform polish & deployment prep (EAS) — config in place
    (`eas.json`, bundle ids, brand icons, CI); store submission steps in
    `docs/LAUNCH.md`

Each slice should be implementable and testable independently. Full
marketplace payments, advanced AI, matching, and heavier workspace
tooling remain later phases, not MVP.

## Data access pattern

- Reads go straight from the client through RLS (`features/*/api.ts`),
  cached by TanStack Query (`lib/query.ts`: 30s stale time, refetch on app
  foreground, no Realtime).
- Every status change goes through the `actions` Edge Function, which
  calls a `private.*` SQL function that authorizes and transitions
  atomically. See `docs/ACCESS_CONTROL.md`.
- Supabase isn’t needed to test the database: `npm run test:db` runs the
  real migrations in PGlite (Postgres in WASM) with a stub of Supabase’s
  auth schema and roles.
