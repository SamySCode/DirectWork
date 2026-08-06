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
- [`docs/OPEN_DECISIONS.md`](docs/OPEN_DECISIONS.md) — product decisions not yet made

## Tech stack

- **Client**: Expo (SDK 57) + React Native + TypeScript (strict) + Expo
  Router + React Native Web — one codebase for iOS, Android and Web.
- **Backend**: Supabase — Postgres, Auth, Storage, Realtime, RLS, Edge
  Functions. **Not set up yet** — see "Current status" below.
- **Tooling**: ESLint 10 (flat config) + Prettier + TypeScript strict.

## Project structure

| Path          | Contents                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`        | Expo Router routes (file-based). Currently: root layout + tab shell only.                                                                               |
| `components/` | Shared, feature-agnostic UI (`Button`, `Card`, `EmptyState`, `LoadingState`, `ErrorState`), styled from `lib/theme.ts`.                                 |
| `features/`   | Empty so far. Feature-scoped logic (`api.ts`, `schemas.ts`, `hooks.ts`, `components/`) goes here per feature, starting with slice 2.                    |
| `lib/`        | Cross-cutting infrastructure: `theme.ts` (design tokens), `env.ts` (env var access, will be zod-validated later), `supabase.ts` (once Supabase exists). |
| `supabase/`   | Empty so far (`migrations/`, `functions/`) — populated once a Supabase project exists.                                                                  |
| `docs/`       | Architecture, data model, access control, open product decisions.                                                                                       |
| `assets/`     | App icon/splash/favicon (Expo defaults — not final branding).                                                                                           |

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
npm run typecheck
npm run lint
npm run format:check
```

All three should pass with no errors on a clean checkout.

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

Implemented so far (see `docs/ARCHITECTURE.md` for the full slice order):

1. ✅ Repo, tooling, and docs foundation
2. ✅ Expo scaffold (Expo Router + React Native Web) + a basic design
   system and placeholder tab navigation shell — no feature logic yet
3. ✅ Supabase project created and client wired up (`lib/supabase.ts`) —
   no screens use it yet, that starts with slice 2
4. ⬜ Authentication, profiles, listings, and everything after — not
   started; each screen currently states which slice will build it

### Getting your own `.env.local`

The Supabase project URL and publishable key aren't committed (see
`.env.example` for the format). Ask whoever set up the Supabase project
to add you as a project member in the Supabase dashboard so you can copy
your own values from **Settings → API** — don't pass the key around
outside that.

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

Not set up yet. Production web hosting and EAS builds/submission for
iOS and Android are slice 11 in `docs/ARCHITECTURE.md`, after the core
product slices are built.

## Conventions

See [`CLAUDE.md`](CLAUDE.md) for conventions all contributors (and Claude
Code sessions) should follow in this repo — including the hard rule that
this is not a social network.
