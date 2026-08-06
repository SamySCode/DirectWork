# Architecture

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

1. Repository & tooling foundation (this shell)
2. Authentication (sign up/in/out, recovery, cross-platform sessions)
3. Professional profiles (minimal fields, skills, paid/partner interest)
4. Listing creation & management (draft/publish/pause/close)
5. Discovery & listing detail (public browse/search/filter)
6. Applications — submission (paid & partner routes)
7. Owner application management (accept/reject, filter)
8. Partner agreement flow + private-field gating
9. Basic private workspace (overview, members, private info, discussion)
10. Messaging & notifications (project-scoped, Realtime)
11. Cross-platform polish & deployment prep (EAS)

Each slice should be implementable and testable independently. Payments,
advanced AI, matching, and heavier workspace tooling are explicitly later
phases, not MVP.

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
