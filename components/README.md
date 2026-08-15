# components/

Shared, feature-agnostic UI primitives, styled from `lib/theme.ts`:
`Button`, `Card`, `EmptyState`, `LoadingState`, `ErrorState`, `TextField`,
`FadeIn`, `Wordmark`.

`Text` wraps React Native's `Text` with `typography.fontFamily` applied —
**always import `Text` from here, never from `react-native` directly.**
Without it, native platforms look fine (they default to a system font)
but React Native Web falls back to the browser default serif font.

`Wordmark` is the only thing using `typography.displayFontFamily` (General
Sans Bold, `assets/fonts/`) — a single deliberate display font, everything
else stays on the free system font. Don't extend the display font to other
text without a real reason; that's exactly the scope creep flagged as the
risk when this was decided.

`AppLoadingScreen` is the branded full-screen loading state used by the
root layout during the initial session check. `LoadingState` stays the
generic bare spinner for smaller in-context loading later (e.g. a data
fetch inside an already-branded screen) — don't reach for the branded
version there.

Anything specific to a single feature belongs in
`features/<feature>/components/` instead.
