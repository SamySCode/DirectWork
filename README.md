# DirectWork

A direct professional project and job marketplace — not a social network.
Helps founders, freelancers, and skilled professionals find each other and
work together on real projects, either as paid work or as project
partners.

Full product and architecture context lives in [`docs/`](docs/):

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack, repo layout, routes, slice order
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — entities and state machines
- [`docs/ACCESS_CONTROL.md`](docs/ACCESS_CONTROL.md) — RLS / Edge Function strategy
- [`docs/OPEN_DECISIONS.md`](docs/OPEN_DECISIONS.md) — product decisions not yet made

## Current status

This is a baseline repository shell. Nothing runs yet — no Expo app, no
Supabase project. What exists so far:

- Repo structure (`app/`, `components/`, `features/`, `lib/`, `supabase/`)
- TypeScript (strict), ESLint, Prettier configured for the tooling that's here
- Docs capturing the agreed architecture, data model, and access-control plan

## Prerequisites

- Node 20 (see `.nvmrc`)
- npm (the project's standard package manager)

## Getting started now

```bash
npm install
npm run typecheck
npm run lint
npm run format:check
```

## Getting started later (not yet run — deliberately deferred)

These are the exact commands that will bring in Expo and Supabase once
we're ready to integrate them, rather than hand-picking dependency
versions ahead of time:

```bash
# Scaffold Expo into this structure
npx create-expo-app@latest . --template blank-typescript

# Add routing + web support
npx expo install expo-router react-native-web react-dom

# Add the Supabase client
npx expo install @supabase/supabase-js

# Initialize the local Supabase project (requires the Supabase CLI)
npx supabase init
```

After that, copy `.env.example` to `.env.local` and fill in the Supabase
project URL and anon key.

## Conventions

See [`CLAUDE.md`](CLAUDE.md) for conventions all contributors (and Claude
Code sessions) should follow in this repo.
