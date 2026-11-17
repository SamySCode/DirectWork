# T03: Automated accessibility audit and statement

**Model:** Sonnet. **Size:** one session. **After:** T02.

## Goal

Run axe against the built web app, fix what it finds, and write the
accessibility statement.

## How

1. Build: `npx expo export --platform web --output-dir <temp folder>`.
2. A mocked-backend preview exists outside the repo at
   `%TEMP%/claude/shots/` (`preview.js`, `preview-mock.js`, with
   Playwright installed there). If it is missing, write a small
   Playwright script that serves the export and stubs the Supabase
   requests. Install `@axe-core/playwright` in that temp folder only,
   never in the repo.
3. Run axe (WCAG 2.2 A and AA rules) on: welcome, sign-up, sign-in,
   forgot password, the legal index and one legal page, help; then
   signed in: home, discover, a listing, an application, profile, edit
   profile, inbox, a Deal Sheet. Light and dark.
4. Fix violations in the shared components first, screens second.
5. Set a page title per route and `lang="en-GB"` on the web document if
   missing.
6. Write `docs/ACCESSIBILITY.md`: the standard aimed for, what was
   tested and how, counts before and after, known limits, and a short
   statement the owner can publish, with a contact placeholder. Add the
   statement as a document in `features/legal/documents/` and link it
   from the Help and legal screen, following the pattern of the existing
   documents there.

## Done when

- axe reports no serious or critical violations on the listed screens,
  or each remaining one is listed with a reason.
- `npm run check` passes.
