# T02: Accessibility in shared components

**Model:** Sonnet. **Size:** one session. **After:** T01.

## Goal

Meet WCAG 2.2 AA in the shared components, so every screen inherits it.
This is the owner's protection under the Equality Act 2010.

## Read first

`components/` (each file as you reach it), the colours in
`lib/theme.ts`, and `lib/__tests__/contrast.test.ts`.

## Check and fix, component by component

- Accessible name, role and state on every pressable
  (`accessibilityRole`, `accessibilityLabel`, and state for selected,
  checked, disabled, busy and expanded). Pass state with
  `a11yState()` from `lib/accessibility.ts`, never a bare
  `accessibilityState`: React Native Web ignores that prop, so the state
  would be missing on the web build.
- Touch targets at least 44 by 44 points (use `hitSlop` where the visual
  size must stay small).
- Visible keyboard focus on web for every focusable element.
- Text contrast 4.5:1 (3:1 for large text and for the edges of inputs,
  chips and checkboxes) in both themes. Extend the contrast test.
- Form fields: label tied to the input, error text announced
  (`accessibilityLiveRegion="polite"`, and `aria-describedby` on web).
- Headings: screen titles and section titles marked as headings, with a
  level on web.
- Nothing communicated by colour alone (badges and status chips need
  text or an icon).
- Images: meaningful ones labelled, decorative ones hidden from screen
  readers.
- Text scales with the system font size; nothing clips at 200%.
- Motion respects the reduced-motion setting.
- Dialogs and sheets: focus moves in, is trapped, and returns on close.

## Don't

Don't restyle beyond what a fix needs. Don't touch `supabase/`.

## Done when

- `npm run lint`, `npm run typecheck` and `npm run test:unit` pass, with
  a unit test for each behaviour a unit test can express.
- You have listed what was fixed per component, and what still needs a
  manual screen-reader check on a phone.
