# components/

Shared, feature-agnostic UI primitives, styled from `lib/theme.ts`:
`Button`, `Card`/`PressableCard`, `Chip`, `Badge`, `Avatar`,
`EmptyState`, `LoadingState`, `Skeleton`, `ErrorState`, `TextField`, `FadeIn`,
`Screen`, `SectionHeader`, `Wordmark`, `ConnectMark`, `PageHero`/`HeroStats`,
`ImagePickerGrid` (presentation only; picking and uploading live in
`lib/images.ts`), and `Gallery` (horizontal strip with a full-screen viewer).

`Text` wraps React Native's `Text` with `typography.fontFamily` applied —
**always import `Text` from here, never from `react-native` directly.**
Without it, native platforms look fine (they default to a system font)
but React Native Web falls back to the browser default serif font.

`Screen` is the standard page shell: centred content column (capped at
`layout.maxContentWidth` so web/tablet don't stretch), keyboard avoidance,
optional pull-to-refresh, an edge-to-edge `header` slot (hero) and a
pinned `footer` slot for the primary action. Long, paginated lists use a
`FlatList` instead (see Discover) so rows are virtualised.

## Visual language

- **Tab identity**: every tab opens with a `PageHero`, a gradient band
  that always starts from ink, so the tabs read as one family, and ends in
  that tab's own colour: Home iris, Discover cobalt, Applied rose, Listings
  amber, Profile teal (`tabThemes` in `lib/theme.ts`). The tab bar tint
  and that tab's filter chips follow it. Detail screens stay neutral.

- **Palette** (`lib/theme.ts`): ink-indigo for weight, iris violet as the
  working accent, and **signal mint reserved for "it's a match" moments**
  — accepted, contact unlocked, completed, skill matches. Don't spend
  mint on decoration or it stops meaning anything.
- **`ConnectMark`** is the signature: two nodes joined directly by a line
  (owner ↔ professional, no middleman). It appears in the wordmark, the
  welcome screen, the home hero (lit mint once you're working with
  someone), the track record card, the application `ProgressRail`, and the
  app icon. It's built from Views, so there's no SVG dependency.
- **Display font**: General Sans Bold (`typography.displayFontFamily`)
  started out wordmark-only. It now also sets screen titles, section
  headers and card titles. That was a deliberate part of the 2026-11-04
  visual refresh (`docs/OPEN_DECISIONS.md`). Body text stays on the system
  font. Don't use the display face for paragraphs or labels.

## Loading

Three states, picked by what is known about what's coming:

- `Skeleton` (grey boxes in the shape of the content) wherever the layout
  is known: every list, detail page and form. Build the shape from `Bone`,
  `SkeletonLines`, `SkeletonCard` and `SkeletonRows`, or use the page
  presets `SkeletonDetail` and `SkeletonForm`. Shapes that mirror one
  feature's card live with that feature (`ListingSkeletons`,
  `ProfileSkeleton`). Keep paddings and gaps equal to the real component so
  nothing jumps when the data lands. One `Skeleton` wraps a whole group:
  it owns the single pulse animation, the short delay that stops fast
  responses flashing a placeholder, and the "Loading" announcement.
- `LoadingState` (a bare spinner) only where the shape is not known yet:
  checking a reset link, checking whether someone is a reviewer.
- `AppLoadingScreen` is the branded full-screen state the root layout
  shows during the initial session check.

Never show an empty state ("You're all caught up", "No matches") while a
query is still pending. It is a false statement for half a second. Check
`isPending` first and show a `Skeleton`.

## State for screen readers

Don't write `accessibilityState` on its own. React Native Web ignores it,
so on the web a ticked box and an empty one sound the same. Spread
`a11yState({ checked })` from `lib/accessibility.ts` instead: it gives
native `accessibilityState` and the browser the matching `aria-*`.

Anything specific to a single feature belongs in
`features/<feature>/components/` instead.
