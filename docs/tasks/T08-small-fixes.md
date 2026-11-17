# T08: Small fixes batch

**Model:** Haiku (Sonnet if a step needs judgement). **Size:** short.
Do each item, then run `npm run check` once at the end.

1. `README.md`: remove hard-coded test counts; point to
   `docs/ROADMAP.md`, `docs/NEXT_STEPS.md` and `docs/OPERATIONS.md`.
2. `CLAUDE.md` says messaging is "slice 10"; `docs/ARCHITECTURE.md` says
   Phase 3. Make `CLAUDE.md` say "deferred to Phase 3".
3. `features/legal/documents/privacy.ts`: the notice says Supabase data
   is stored in Ireland. Keep the wording, but add a clearly marked
   `REGION` constant at the top of the file and use it in that sentence,
   so the owner changes one word when the London project exists. Add a
   test that the sentence uses the constant.
4. `features/billing/plans.ts`: the free plan copy says "1 live listing
   at a time". Make it say paused and in-review listings count too,
   matching `features/listings/components/OwnerPanel.tsx`.
5. Home screen: listings from owners the user has blocked still appear
   in Home's picks (Discover excludes them). Apply the same exclusion in
   the Home query and share Discover's query key so there is one
   request. Add a test.
6. `docs/LAUNCH.md`: replace any text saying the Content-Security-Policy
   is pending with a pointer to `npm run build:web`.
