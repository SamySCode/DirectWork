# UK law register

> **Draft for solicitor review.** Prepared 2026-11-07 from the team's legal
> review of 2026-11-05. Not legal advice.
>
> Owner sign-off: Name [ ] Role [ ] Date [ ]
>
> Solicitor reviewed: Name and firm [ ] Date [ ]
>
> Next review: [date], and whenever we add billing, messaging, EU users or a
> new kind of data.

Status: **Done** (built or in place), **Drafted** (written, awaiting sign-off
or solicitor), **To do**, **Trigger** (only when something happens), **N/A**.
Step numbers refer to `docs/NEXT_STEPS.md`.

| Law                                                                                                                                             | Applies?                                           | What we do                                                                                                                                             | Status                         | Owner action                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | -------------------------------------------------------------------- |
| **Company law**: Companies Act 2006, trading disclosures (SI 2015/17)                                                                           | Yes, once a Ltd                                    | Name, number and registered office in the imprint (Contact page) and on emails and invoices                                                            | To do                          | Incorporate (2.1); fill `operator.json` (2.7)                        |
| **E-Commerce Regulations 2002** reg 6 (who we are), reg 19 (hosting defence)                                                                    | Yes                                                | Contact page with legal name, address, email, company and VAT numbers; prompt removal once aware of unlawful content                                   | Drafted                        | 2.7; solicitor question 6                                            |
| **UK GDPR and Data Protection Act 2018**                                                                                                        | Yes                                                | Privacy notice; record of processing; LIAs; retention schedule; in-app export and deletion; breach, access and complaints procedures                   | Drafted                        | ICO fee (2.3); sign `docs/legal/` (2.22); solicitor (2.9)            |
| ICO data protection fee (Charges and Information Regs 2018)                                                                                     | Yes                                                | Tier 1 fee in the company's name; number in the privacy notice                                                                                         | To do                          | 2.3 (£52/year)                                                       |
| Criminal-offence data, DPA 2018 Sch 1                                                                                                           | Yes (reports)                                      | `appropriate-policy-document.md`; admin-only access; retention                                                                                         | Drafted                        | Solicitor question 7                                                 |
| DPIA, UK GDPR Art 35                                                                                                                            | Likely                                             | At least a documented screening (contact reveal, semi-public profiles, references, reports)                                                            | To do                          | Ask Code or the solicitor for a short DPIA                           |
| **Data (Use and Access) Act 2025**                                                                                                              | Yes                                                | 30-day acknowledgement of data complaints (from 19 Jun 2026); clock-stop and proportionate search for access requests; recognised legitimate interests | Drafted                        | `complaints-procedure.md`, `subject-access-procedure.md`             |
| **PECR 2003** (as amended 2026): device storage, marketing email                                                                                | Storage: yes. Marketing: trigger                   | Strictly necessary storage only (sign-in session); no analytics or ads; cookies notice                                                                 | Done                           | Before any marketing email: consent or soft opt-in, plus unsubscribe |
| **Online Safety Act 2023**: risk assessment, children's access, terms, reporting, complaints, takedown, records                                 | Yes (user-to-user service)                         | `online-safety-risk-assessment.md`, `childrens-access-assessment.md`; human listing review; reports; blocks; 18+                                       | Drafted                        | Name the accountable person and sign (1.9, 2.21); review yearly      |
| OSA CSEA reporting to the NCA (SI 2026/268, from 7 Apr 2026)                                                                                    | Yes, any size                                      | Register on the NCA portal; procedure; legal hold blocks account deletion                                                                              | Partly done (legal hold built) | 2.19, 2.20                                                           |
| **Employment Agencies Act 1973** and Conduct Regulations 2003                                                                                   | Probably                                           | Professionals never pay; listings capture most of the hirer information; 12-month application records                                                  | Uncertain                      | Solicitor scope view and Fair Work Agency query (3.2)                |
| **Equality Act 2010**: employment service-provider (s.55-56), discriminatory listings (s.112), pre-offer health questions (s.60), accessibility | Yes                                                | Guidelines ban discrimination and health questions; reviewer checklist; report reason; accessibility basics                                            | Partly done                    | Add an accessibility statement; keep the checklist current           |
| **Illegal working: "online matching service"** (IANA 2006 ss.14A-15A, from 1 Oct 2026)                                                          | Free tier no; paid matching possibly               | Billing stays off                                                                                                                                      | Blocking for billing           | Immigration advice before any charge (Phase 5)                       |
| National Minimum Wage Act 1998                                                                                                                  | Through listings                                   | Paid route must meet NMW; partner listings must be genuine partnerships; owners responsible                                                            | Drafted (Terms, guidelines)    | —                                                                    |
| FSMA 2000 (financial promotions)                                                                                                                | Possibly, partner listings                         | Guidelines ban asking professionals to invest or buy in                                                                                                | Uncertain                      | Solicitor question 3                                                 |
| Modern Slavery Act 2015                                                                                                                         | Offences: via OSA. Statement: no (under £36m)      | Covered in the risk assessment and guidelines                                                                                                          | Drafted                        | —                                                                    |
| **Consumer Rights Act 2015** (fair terms)                                                                                                       | Yes, including free accounts                       | Terms written plainly; no exclusion of statutory rights                                                                                                | Drafted                        | Solicitor (2.9)                                                      |
| Consumer Contracts Regulations 2013 (pre-contract info, 14-day cancellation)                                                                    | Trigger: billing                                   | Checkout information and cancellation flow                                                                                                             | To do                          | Before billing                                                       |
| **DMCC Act 2024**: unfair practices, fake reviews (Sch 20), ADR information (s.308), subscription contracts (from 1 Jan 2027)                   | Reviews and practices: yes. Subscriptions: trigger | "Confirmed by both sides", never "verified"; Featured labelled as paid; references policy                                                              | Partly done                    | Before billing: renewal reminders, easy cancellation                 |
| **Defamation Act 2013** s.5 and the 2013 Operators Regulations                                                                                  | Yes                                                | `defamation-notice-procedure.md`                                                                                                                       | Drafted                        | Solicitor question 8                                                 |
| Copyright (CDPA 1988)                                                                                                                           | Yes                                                | Content licence in the Terms; takedown on notice                                                                                                       | Drafted                        | Add open-source and font licence notices                             |
| **Tax**: HMRC registration, records, VAT (£90k), platform reporting (SI 2023/817), EU VAT                                                       | Trigger: first revenue                             | Billing off; UK-only when on                                                                                                                           | Trigger                        | Phase 5                                                              |
| **Apple App Store Guidelines** 1.2, 3.1.1/3.1.3(b), 5.1.1                                                                                       | Yes (iOS)                                          | Reporting, blocking, published contact, in-app deletion, privacy link                                                                                  | Partly done                    | Decide 3.1.3(b) (4.2)                                                |
| **Google Play policies**: UGC, account-deletion web page, Data safety, target API 36                                                            | Yes (Android)                                      | Unskippable terms acceptance at sign-up; public `/legal/account-deletion` page                                                                         | Done in code                   | Data safety form (4.5)                                               |
| Stripe Services Agreement                                                                                                                       | Trigger: billing                                   | Policy pages, receipts                                                                                                                                 | Trigger                        | Before billing                                                       |
| EU GDPR / Digital Services Act                                                                                                                  | Trigger: targeting the EU                          | UK-only launch                                                                                                                                         | N/A for now                    | Phase 5                                                              |

## Open questions for the solicitor

1. Is DirectWork an employment agency, and which Conduct Regulations duties
   apply to a self-serve, curated listing platform?
2. Would the Pro subscription (or concierge matching) make DirectWork an
   "online matching service" that "charges a fee or commission in return for
   making such matches"? What is the statutory excuse for platforms?
3. Are partner-route equity offers financial promotions or regulated
   activity?
4. Are founders buying Pro to start a venture "consumers"?
5. Does DMCC Act Sch 20 para 13 (fake reviews) cover references about
   professionals?
6. Does reviewing every listing before publication weaken the hosting
   defence (E-Commerce reg 19) for listings?
7. Which DPA 2018 Sch 1 condition covers report data, and is an appropriate
   policy document required?
8. Do the 48-hour periods in the Defamation (Operators of Websites)
   Regulations exclude non-business days?
9. What retention periods suit complaints, defamation notices and safety
   records?
10. Apple 3.1.3(b): in-app purchase on iOS, or submit with billing off?

## Main sources

- Online Safety Act: <https://www.legislation.gov.uk/ukpga/2023/50/section/35>;
  Ofcom dates <https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/important-dates-for-online-safety-compliance>;
  CSEA regulations <https://www.legislation.gov.uk/uksi/2026/268/made>.
- Data (Use and Access) Act commencement: <https://www.legislation.gov.uk/uksi/2026/82/made>.
- DPA 2018 s.164A: <https://www.legislation.gov.uk/ukpga/2018/12/section/164A>.
- Employment Agencies Act 1973: <https://www.legislation.gov.uk/ukpga/1973/35/section/13>.
- Border Security, Asylum and Immigration Act 2025 s.48:
  <https://www.legislation.gov.uk/ukpga/2025/31/section/48>.
- DMCC Act 2024: <https://www.legislation.gov.uk/ukpga/2024/13/schedule/20/paragraph/13>.
- Defamation Operators Regulations: <https://www.legislation.gov.uk/uksi/2013/3028/schedule/made>.
- Apple: <https://developer.apple.com/app-store/review/guidelines/>; Google
  account deletion: <https://support.google.com/googleplay/android-developer/answer/13327111>.
