# Appropriate policy document: criminal-offence data in reports

> **Draft for solicitor review.** Prepared 2026-11-07 from the team's legal
> review. Not legal advice. The solicitor should confirm which Schedule 1
> condition applies and whether this document is required for it (open
> question 7 in `uk-law-register.md`).
>
> Owner sign-off: Name [ ] Role [ ] Date [ ]
>
> Solicitor reviewed: Name and firm [ ] Date [ ]
>
> Next review: [date, at least yearly]. Keep this document for at least 6
> months after we stop the processing, and give it to the ICO on request.

## What data this covers

UK GDPR Art 10 covers personal data about criminal convictions and
offences, which the ICO says includes **unproven allegations**. On
DirectWork that means:

- reports filed by users with reasons such as "scam", "harassment" or other
  illegal behaviour, and the free-text details they add;
- admin notes and outcomes on those reports;
- legal-hold reasons that refer to a crime (for example an NCA report).

We never ask for criminal records, and we don't run background checks.

## Conditions we rely on

- Lawful basis (Art 6): legitimate interests (LIA 2), or Art 6(1)(ea)
  where it concerns detecting or preventing crime; legal obligation for
  CSEA reporting.
- Art 10 condition under the Data Protection Act 2018, s.10(5) and
  Schedule 1 [solicitor to confirm]:
  - Part 2 **para 10**: preventing or detecting unlawful acts;
  - Part 2 **para 14**: preventing fraud;
  - Part 2 **para 18**: safeguarding of children and individuals at risk;
  - reached for criminal-offence data through Part 3 **para 36**.

## How we comply with the principles (Art 5)

| Principle                 | What we do                                                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lawful, fair, transparent | The privacy notice explains reports, who sees them and how long they're kept. The report form doesn't promise more anonymity than we give                   |
| Purpose limitation        | Report data is used only for moderation, safety and legal duties. Never for marketing, ranking or profiling                                                 |
| Data minimisation         | Fixed report reasons; free text capped; reports capped at 10 a day per user                                                                                 |
| Accuracy                  | An admin reviews every report; a report is an allegation, not a finding; outcomes are recorded                                                              |
| Storage limitation        | See below                                                                                                                                                   |
| Security                  | Only admins can read reports (RLS and column grants); reporters can't see which admin resolved their report; admins use two-factor sign-in on the dashboard |
| Accountability            | This document, the record of processing (`ropa.md`) and the LIA are kept and reviewed                                                                       |

## Retention and erasure

- Open reports: until resolved.
- Resolved reports: deleted **3 years** after resolution if we acted,
  **12 months** if dismissed (automatic nightly job,
  `private.apply_retention`).
- When the reporter or the reported person deletes their account, the
  report stays **without** the links to either person.
- Legal holds: until the legal period ends (CSEA: content and related data
  1 year, the NCA reference 5 years), then removed.
- Erasure requests: we may refuse to erase report data while it's needed
  for legal claims or obligations (Art 17(3)(b), (e)), and say why.
