# DirectWork

A direct professional project and job marketplace — not a social network.
Helps founders, freelancers, and skilled professionals find each other and
work together on real projects, either as paid work or as project
partners. No feed, no public posts, no likes/follower counts — see
[`CLAUDE.md`](CLAUDE.md) for the hard product boundary.

Full product and architecture context lives in [`docs/`](docs/):

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack, repo layout, routes, slice order
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — entities and state machines
- [`docs/ACCESS_CONTROL.md`](docs/ACCESS_CONTROL.md) — RLS / Edge Function strategy
- [`docs/OPEN_DECISIONS.md`](docs/OPEN_DECISIONS.md) — product decisions not yet made (and provisional ones to review)
- [`docs/PRODUCT_STRATEGY.md`](docs/PRODUCT_STRATEGY.md) — positioning and the validation plan
- [`docs/MONETIZATION.md`](docs/MONETIZATION.md) — plans, pricing, Stripe setup
- [`docs/LAUNCH.md`](docs/LAUNCH.md) — go-live checklist (backend, web, stores, legal)

## Tech stack

- **Client**: Expo (SDK 57) + React Native + TypeScript (strict) + Expo
  Router + React Native Web — one codebase for iOS, Android and Web.
- **Backend**: Supabase — Postgres, Auth, Storage, Realtime, RLS, Edge
  Functions. Project is live; the newest migrations still need applying
  — see `docs/LAUNCH.md`.
- **Data**: TanStack Query over supabase-js; zod for validation.
- **Tooling**: ESLint 10 (flat config) + Prettier + TypeScript strict.

## Project structure

| Path          | Contents                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `app/`        | Expo Router routes — see the route map in `docs/ARCHITECTURE.md`.                                                                |
| `components/` | Shared UI primitives and the visual language — see `components/README.md`.                                                       |
| `features/`   | `auth`, `profile`, `listings`, `applications`, `billing`, `admin` — each with `api.ts`, `hooks.ts`, `schemas.ts`, `components/`. |
| `lib/`        | Theme, validated env, Supabase + query clients, Edge Function caller.                                                            |
| `supabase/`   | Migrations, Edge Functions, and the PGlite database test suite.                                                                  |
| `docs/`       | Strategy, architecture, data model, access control, monetization, launch.                                                        |
| `scripts/`    | `generate-route-types.js` (typed routes without a dev server, for CI).                                                           |
| `assets/`     | Brand icon, adaptive icon, splash and favicon (rendered from the ConnectMark).                                                   |

## Getting started (macOS or Windows)

### 1. Install the right Node version

This repo pins an exact Node version in `.nvmrc` (currently `22.13.0`,
required by React Native 0.86's engine constraints).

**macOS:**

```bash
# if you don't have nvm: https://github.com/nvm-sh/nvm
nvm install
nvm use
```

**Windows:**

```powershell
# if you don't have nvm-windows: https://github.com/coreybutler/nvm-windows
nvm install 22.13.0
nvm use 22.13.0
```

(Or just install that exact version from nodejs.org directly — either works.)

### 2. Clone and install

```bash
git clone https://github.com/SamySCode/DirectWork.git
cd DirectWork
npm install
```

### 3. Verify your setup

```bash
npm run check   # lint + typecheck + format:check + unit + database tests
```

Should pass with no errors on a clean checkout. The test suites:

| Command                  | What it covers                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `npm run test:unit`      | 232 Jest tests: logic, components and screens (React Native Testing Library)       |
| `npm run test:db`        | 43 tests: migrations, RLS, transitions and schema guardrails in PGlite (no Docker) |
| `npm run test:functions` | Edge Function middleware (Deno, fetched via npx)                                   |
| `npm run test:rls:live`  | End-to-end RLS check against a deployed project                                    |

## Running the app

**Easiest option, no native tooling needed (either OS):**

```bash
npm start
```

Then scan the QR code with the **Expo Go** app on your phone (iOS or
Android — [App Store](https://apps.apple.com/app/expo-go/id982107779) /
[Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)).

**Run in a browser:**

```bash
npm run web
```

Opens at `http://localhost:8081`.

**iOS Simulator** (macOS only, requires Xcode installed):

```bash
npm run ios
```

**Android Emulator** (macOS or Windows, requires Android Studio + a
configured emulator):

```bash
npm run android
```

We haven't run `expo prebuild`, so there's no `ios/`/`android/` native
project checked in — everything above runs through the Expo managed
workflow. Nobody needs Xcode or Android Studio installed just to
contribute; they're only needed if you want a simulator/emulator instead
of Expo Go or the browser.

## Current status

Slices 1–8 are built (see `docs/ARCHITECTURE.md`): auth, a 3-step
onboarding, profiles with a mutually confirmed track record, curated
listings with partner admission criteria and an operator review queue,
Discover with skill-match highlighting, apply / accept / decline, contact
reveal on acceptance, and outcome confirmation. Owner-side Pro billing is
built and switched off until Stripe is configured
(`docs/MONETIZATION.md`).

Not built: the partner agreement flow (waits on real legal text),
messaging and notifications (Phase 3).

Before real users: work through `docs/LAUNCH.md`. The newest migration
isn't applied to the hosted project yet, and a privacy policy and terms
are needed before launch.

## Supabase access

DirectWork's Supabase project already exists — nobody needs to create
their own. You need to be invited to it once, and each person keeps
their own local `.env.local` (gitignored, never committed) with their
own copy of the same project credentials.

### As the project owner (one-time, per teammate)

1. Open the [Supabase dashboard](https://supabase.com/dashboard), select
   the DirectWork organization, then go to **Organization → Team**.
2. Click **Invite**, enter their email, and assign the **Developer**
   role — full project content access (tables, SQL editor, auth users,
   etc.) without the ability to change organization/billing settings or
   add new owners. Don't hand out Owner/Administrator unless there's a
   real reason to.
3. If prompted to scope the invite to a project rather than the whole
   organization, choose the DirectWork project.
4. The invite link is only valid for **24 hours** — tell them to accept
   it promptly.

### As an invited teammate (one-time, per person)

1. Accept the email invite (create a free Supabase account first if you
   don't already have one).
2. In the dashboard, open the DirectWork project → **Settings → API**.
3. Copy the **Project URL** and the **Publishable key** — safe to copy,
   that's what it's for. Never copy or share the **Secret key**.
4. In your local clone, create `.env.local` from the template and fill
   in those two values:

   ```bash
   cp .env.example .env.local
   ```

   (Windows PowerShell: `Copy-Item .env.example .env.local`)

   ```
   EXPO_PUBLIC_SUPABASE_URL=<your Project URL>
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your Publishable key>
   ```

5. That's it — `.env.local` is gitignored, so it stays local to your
   machine only.

The Supabase CLI (needed later, once we start writing migrations) is a
separate, per-person step via `npx supabase login` — not something
that gets shared or set up yet.

## Setting up with Claude Code

If you're a new contributor and have Claude Code installed, `CLAUDE.md`
at the repo root is loaded automatically and already documents the
project's architecture rules. To get your local environment working, open
Claude Code in this repo after cloning it and paste:

```
I just cloned this repo. Please:
1. Check my installed Node version against .nvmrc and tell me exactly
   how to install/switch to the right one if it doesn't match (I'm on
   [macOS / Windows] — tell me which nvm variant applies).
2. Run npm install.
3. Run npm run typecheck, npm run lint, and npm run format:check, and
   confirm all three pass cleanly.
4. Start the app with npm run web and confirm it boots with no console
   errors.
5. Tell me the easiest way to see it running on my phone via Expo Go,
   and what (if anything) I'd additionally need installed for an
   iOS Simulator or Android Emulator, without installing anything heavy
   automatically — just tell me and let me decide.
Don't make product or architecture decisions on your own — if you hit
one that isn't already answered in docs/OPEN_DECISIONS.md, ask me.
```

This walks a new machine through the exact same setup this repo was
built with, and flags anything that's genuinely different about their
particular Mac/Windows setup (older Node, no Xcode, etc.) instead of
guessing.

## Deployment

Config is in place (`eas.json`, bundle ids, CI in
`.github/workflows/ci.yml`, web security headers in `public/_headers`).
The step-by-step is in [`docs/LAUNCH.md`](docs/LAUNCH.md).

## Conventions

See [`CLAUDE.md`](CLAUDE.md) for conventions all contributors (and Claude
Code sessions) should follow in this repo — including the hard rule that
this is not a social network.
