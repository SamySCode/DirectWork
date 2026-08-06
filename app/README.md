# app/

Expo Router file-based routes.

Built so far: root layout (`_layout.tsx`) and the `(tabs)` group shell
(dashboard, discover, applications, messages, profile) with placeholder
screens — no feature logic yet, just navigation + the design system from
`components/` and `lib/theme.ts`.

Still to come, one vertical slice at a time (see `docs/ARCHITECTURE.md`):

- `(auth)/` — sign-in, sign-up, forgot-password
- `(onboarding)/` — profile setup, skills, paid/partner interest
- `project/[projectId]/` — listing detail, manage, apply, workspace
- `agreement/[applicationId]/` — partner agreement acceptance flow
- `profile/[userId]/` — public profile view
- `settings/`

Don't build these ahead of their slice — they depend on decisions still
open in `docs/OPEN_DECISIONS.md`.
