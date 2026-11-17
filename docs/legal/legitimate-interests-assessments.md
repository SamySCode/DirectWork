# Legitimate interests assessments

> **Draft for solicitor review.** Prepared 2026-11-07 from the team's
> data-flow review. Not legal advice.
>
> Owner sign-off: Name [ ] Role [ ] Date [ ]
>
> Solicitor reviewed: Name and firm [ ] Date [ ]
>
> Next review: [date], or when the processing changes.

Each assessment uses the ICO's three-part test: **purpose** (is there a
legitimate interest?), **necessity** (is this processing needed for it?) and
**balancing** (do people's interests override it?). Profiles being visible
to signed-in users is the service people sign up for, so it rests on
contract, not on legitimate interests.

## LIA 1: Security, abuse prevention and rate limits

Covers rate-limit counters, abuse caps, the contact-details filter, security
logs and re-authentication before account deletion.

| Test       | Assessment                                                                                                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose    | Preventing scripted abuse, scraping, account takeover and spam. Network and information security is a statutory example of a legitimate interest (UK GDPR Art 6(11)(c), added by the Data (Use and Access) Act 2025) |
| Necessity  | Counters keyed by an opaque user id; IP addresses only in Supabase-managed logs; no device fingerprinting; kept days, not months                                                                                     |
| Balancing  | Low impact, expected by users, not reused for profiling or marketing                                                                                                                                                 |
| Conditions | Supabase's "write audit logs to the database" setting is **off** (`docs/NEXT_STEPS.md` 2.13), so Auth logs follow the 7-day log retention                                                                            |
| Outcome    | **Passes**                                                                                                                                                                                                           |

## LIA 2: Moderation, and keeping report records after account deletion

| Test       | Assessment                                                                                                                                                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose    | Protecting members from scams and harassment, enforcing the Terms, and meeting Online Safety Act reporting and complaints duties. Without a record, a user who was acted against could delete their account and start again                                                                    |
| Necessity  | When an account is deleted, its reports are kept **anonymised**: the links to the reporter and the target are removed, and the reason, kind of target and dates stay. No email hash is kept (decided 2026-11-06). Actioned reports go 3 years after resolution, dismissed ones after 12 months |
| Balancing  | Allegations, even unproven, are criminal-offence data, so the impact is high. Anonymisation on deletion removes most of it                                                                                                                                                                     |
| Safeguards | Admin-only access; reporters can't see which admin resolved their report; the condition and safeguards in `appropriate-policy-document.md`; described in the privacy notice                                                                                                                    |
| Outcome    | **Passes with these safeguards**                                                                                                                                                                                                                                                               |

## LIA 3: Fraud prevention

Covers the contact-details filter before both sides accept, scam reports,
and one active Pro subscription per person.

| Test      | Assessment                                                                                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose   | Stop advance-fee and off-platform scams before both sides have committed, and avoid duplicate charges. (Stripe Radar is Stripe's own processing as a controller; we disclose it) |
| Necessity | The check runs on text as it is submitted; nothing extra is stored                                                                                                               |
| Balancing | Minimal impact (rephrase), clearly explained in the app, applies to everyone equally                                                                                             |
| Outcome   | **Passes**                                                                                                                                                                       |

## LIA 4: References, track record and reply record shown to signed-in users

| Test       | Assessment                                                                                                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose    | Trust signals confirmed by both sides are the core of a curated marketplace; they help people choose whom to work with and discourage ghosting                                                                                                                                                    |
| Necessity  | References only after work both sides confirmed as completed (at least 7 days), one per person per collaboration, 20–300 characters, contact filter applied. Reply record is a total over 180 days, excluding withdrawn, too-recent and auto-closed applications. Visible to signed-in users only |
| Balancing  | Members of a reputation marketplace expect references. But sign-up is open, so "signed-in" is close to public; references can't be edited or answered by their subject; owners who are individuals are being profiled (Art 4(4))                                                                  |
| Safeguards | Report route; fast handling of objections (Art 21) through privacy@; clear notice text; wording says "confirmed by both sides", never "verified"                                                                                                                                                  |
| Gap        | The subject can't yet hide a reference about them. Until that exists, handle objections by hand within the one-month deadline                                                                                                                                                                     |
| Outcome    | **Passes for the reply record and track record. For references, passes only while objections are handled promptly by hand**, until a hide option is built                                                                                                                                         |
