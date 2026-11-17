# T10: Launch videos with Remotion

**Model:** Sonnet. **Size:** two sessions. **After:** T01, so the
screens look final.

## Goal

Five short vertical videos and one 90-second explainer from
`docs/marketing/video-scripts.md`, made from real app screens.

## Do

1. Create `marketing/video/` with its own `package.json`, so nothing is
   added to the app's dependencies. Check Remotion's licence terms for a
   solo founder first and note them in a README there.
2. Capture the screens listed in the scripts (the capture list marks
   which are ready) with Playwright against the mocked preview, at phone
   size.
3. Build one Remotion composition per script: screen captures, on-screen
   text from the script, simple transitions. No stock footage, and no
   invented testimonials or numbers.
4. Render to MP4 at 1080 by 1920. Keep the outputs out of git (add them
   to `.gitignore`).

## Done when

Six MP4 files render without errors, and every on-screen claim appears
in the allowed list in `docs/marketing/messaging.md`.
