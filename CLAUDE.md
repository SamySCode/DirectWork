# CLAUDE.md

Guidance for Claude Code sessions working in this repository. Read
`docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, and `docs/ACCESS_CONTROL.md`
before making structural changes — they capture decisions already agreed,
not just suggestions.

## Product boundary (hard constraint)

DirectWork is a direct professional marketplace, not a social network.
Never add a social feed, general public posts, likes/reactions, follower
counts, or engagement-driven content, even as a small addition to another
feature.

## Architecture rules

- One Expo app for iOS, Android and Web. No separate native apps, no
  separate web codebase, no microservices, no GraphQL, no Elasticsearch,
  no custom ML recommendation engine, no marketplace payments yet.
- Supabase is the backend: Postgres + Auth + Storage + Realtime + RLS +
  Edge Functions. Do not introduce a custom server when Supabase already
  covers the need.
- Sensitive state transitions (application accept/reject, agreement
  acceptance, membership creation) must go through Edge Functions, never
  a direct client-side table write. RLS is the backstop, not the only
  gate. See `docs/ACCESS_CONTROL.md`.
- Feature code lives in `features/<feature>/`; only cross-feature,
  presentation-only UI belongs in `components/`; only cross-feature
  infrastructure belongs in `lib/`.
- Don't hand-pick Expo/Supabase dependency versions — use
  `npx expo install <pkg>` so versions stay compatible with the installed
  Expo SDK.

## Working style

- Preserve existing code; don't replace an established choice without
  explaining why in the response.
- Don't invent product decisions — check `docs/OPEN_DECISIONS.md` first;
  if a needed decision isn't there, surface it instead of assuming.
- Implement one vertical slice at a time (see the order in
  `docs/ARCHITECTURE.md`). Don't build ahead into later slices.
- Run lint, typecheck, and tests for anything changed; report results
  plainly.
- Do not commit, push, or open PRs unless explicitly asked.
