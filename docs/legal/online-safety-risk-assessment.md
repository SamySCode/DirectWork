# Illegal content risk assessment (Online Safety Act 2023)

> **Draft for solicitor review.** Prepared 2026-11-07 from the team's legal
> review. Not legal advice.
>
> Owner sign-off: Name [ ] Role [ ] Date [ ]
>
> Solicitor reviewed: Name and firm [ ] Date [ ]
>
> Next review: [date, at most 12 months after sign-off], and before any
> significant design change (for example messaging, payments between users,
> or under-18 users).

## Why we need this

DirectWork is a **user-to-user service** under the Online Safety Act 2023
(s.3(1)): profiles, listings, references, owner questions and answers, cover
notes and images are content that other users see. It is not exempt
(Sch 1). A new service must complete this assessment within **3 months of
its first day** (Sch 3 para 3(2)(a)), keep a written record (s.23) and redo
it before significant changes. We are completing it before the closed beta.

Method: Ofcom's four steps (Risk Assessment Guidance and Risk Profiles).
Ofcom: <https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/roadmap-to-regulation>;
summary of the codes:
<https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/information-for-industry/illegal-harms/summary-of-our-decisions.pdf>.

**Named person accountable** for illegal content, reporting and complaints
duties (Ofcom code measure ICU A2): [NAME], [ROLE].

## Step 1: Understand the harms and our service

**The service.** A UK-first professional marketplace. Owners post listings
(paid work or equity partnerships); every listing is reviewed by a person
before it goes live. Professionals apply with a cover note and up to 3 image
attachments that only the owner sees. Owners can ask up to 3 questions on an
application. Email addresses are revealed to the two parties only after both
accept. After 7 days of confirmed work, each side can write one reference.
There is no social feed, no public posting, no likes, no followers and no
direct messaging.

**Users.** Adults (18+, self-declared at sign-up, terms accepted). Expected
to be small at launch (tens to hundreds of UK users). Sign-up is open, so
profiles are effectively semi-public to anyone who signs up.

**Risk factors from Ofcom's risk profiles that apply to us:**

- marketplace / listings functionality;
- user profiles;
- image posting (avatars, portfolio, listing images, private application
  attachments sent to one owner);
- contact between users (questions and answers; contact reveal moves
  contact off the platform).

**Risk factors that don't apply:** livestreaming, direct messaging, group
chat, anonymous posting, a recommender feed, encrypted messaging, file
sharing.

## Step 2: Assess the risk of each kind of illegal content

Likelihood and impact: Low / Medium / High. "Residual" is the risk with our
current controls in place.

| Harm (priority offences)                                                                                                                     | How it could happen here                                                                                   | Existing controls                                                                                                                                                                                                                                                                                                                                                                                                                        | Residual risk                                                            | Review |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------ |
| **Fraud and scams** (Fraud Act 2006 ss.2, 4, 7, 9; Sch 7 para 33): fake jobs, advance-fee "training", "equipment" or "admin" fees            | A fake listing collects applicants, then asks them for money after contact reveal                          | Every listing reviewed by a person before publishing, with a checklist covering scams and upfront fees; community guidelines ban asking professionals for money; "DirectWork never asks you to pay to apply" on the apply screen; a "Before you start" safety card when contact details are revealed; contact details blocked in text before both sides accept; report button on listings and profiles; listing take-down via moderation | **Medium** (scams can begin after contact moves off-platform)            | [date] |
| **Money-mule recruitment** (Proceeds of Crime Act 2002 ss.327-329; Sch 7 para 32)                                                            | "Payment processing" or "receive and forward funds" roles                                                  | Guidelines ban payment-processing and money-handling roles; reviewer checklist; report reasons                                                                                                                                                                                                                                                                                                                                           | **Low–Medium**                                                           | [date] |
| **Modern slavery and trafficking, illegal working** (Modern Slavery Act 2015 s.2; Immigration Act 1971 s.25; Sch 7 paras 23-24)              | Exploitative roles, unpaid "trials", work for people without the right to work                             | Human listing review; guidelines ban illegal work and require National Minimum Wage on the paid route; partner listings need structured admission criteria (stops "equity-only" jobs); owners are responsible for right-to-work checks under the Terms                                                                                                                                                                                   | **Low–Medium**                                                           | [date] |
| **Sexual exploitation of adults** (Sexual Offences Act 2003 ss.52-53; Sch 7 para 27)                                                         | Fake modelling or "personal assistant" jobs                                                                | Human listing review; guidelines ban sexual services; report reasons                                                                                                                                                                                                                                                                                                                                                                     | **Low**                                                                  | [date] |
| **Harassment, stalking, threats** (Sch 7 paras 3-11)                                                                                         | A rejected applicant or owner contacts someone repeatedly; contact reveal gives an email address           | Email revealed only after **both** accept; blocks (silent), and a block now withdraws pending applications and hides contact details either way; reports; owner questions capped at 3                                                                                                                                                                                                                                                    | **Medium** (once email is shared, contact leaves our service)            | [date] |
| **CSEA via image uploads** (Sch 6), plus intimate image abuse, cyberflashing (s.66A, s.66B Sexual Offences Act 2003) and extreme pornography | An avatar, portfolio, listing image, or an attachment sent privately to one owner                          | 18+ only; images re-encoded on upload; per-user file caps and 2 MB limit; listing images reviewed with the listing; report button; NCA registration and the CSEA procedure (`docs/NEXT_STEPS.md` step 2.20); legal hold blocks account deletion                                                                                                                                                                                          | **Low** (adult professional audience, no messaging), but **high impact** | [date] |
| **Discriminatory listings** (Equality Act 2010 ss.39, 111-112; hate offences, Public Order Act 1986, Sch 7 para 5)                           | Listings excluding people by age, sex, race, religion, disability; health questions before an offer (s.60) | Guidelines ban discrimination and pre-offer health questions; reviewer checklist names the wording to look for; report reasons; owners attest their listings are lawful                                                                                                                                                                                                                                                                  | **Medium** (subtle wording gets past review)                             | [date] |
| **Unauthorised financial promotions** (FSMA 2000 ss.21, 23-25; Sch 7 para 35)                                                                | Partner listings offering shares or "buy-in"                                                               | Guidelines ban asking professionals to invest; reviewer checklist; open question for the solicitor                                                                                                                                                                                                                                                                                                                                       | **Low–Medium**                                                           | [date] |
| **Terrorism** (proscribed organisations)                                                                                                     | Accounts representing a proscribed group                                                                   | Human listing review; report button; removal rule in the moderation guide                                                                                                                                                                                                                                                                                                                                                                | **Low**                                                                  | [date] |
| **Other illegal content** (defamation is civil, handled separately)                                                                          | False statements in references or profiles                                                                 | References only after mutually confirmed work, one per collaboration, no editing; defamation notice procedure                                                                                                                                                                                                                                                                                                                            | **Low–Medium**                                                           | [date] |

## Step 3: Decide measures, implement them, record them

Measures from Ofcom's Illegal Content Codes that apply to every
user-to-user service, and what we do:

| Code measure                                    | What we do                                                                                      | Status                                                                                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| ICU A2: named accountable person                | [NAME] above                                                                                    | To sign                                                                                                                                   |
| ICU C1: content moderation function             | Admin review queue for listings and reports; one person works it daily                          | Built; needs a daily operator                                                                                                             |
| ICU C2: swift takedown                          | Listings sent back for changes from a report; profiles suspended by hand in the dashboard today | Partly built (in-app suspension is a later item)                                                                                          |
| ICU D1/D2: complaints systems                   | `docs/legal/complaints-procedure.md`; Complaints & Appeals page in the app                      | Drafted                                                                                                                                   |
| ICU G1/G3: terms with the required substance    | Terms of Service and Community & Listing Guidelines in the app                                  | Drafted, for solicitor review                                                                                                             |
| ICU H1: remove proscribed-organisation accounts | Rule in the moderation guide                                                                    | To write                                                                                                                                  |
| s.20 content reporting                          | Report button on profiles and listings                                                          | Partly built: references, questions, cover notes and images aren't reportable yet, and people without an account can only report by email |
| s.66 CSEA reporting                             | NCA registration and procedure                                                                  | To do (`docs/NEXT_STEPS.md` 2.19-2.20)                                                                                                    |

**Freedom of expression and privacy (s.22).** The contact-details filter
and silent blocks limit what users can say and do. We judged them
proportionate: the filter only applies before both sides accept, and blocks
affect only the two people involved.

## Step 4: Report, review and update

- Keep this file, signed, as the written record (s.23).
- Review at least yearly and before any significant change.
- Watch: report volumes by reason, support emails, NCA reports, Ofcom's new
  measures (Additional Safety Measures statement, 48-hour takedown of
  non-consensual intimate images).

## Known gaps to close

1. In-app account suspension and ban (today a manual dashboard action).
2. Reporting for references, owner questions and answers, cover notes and
   images; a public report route for people without an account.
3. Telling the reporter and the reported user the outcome, with an appeal.
4. A written moderation guide (illegal-content judgements, escalation).
5. File preservation for legal holds.
