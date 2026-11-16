# T01: Apply depth tokens to shared components

**Model:** Sonnet. **Size:** one session.

## Goal

The app looks flat. `lib/theme.ts` already has an elevation scale
(`elevation`) and surface presets (`surfaces`: card, raised, well) for
light and dark. Nothing uses them yet. Apply them through the shared
components so every screen gains depth without per-screen styling.

## Read first

`lib/theme.ts` (the `elevation` and `surfaces` sections and their
comments), `components/README.md`, then each component you change.

## Do

1. `components/Card.tsx`: use `surfaces.card` plus the lowest elevation
   step. Add a `raised` variant for floating things.
2. `components/Button.tsx`: the primary button gets a subtle elevation.
   Add clear pressed (slight scale and darker tone), hover (web) and
   focus states. Respect the reduced-motion setting.
3. `components/PageHero.tsx`: a gentle tonal gradient or layered tint
   from the tab theme colours (`tabThemes`). No new dependency unless
   `expo-linear-gradient` is already installed; otherwise use layered
   translucent views.
4. `components/TextField.tsx`: sunken well background (`surfaces.well`)
   and a visible focus ring.
5. `components/OfflineBanner.tsx`, `components/RouteErrorBoundary.tsx`,
   `components/EmptyState.tsx`, `components/ErrorState.tsx`: bring them
   in line with the same surfaces.
6. Tab bar and any sheet or menu: raised surface.
7. Dark mode: elevation is shown by a lighter surface and edge, not by
   shadow. Check every change in both themes.

## Don't

No thick one-sided accent borders, no purple gradients, no emoji, no
blur effects inside lists, no large shadows on Android (keep to the
values in the theme). Don't change data logic or copy. Don't edit
`supabase/`.

## Done when

- `npm run lint`, `npm run typecheck` and `npm run test:unit` pass
  (update tests that assert on changed markup).
- `lib/__tests__/contrast.test.ts` passes and covers any new colour
  token.
- You have listed the components changed and anything that needs a look
  on a real phone.
