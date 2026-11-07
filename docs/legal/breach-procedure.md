# Personal data breach procedure and breach log

> **Draft for solicitor review.** Prepared 2026-11-07 from the team's
> security and data-flow reviews. Not legal advice.
>
> Owner sign-off: Name [ ] Role [ ] Date [ ]
>
> Solicitor reviewed: Name and firm [ ] Date [ ]
>
> Next review: [date, at least yearly]. Rehearse it once a year on staging.

A **personal data breach** is any security incident that leads to personal
data being lost, destroyed, changed, disclosed or accessed without
permission, by accident or on purpose. Examples: a leaked secret key, a
database rule that shows one user's data to another, a lost laptop with an
export, an email sent to the wrong person.

**The clock:** tell the ICO **within 72 hours of becoming aware**, unless the
breach is unlikely to put anyone at risk (UK GDPR Art 33). Tell the people
affected **without undue delay** if the risk to them is high (Art 34). Log
**every** breach, reported or not (Art 33(5)).

## Steps

1. **Write down the time you became aware.** Start the log entry (template
   below). The 72 hours start now, including weekends.
2. **Contain.** Pick what fits:
   - rotate the leaked key: Supabase dashboard > Project Settings > API keys
     (and JWT keys, which signs everyone out); Stripe > Developers > API keys
     > roll key;
   - turn a function off: `npx supabase functions delete <name>`, or remove
     its secret so it refuses requests;
   - suspend an account: Supabase dashboard > Authentication > Users > the
     user > ban;
   - restore from a backup only after saving evidence (backups are 7 days).
3. **Preserve evidence.** Export the relevant logs now: Supabase logs keep
   only 7 days (Pro).
4. **Assess the risk to people.** What data, how many people, how sensitive
   (emails, reports, attachments), could it be used for fraud, harassment or
   identity theft, was it encrypted, is it already contained?
5. **Decide on notifying.**
   - Risk unlikely: don't notify; record why in the log.
   - Risk likely: report to the ICO within 72 hours:
     <https://ico.org.uk/for-organisations/report-a-breach/>. If you don't
     have all the facts yet, report what you know and add the rest later.
   - High risk: also email the affected users (through Amazon SES or your own
     mailbox) in plain language: what happened, what data, what we've done,
     what they should do, and how to contact privacy@.
6. **Tell processors and partners if needed.** Supabase commits to tell us of
   its own breaches without undue delay, where feasible within 48 hours.
7. **Fix the cause** and add a test so it can't recur. Note the fix in the
   log.
8. **Review** within two weeks: what would have caught it sooner?

## Breach log

Keep it as a spreadsheet outside the app (for example, in your password
manager's secure notes or a private document). Keep entries for 5 years
[solicitor to confirm].

| Field                                                | Example                                            |
| ---------------------------------------------------- | -------------------------------------------------- |
| Reference                                            | B-2026-001                                         |
| Became aware (date, time)                            |                                                    |
| How we found out                                     | user email / Supabase alert / Stripe / own testing |
| What happened                                        |                                                    |
| Data and people affected (types, approximate number) |                                                    |
| Containment and when                                 |                                                    |
| Risk assessment and reasoning                        |                                                    |
| Reported to the ICO? When, reference                 |                                                    |
| Users told? When, how                                |                                                    |
| Root cause and fix                                   |                                                    |
| Closed (date)                                        |                                                    |
