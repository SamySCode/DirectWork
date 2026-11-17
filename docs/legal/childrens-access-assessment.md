# Children's access assessment (Online Safety Act 2023, ss.35-37)

> **Draft for solicitor review.** Prepared 2026-11-07 from the team's legal
> review. Not legal advice.
>
> Owner sign-off: Name [ ] Role [ ] Date [ ]
>
> Solicitor reviewed: Name and firm [ ] Date [ ]
>
> Next review: [date, at most 12 months after sign-off] (s.36(3)).

## Why we need this

Every user-to-user service must assess whether children (under 18) can
access it and, if so, whether the "child user condition" is met. A new
service must do it within 3 months of its first day (Sch 3 para 3(2)(b)) and
keep a written record (s.36(7)). If we don't, the law treats the service as
likely to be accessed by children (s.37), which brings in the children's
risk assessment and children's safety duties.

Law: <https://www.legislation.gov.uk/ukpga/2023/50/section/35>,
<https://www.legislation.gov.uk/ukpga/2023/50/section/36>,
<https://www.legislation.gov.uk/ukpga/2023/50/section/37>.

## The service

DirectWork is a professional marketplace for paid work and equity
partnerships between businesses, founders and professionals. It is a
business-to-business service in purpose: people use it to find work or
hire. There is no social feed, no public posting, no likes, no followers,
no messaging, no games and no entertainment content.

## Stage 1: Is it possible for children to access the service?

The law lets a provider conclude "not possible" only where age
verification or age estimation is used so that children are not normally
able to access it (s.35(2)).

- We use an **18+ self-declaration**: a required checkbox at sign-up ("I'm
  18 or over and I agree to the Terms of Service and Privacy Policy"),
  recorded with the terms and privacy versions in
  `public.legal_acceptances` (document `age_18`). We don't collect date of
  birth.
- A self-declaration is **not** highly effective age assurance.

**Conclusion of Stage 1: yes, it is possible for children to access the
service.** We go on to Stage 2.

## Stage 2: Is the child user condition met?

The condition is met if the service has a significant number of child
users, or is of a kind likely to attract a significant number of them
(s.35(3)). "Significant" includes significant in proportion to the total
number of UK users, judged on evidence (s.35(4)).

**Evidence that the service has few or no child users:**

- The Terms require users to be 18 or over; the age checkbox can't be
  skipped.
- Contracts for paid work and equity partnerships are the whole point of the
  service; minors generally can't be bound by them, and owners expect adult
  professionals.
- Every listing is reviewed by a person; listings aimed at children, or
  roles involving childcare or vulnerable people, aren't allowed.
- Marketing is aimed at businesses and professionals: [list channels].
- Monitoring signals: reports, support emails and moderation notes that
  suggest a user is under 18. Count at sign-off: [number].

**Evidence that the service is not of a kind likely to attract children:**

- No features that appeal to children: no feed, no social features, no
  games, no rewards for engagement (a product rule in `CLAUDE.md`).
- The content is professional profiles, job and partnership listings,
  applications and references.

**Conclusion of Stage 2 (to confirm at sign-off):** the child user condition
is **not met**. The service doesn't have a significant number of child users
and isn't of a kind likely to attract them.

This conclusion is consistent with our UK GDPR view that the service is not
"likely to be accessed by children" for the ICO Children's code:
<https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/services-covered-by-this-code/>.

## What would make us reassess early (s.36(4))

- Evidence of more than a handful of under-18 users (reports, support).
- Marketing to students or schools, or a feature that could appeal to
  children.
- Any significant design change (for example messaging).

## What we do if a child is found

Close the account, delete the data (unless a legal hold applies), and note
the case (no personal details) in the monitoring count above.

## Annual review log

| Date | Reviewer | Under-18 signals since last review | Conclusion |
| ---- | -------- | ---------------------------------- | ---------- |
| [ ]  | [ ]      | [ ]                                | [ ]        |
