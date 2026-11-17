# Deal Sheet and "Pays on time" record — spec

Status: approved by the product owner on 2026-11-07 for build before launch.
Not legal advice: the legal safeguards below come from the team's UK law
review and must be confirmed by the solicitor (see docs/legal/uk-law-register.md).

## Why

Freelancers' biggest unsolved problem is late or missing payment on work agreed
informally (IPSE: ~20 days a year chasing payment; 43% have done unpaid work;
FreeAgent: only 54% of invoices paid on time). DirectWork never handles money, so
instead it makes the terms explicit and makes payment behaviour visible.

## What users get

1. **Deal Sheet** — after an application is accepted, either side can propose a
   Deal Sheet for that collaboration. Both must confirm the same version.
   Any edit creates a new version and clears both confirmations.
2. **Payment reporting** — after each payment due date, the professional records
   "paid on time", "paid late (on <date>)" or "not paid yet".
3. **Pays-on-time record** — a fact-only summary on the owner's profile and
   listings, e.g. "Paid on time on 4 of 5 reported payments", shown only once
   3+ undisputed reports exist.
4. **Late payment letter** — for business-to-business deals only, a prefilled
   letter citing the Late Payment of Commercial Debts (Interest) Act 1998, with
   statutory interest and fixed compensation worked out.
5. **PDF** — either party can save or share a dated PDF of the agreed version.

## Fields (one Deal Sheet per collaboration / membership)

- Scope (required, 20–2,000 chars)
- Pay basis: fixed / hourly / daily / equity-only / mixed; amount and currency
  (GBP/EUR/USD), prefilled from the listing
- Payment terms: days after invoice or milestone (default 14; 0–120)
- Milestones (0–12): title, due date, amount
- IP: "client owns on full payment" / "creator keeps, client gets licence" /
  "joint" / "other" + notes (≤ 500 chars)
- Partner route only: equity %, vesting months, cliff months, decision rights
  text (≤ 500)
- "Both of us are acting in the course of business" checkbox (each party
  confirms; required for the late payment letter)
- Version, who proposed it, owner_confirmed_version, member_confirmed_version,
  agreed_at (set when both confirm the same version)

## Rules

- Only the two parties to an accepted collaboration can read or edit it;
  admins can read it only when handling a dispute (via an admin RPC).
- All writes go through the `actions` Edge Function → `private.*` functions
  (CLAUDE.md: sensitive transitions never client-side).
- Payment reports: only the professional, only for an agreed Deal Sheet, only
  after the due date, one report per milestone (or one per deal if no
  milestones). They can correct their own report within 14 days.
- Disputes: the owner can dispute a report within 14 days of it being made, with
  a reason (20–500 chars). Disputed reports are excluded from the record until an
  admin resolves them (upheld → removed; rejected → counts). Both parties are told
  the outcome in the activity inbox.
- Sock-puppet resistance: a report only counts if the professional's account was
  at least 14 days old when the Deal Sheet was agreed and the collaboration has a
  confirmed outcome or a reported payment due date in the past.
- Record shown only with 3+ counting reports; wording is factual ("reported by
  professionals"), never labels ("bad payer", "unreliable").
- Activity inbox items: deal proposed, deal agreed, payment due (daily job on the
  due date), payment reported, report disputed, dispute resolved. No email/push.
- Account deletion: Deal Sheets and reports cascade with the collaboration
  (anonymisation of counterpart records stays an open decision).

## Late payment letter maths (England & Wales)

- Applies only if both parties confirmed "acting in the course of business"
  (the 1998 Act is B2B only). Otherwise the button is hidden and the app suggests
  a polite reminder instead.
- Statutory interest: 8% + Bank of England base rate as at the relevant reference
  date (30 June or 31 December before the debt fell due), simple interest per day.
  The reference rates are a dated constant in code (`lib/latePayment.ts`) with a
  source URL, updated twice a year (runbook step).
- Fixed compensation: £40 (debt < £1,000), £70 (£1,000–£9,999.99), £100 (≥ £10,000).
- The letter says it is a template, not legal advice, and points to gov.uk
  guidance on late commercial payments.

## Legal safeguards (why this is designed the way it is)

| Risk                                                          | UK law                                                                                                                                                                                                                                              | What we do                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A professional posts a false "not paid"                       | Defamation Act 2013 (s.1 serious harm / serious financial loss for businesses; s.5 website-operator defence; s.10 author first); Defamation (Operators of Websites) Regs 2013 (48-hour steps); Defamation Act 1996 s.1; E-Commerce Regs 2002 reg 19 | Reports are user statements tied to a both-confirmed Deal Sheet; we only show undisputed facts; owner dispute route; a notice-of-complaint process that follows the 48-hour steps (docs/legal/defamation-notice-procedure.md); takedown on dispute  |
| Our own aggregated summary is "our" statement                 | s.5 protects user posts, not the operator's own words                                                                                                                                                                                               | The summary is a count of user reports with "reported by professionals"; no ranking, scoring or adjectives; disputed items excluded                                                                                                                 |
| Owner never agreed to be rated                                | Consent is a defence to defamation; UK GDPR transparency                                                                                                                                                                                            | Terms: owners who use Deal Sheets agree that payment outcomes reported on agreed Deal Sheets are shown to signed-in users, with dispute rights. Shown at the moment they confirm a Deal Sheet                                                       |
| Reporter lies                                                 | Contract                                                                                                                                                                                                                                            | Terms: reporters warrant reports are true and accurate; false reports are a serious breach (suspension) and the reporter indemnifies DirectWork for losses from their false statements                                                              |
| Owner is a sole trader (an individual)                        | UK GDPR accuracy, rectification, objection; Art 21                                                                                                                                                                                                  | Dispute = rectification route; LIA documented; privacy notice explains; data kept only with the collaboration                                                                                                                                       |
| "Pays on time" looks like a credit reference                  | FSMA RAO art 89B (providing credit references) — FCA regulated                                                                                                                                                                                      | Purpose is marketplace trust, not credit decisions; the record is never sold, exported to third parties or offered via API; shown only inside DirectWork to signed-in users. Solicitor to confirm (art 72A information-society exclusion may apply) |
| Malicious falsehood (no serious-harm threshold, needs malice) | Common law                                                                                                                                                                                                                                          | Same controls; prompt removal on credible complaint                                                                                                                                                                                                 |
| Records treated as consumer reviews                           | DMCC Act 2024 fake reviews ban                                                                                                                                                                                                                      | Publish how records are collected, verified and disputed (Reviews & records policy); no paid or incentivised reports; never suppress genuine negative records                                                                                       |
| Harassment via reports                                        | Protection from Harassment Act 1997; OSA illegal content                                                                                                                                                                                            | Reports limited to agreed deals and due dates; report and block still work; moderation                                                                                                                                                              |
| Letter misstates the law                                      | Negligent misstatement                                                                                                                                                                                                                              | B2B gate, dated rates with source, "template, not legal advice", link to gov.uk                                                                                                                                                                     |

## Docs and policies to update

- Terms: new "Deal Sheets and payment records" section (consent, warranties,
  indemnity, disputes, not a contract drafted by DirectWork, DirectWork not a
  party).
- Privacy notice: new data (deal terms, payment outcomes, disputes), purposes,
  lawful bases (contract for the Deal Sheet; legitimate interests for the record),
  retention, rights.
- References policy → "Reviews, references and payment records policy".
- Community guidelines: honest reporting.
- docs/legal: LIA for the pay record; defamation procedure covers payment records;
  uk-law-register rows for credit references, late payment, consent.

## Out of scope (later)

Email notifications, invoices, payments or escrow (needs FCA / Stripe Connect),
e-signatures beyond in-app confirmation, counterpart anonymisation on deletion.
