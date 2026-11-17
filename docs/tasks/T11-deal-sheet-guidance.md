# T11: Deal Sheet guidance from the competitor review

**Model:** Sonnet. **Size:** one session.

## Goal

Two cheap improvements the competitor review recommended copying
(`docs/marketing/competitors.md` section 6b): trial-project guidance for
partner deals, and pay and equity ranges shown up front.

## Do

1. In the Deal Sheet form for partner collaborations
   (`features/deals/`), add short guidance text: agree a trial project
   of two to four weeks before committing equity, and write down hours,
   decision rights and what happens if either person leaves. Text only,
   no new fields.
2. On listing cards and the listing page, make sure the pay range and,
   for partner listings, the equity terms already in the data are shown
   before the apply button, not below it. Layout only.
3. Tests for the new text and the ordering.

## Don't

No new database fields. No claims about legal effect: the Deal Sheet is
a record of what both sides agreed, not legal advice.

## Done when

`npm run check` passes.
