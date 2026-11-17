# T05: Web deploy pipeline (Cloudflare)

**Model:** Sonnet. **Size:** one session.

## Goal

Pushing to `main` deploys the web app to Cloudflare, with nothing to do
by hand afterwards.

## Read first

`docs/NEXT_STEPS.md` step 2.17, `docs/OPERATIONS.md`, `public/_headers`,
`scripts/apply-web-headers.js`, `.github/workflows/ci.yml`.

## Do

1. Add `wrangler.jsonc`: static assets from `./dist`, with
   `not_found_handling` set to single-page application.
2. Add a deploy job to GitHub Actions that runs only on `main`, after CI
   passes: `npm ci`; `npm run build:web` with
   `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   taken from repository variables (they are public values); then
   `wrangler deploy` using the `CLOUDFLARE_API_TOKEN` and
   `CLOUDFLARE_ACCOUNT_ID` secrets. Pin actions by commit SHA, as the
   existing workflow does.
3. The job must fail if the built `_headers` still contains
   `SUPABASE_PROJECT_HOST`.
4. Write the three things the owner creates by hand (API token, account
   id, repository variables) into `docs/NEXT_STEPS.md` step 2.17.

## Also: link previews (added 2026-11-17)

The launch runs on shared links, and a DirectWork link pasted into
LinkedIn, WhatsApp or Slack currently shows a bare card: the built
`index.html` has a title and description but no Open Graph or Twitter
tags and no preview image. Preview crawlers don't run JavaScript, so
every address gets whatever is in that one file.

- Make a 1200 by 630 preview image from the brand (ink gradient,
  wordmark, the welcome headline) and serve it from the site root.
- Add `og:title`, `og:description`, `og:type`, `og:site_name`,
  `og:url`, `og:image` and `twitter:card` (`summary_large_image`).
  `og:image` and `og:url` must be absolute, so they need the real domain:
  inject them in `scripts/apply-web-headers.js` from a build-time value,
  not from a new `EXPO_PUBLIC_` variable (the guard test counts those).
- Check the result with LinkedIn's Post Inspector once deployed.
- Per-listing previews (the listing's own title in the card) would need
  server-side rendering or an edge worker. Not for this task.

## Done when

`npm run check` passes, the workflow file parses as valid YAML, and the
owner steps are written down. The deploy itself can only be verified
once the owner adds the secrets; say so.
