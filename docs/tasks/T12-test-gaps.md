# T12: Test gaps from the QA review

**Model:** Sonnet, then a review by the strongest model. **Size:** two
sessions.

## Goal

Close the gaps the QA review found: rules that could be loosened without
any test failing.

## Do

1. Database (`supabase/tests/db/db.test.mjs`): add negative tests for
   each policy that lacks one on these tables: project_memberships,
   project_outcomes, application_status_history,
   application_attachments, admins (nobody can make themselves an
   admin), subscriptions (nobody can set their own plan, including
   through a column grant), and blocks (a delete with no filter removes
   only your own).
2. Listing status rules: a test that a listing cannot go from draft to
   published without review, through any path a client can reach.
3. App: tests for the report and block flows (`features/safety/`) and
   the moderation screen.
4. Server functions: tests for the `actions` and `billing` handlers, in
   the same style as `delete-account/handler.test.ts`.

## Done when

`npm run check` and `npm run test:functions` pass, and you have listed
each rule with the test that now guards it.
