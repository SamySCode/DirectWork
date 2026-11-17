# Complaints procedure: content, appeals and data protection

> **Draft for solicitor review.** Prepared 2026-11-07 from the team's legal
> review. Not legal advice. The user-facing version is the in-app
> "Complaints & Appeals" page (`features/legal/documents/policies.ts`); keep
> the two in step.
>
> Owner sign-off: Name [ ] Role [ ] Date [ ]
>
> Solicitor reviewed: Name and firm [ ] Date [ ]
>
> Next review: [date, at least yearly].

Required by: Online Safety Act 2023 s.21 and Ofcom codes ICU D1/D2 (content
complaints and appeals); Data Protection Act 2018 s.164A (data-protection
complaints, from 19 June 2026); consumer law (a complaints policy, if
billing is on). <https://www.legislation.gov.uk/ukpga/2018/12/section/164A>

## Channels

- In the app: the Report button on profiles and listings.
- Email: [complaints@ or support@] for content complaints and appeals,
  [privacy@] for data protection. Anyone can use these, with or without an
  account.
- By post to the address in `features/legal/operator.json`.

## Types of complaint and targets

| Type                                           | Examples                                                           | Acknowledge                                                | Aim to resolve                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Illegal or harmful content                     | Scam listing, harassment, discrimination, an image                 | 2 working days                                             | 7 days; **suspected CSEA or threats to life: immediately** (see `docs/NEXT_STEPS.md` 2.20, or call 999) |
| Appeal against our decision                    | Listing rejected or taken down, account suspended, content removed | 5 working days                                             | 14 days, reviewed by someone other than the original decider where possible                             |
| We aren't meeting our Online Safety Act duties | Reports ignored, terms not applied                                 | 5 working days                                             | 30 days                                                                                                 |
| Data protection                                | How we used, kept or shared personal data                          | **Within 30 days (legal maximum)**; aim for 5 working days | Without undue delay; keep them updated                                                                  |
| Billing (when on)                              | Charges, refunds, cancellation                                     | 5 working days                                             | 14 days                                                                                                 |
| Defamation                                     | Something posted about them is false and harmful                   | Follow `defamation-notice-procedure.md` (48-hour steps)    | —                                                                                                       |

## Steps

1. **Log** every complaint: date, channel, type, who, what, deadline.
2. **Acknowledge** within the target, saying what happens next and when.
3. **Investigate.** Look at the content, the report history and any notes.
   For data protection: what data, what we did, and whether it matched the
   privacy notice.
4. **Act.** Remove or restore content, lift or keep a suspension, fix a data
   problem.
5. **Reply** with the outcome and reasons in plain language. For data
   protection, tell them they can complain to the ICO:
   <https://ico.org.uk/make-a-complaint/>. For billing, tell them about any
   alternative dispute resolution scheme we must use (DMCC Act 2024 s.308),
   or that there isn't one.
6. **Close** the log entry. Keep complaint records 2 years.

## Appeals

- Anyone whose content was removed, whose listing was rejected or taken
  down, or whose account was restricted can appeal by email.
- Where possible a different person reviews the appeal. If the decision was
  wrong, reverse it and tell them.
- Today the app doesn't tell people the outcome of reports about them; until
  it does, email them the decision and the appeal route.

## Watch for patterns

Once a quarter, look at the log for repeated problems (the same listing
type, the same user) and update the guidelines, the reviewer checklist or
the risk assessment.
