# Roadmap

Written 2026-11-16. The single place that says what happens next, in what
order, and when to stop. Step-by-step setup lives in `docs/NEXT_STEPS.md`;
day-to-day running in `docs/OPERATIONS.md`; ready-to-run work items in
`docs/tasks/`.

## Where things stand

Built and tested (617 app tests, 127 database tests, 75 server-function
tests): the full marketplace flow, Deal Sheets and the "paid on time"
record, legal pages with 18+ and terms consent, data export, automatic
deletion of old data, moderation, security hardening, thumbnails, offline
handling, a Content-Security-Policy, secret scanning and bill caps.

Not live anywhere: every migration after `20261105100000`, the updated
server functions and the web deployment. The live Supabase project is the
old staging copy.

Half done: the design refresh (depth tokens exist in `lib/theme.ts`, not
yet applied to components) and the accessibility audit (not started beyond
earlier quick fixes).

## What this is

A low-cost experiment, not yet a business. The competitor review
(`docs/marketing/competitors.md`) judged it feasible to try at about £34 a
month and unlikely (well under one in five) to become self-sustaining in
one city. The plan below is built around finding out cheaply, with fixed
points at which to stop.

## Phases

### Phase A: finish the build (now to 6 December 2026)

Tasks T01 to T08 in `docs/tasks/`. In order: design tokens applied,
accessibility audit and statement, Expo SDK 58 with over-the-air updates,
web deploy pipeline, staging rehearsal, founder metrics.

Done when: `npm run check` passes, the staging project runs the current
code end to end with a real sign-up, and the accessibility statement is
published in the app.

### Phase B: production and closed beta (7 December to 3 January)

Owner tasks from `docs/NEXT_STEPS.md` phases 1 and 2 (accounts, London
project, email, domain, free legal checks, bill caps), then 10 to 20
invited Leeds users. Brand, landing page with an opt-in waitlist, videos
(tasks T09 to T11).

Done when: 10 real people have signed up on production, at least 3
listings were reviewed and published, and nothing in the monthly
checklist in `docs/OPERATIONS.md` is red.

### Phase C: Leeds launch and the 90-day test (4 January to 4 April 2027)

**Online only** (decided 2026-11-16: no in-person events or meetings).
Outreach runs through LinkedIn, online founder and freelancer
communities, university enterprise newsletters and partner mailing
lists; the plan is `docs/marketing/online-launch.md` (task T13), which
replaces the in-person parts of `docs/marketing/city-launch.md`. Ten
owner interviews by video call in the first 60 days. No charges.

The ranges below came from a review that assumed weekly in-person
outreach. Treat them as optimistic until T13 re-estimates them for an
online-only launch.

Measured at day 30, 60 and 90 with the queries from task T07:

| Measure (cumulative)              | Day 30 | Day 60 | Day 90  |
| --------------------------------- | ------ | ------ | ------- |
| Professional sign-ups             | 30-120 | 60-250 | 100-400 |
| Approved listings                 | 5-15   | 15-35  | 25-70   |
| Contact exchanges (both accepted) | 0-4    | 3-12   | 6-25    |
| Confirmed outcomes                | 0-2    | 1-6    | 3-15    |

(Listings, exchanges and outcomes are the ranges in the competitor
review; the sign-up row is a planning estimate.)

### Decision at day 90 (about 4 April 2027)

Continue only if all are true:

- at least 8 confirmed outcomes and 35 listings from owners you did not
  know personally;
- at least 10 owners said yes to a specific paid product and at least 3
  committed money or a written "I would pay £X";
- your time stayed under about 12 hours a week;
- a written answer exists on the right-to-work "online matching service"
  question.

If the numbers are under half of those: stop building, leave the site up
at about £34 a month, and treat it as a finished experiment. That outcome
is acceptable and planned for.

### Phase D: only if the day-90 decision is "continue"

1. First revenue test: a paid Deal Sheet toolkit for owners (templates,
   branded PDF, e-signature). It is a fee for a document service, not for
   a match, so it carries the least legal exposure. Sponsorship from
   coworking spaces, universities and the Growth Hub runs alongside from
   day one because partners also bring users.
2. Form the limited company before taking money.
3. Leeds Digital Festival Mini-Fest (20 to 22 April 2027) as the second
   push; consider Manchester afterwards.
4. Revisit, with real data: opt-in email digests, in-app messaging,
   business signals on owner profiles (Companies House number, Fair
   Payment Code).

Listing fees and subscriptions stay switched off unless the billing gate
in `docs/NEXT_STEPS.md` Phase 5 is cleared.

## Standing rules

- No charge of any kind before the written right-to-work answer.
- Professionals never pay.
- No messages to users beyond sign-up confirmation and password reset
  unless they opt in.
- Money is committed one stage at a time (`docs/NEXT_STEPS.md`, "Spending
  in stages").
- Dates that will bite if ignored: SDK 58 upgrade before 31 January 2027
  (the dependency check fails after that); subscription law changes on
  1 January 2027; ICO fee renewal yearly.

## Decisions waiting on the owner

1. Run as an individual for now, or form the company before launch.
2. Sign-off from your employer that DirectWork is your own project.
3. Whether the waitlist collects emails (needs an opt-in tick box and a
   line in the privacy notice) or just links to sign-up.
4. Whether to add business signals on owner profiles before launch or
   after day 90.
