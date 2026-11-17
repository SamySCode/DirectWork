# T07: Founder metrics for the 90-day test

**Model:** Sonnet, then a review by the strongest model (it touches the
database). **Size:** one session.

## Goal

The owner must be able to read the day 30, 60 and 90 numbers in
`docs/ROADMAP.md` in under a minute, with no analytics service.

## Read first

The standing rules in `docs/ACCESS_CONTROL.md` (revoke then grant; wrap
`auth.uid()`), and `app/review.tsx` for the admin screen pattern.

## Do

1. New migration (next timestamp after the latest file in
   `supabase/migrations/`): a function `public.get_founder_metrics()`
   returning one row of counts, usable only by admins. It checks
   `private.is_admin((select auth.uid()))` and raises 42501 otherwise.
   Revoke from public and anon; grant to authenticated (the function
   does its own check).
   Counts, all-time and for the last 30 days: profiles created; profiles
   by intent (seeking paid work, seeking partnership, hiring); listings
   submitted, approved and live now; median hours from submit to review
   decision; applications; contact exchanges (applications accepted);
   confirmed outcomes (completed and abandoned); Deal Sheets agreed;
   payment reports by outcome; open reports and open payment disputes.
2. A small admin-only screen `app/metrics.tsx`, linked from the Profile
   menu for admins (same pattern as the review queue), showing the
   numbers in plain cards. No charts library.
3. Tests: database tests that a non-admin is refused and the counts are
   right on seeded data; a component test that the screen renders them.

## Done when

`npm run check` passes, and EXPLAIN on a seeded PGlite database shows no
sequential scan over applications or activity.
