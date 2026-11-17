# Record of processing activities (UK GDPR Art 30)

> **Draft for solicitor review.** Prepared 2026-11-07 from the team's
> data-flow review. Not legal advice.
>
> Owner sign-off: Name [ ] Role [ ] Date [ ]
>
> Solicitor reviewed: Name and firm [ ] Date [ ]
>
> Next review: [date], or whenever we add a processor or a new kind of data.

**Is it required?** Yes. The under-250-employees exemption (Art 30(5))
doesn't apply because the processing isn't occasional and includes
criminal-offence data (reports).

- **Controller:** [LEGAL NAME], [company number], [registered office]
  (same values as `features/legal/operator.json`).
- **Contact:** [privacy@ address].
- **ICO registration:** [ZA…] (tier 1 fee).
- **DPO:** none; not required (Art 37). Responsible person: [NAME].
- **Data subjects:** users (professionals and owners), admins, people who
  contact us.
- **Security measures (Art 30(1)(g)):** RLS on every table with column-level
  grants; sensitive changes only through Edge Functions; no anonymous access
  to any table; private bucket for attachments with 1-hour signed links;
  EXIF stripped from images; PKCE email links; refresh-token rotation;
  re-authentication before account deletion; encrypted session storage on
  phones; rate limits; two-factor for dashboard logins. Details:
  `docs/ACCESS_CONTROL.md`.

## Processors

| Code | Processor                                                | Role and location                                                                                                 | Transfer mechanism                                  |
| ---- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| SB   | Supabase Pte. Ltd. (Singapore), with Supabase, Inc. (US) | Database, Auth, Storage, Edge Functions. Production in **London (eu-west-2)**; staging in Ireland (no real users) | UK Addendum to the EU SCCs, in Supabase's DPA       |
| EM   | Amazon Web Services (Amazon SES, London)                 | Account emails (confirmation, reset)                                                                              | AWS DPA; UK data bridge / UK Addendum for US access |
| WH   | Cloudflare                                               | Web hosting, DNS, email forwarding (support@, privacy@)                                                           | Cloudflare DPA; UK data bridge / UK Addendum        |
| EX   | Expo (EAS)                                               | App builds and over-the-air updates                                                                               | Expo DPA [confirm mechanism]                        |
| SE   | Sentry (EU, Frankfurt) — only if adopted                 | Error reports, personal data scrubbed                                                                             | Sentry DPA                                          |
| ST   | Stripe — only when billing is on                         | Payments: processor, and independent controller for fraud and legal duties                                        | UK–US data bridge (DPF UK Extension)                |
| AP   | Apple, Google                                            | App distribution                                                                                                  | Their own terms (independent controllers)           |

## Activities

Bases: 6(1)(b) contract, 6(1)(c) legal obligation, 6(1)(f) legitimate
interests (see `legitimate-interests-assessments.md`).

| #   | Activity                                           | Purposes                                                   | Data                                                                          | Basis (+ Art 9/10)                                                                     | Recipients                                              | Retention (see `retention-schedule.md`)                                                                        |
| --- | -------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Accounts and sign-in                               | Create and secure accounts; confirmation and reset emails  | Email, password hash, tokens, sessions (IP, browser)                          | 6(1)(b); logs 6(1)(f)                                                                  | SB, EM                                                  | Life of account; logs 7 days                                                                                   |
| 2   | Terms, privacy and age acceptance                  | Evidence of the contract and the 18+ rule                  | Document, version, time                                                       | 6(1)(b), 6(1)(c)                                                                       | SB                                                      | Life of account                                                                                                |
| 3   | Profiles and discovery                             | Discoverable professional profiles                         | Name, headline, bio, location, availability, skills, links, photos, portfolio | 6(1)(b)                                                                                | All signed-in users; images to anyone with the link; SB | Life of account                                                                                                |
| 4   | Listings and curation                              | Publish reviewed listings                                  | Owner identity, listing text, terms, images, review notes                     | 6(1)(b)                                                                                | Signed-in users, applicants, admins, SB                 | Life of account                                                                                                |
| 5   | Applications, questions and answers                | Apply, ask, answer, decide                                 | Cover note, attachments, questions and answers, decision, status history      | 6(1)(b)                                                                                | The owner and the applicant, SB                         | Rejected or withdrawn: 12 months after last change; accepted: while both accounts exist                        |
| 6   | Contact reveal                                     | Let both sides work together                               | Name, email                                                                   | 6(1)(b)                                                                                | The other party                                         | Looked up live, not copied                                                                                     |
| 7   | Collaborations, outcomes, references, track record | Work history confirmed by both sides                       | Outcomes, summaries, references                                               | 6(1)(b) for the parties; 6(1)(f) for display (LIA 4)                                   | Parties; signed-in users see references and totals      | While both accounts exist                                                                                      |
| 8   | Reply record and availability                      | Discourage ghosting; accurate availability                 | Application times and statuses; availability date                             | 6(1)(f) (LIA 4)                                                                        | Signed-in users                                         | Computed over 180 days                                                                                         |
| 9   | Trust and safety                                   | Reports, moderation, blocks, contact filter, abuse caps    | Reports (including **alleged offences**), blocks, counters                    | 6(1)(f) (LIAs 1-3); **Art 10 + DPA 2018 Sch 1 (see `appropriate-policy-document.md`)** | Admins, SB                                              | Reports: 3 years after resolution if actioned, 12 months if dismissed; anonymised if either account is deleted |
| 10  | Legal holds                                        | Keep data the law requires (CSEA reporting)                | User id, reason                                                               | 6(1)(c)                                                                                | Admins, NCA                                             | Until the legal period ends                                                                                    |
| 11  | Activity inbox                                     | In-app notifications                                       | Event type, actor, related records                                            | 6(1)(b)                                                                                | The user, SB                                            | Read 180 days; any 365 days                                                                                    |
| 12  | Data export                                        | Access and portability                                     | The user's own data                                                           | 6(1)(c)                                                                                | The user                                                | Not stored                                                                                                     |
| 13  | Subscriptions and billing (when on)                | Provide Pro; accounting                                    | Email, user id, Stripe ids, plan                                              | 6(1)(b); 6(1)(c) records                                                               | ST, SB, accountant                                      | Billing records 6 years after the financial year                                                               |
| 14  | Security logs and backups                          | Security, troubleshooting, recovery                        | IP, browser, requests, errors, full database backups                          | 6(1)(f)                                                                                | SB (SE if adopted)                                      | Logs 7 days; backups 7 days (plus our encrypted off-site copy, 35 days)                                        |
| 15  | Requests and complaints                            | Rights requests, DPA s.164A complaints, content complaints | Requester identity, correspondence                                            | 6(1)(c)                                                                                | Us; the ICO if escalated                                | 2 years after closure                                                                                          |
| 16  | Admins                                             | Run review and moderation                                  | Admin user ids                                                                | 6(1)(b)/(f)                                                                            | —                                                       | While in role                                                                                                  |
| 17  | App delivery                                       | Serve the website; builds and updates                      | IP, browser, URLs; installation id (EAS Update)                               | 6(1)(f)                                                                                | WH, EX                                                  | Provider default (set the minimum)                                                                             |

Special-category data (Art 9) isn't asked for. Users may volunteer it in
free text; the guidelines ask them not to, and owners may not ask health
questions before an offer.
