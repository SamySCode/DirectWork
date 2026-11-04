# app/

Expo Router file-based routes. The full route map, and the root guard
that moves people between welcome, onboarding and the app, is in
`docs/ARCHITECTURE.md`.

Screens stay thin: data comes from `features/*/hooks.ts`, and anything
reused across screens lives in `features/*/components/` or
`components/`.

Not built (see `docs/ARCHITECTURE.md` for why):

- `agreement/[applicationId]/`: the partner agreement flow. It waits on
  real legal text (slice 9).
- `messages/` and a project workspace (Phase 3). Contact reveal on
  acceptance covers this for now.

Typed routes are on (`experiments.typedRoutes`). If `tsc` complains about
an `href` after adding a route, run `npm run typecheck`, which regenerates
`.expo/types/router.d.ts` first.
