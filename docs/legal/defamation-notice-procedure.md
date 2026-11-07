# Defamation notice-of-complaint procedure

> **Draft for solicitor review.** Prepared 2026-11-07 from the team's legal
> review. Not legal advice. Open question for the solicitor: do the
> 48-hour periods exclude non-business days?
>
> Owner sign-off: Name [ ] Role [ ] Date [ ]
>
> Solicitor reviewed: Name and firm [ ] Date [ ]
>
> Next review: [date, at least yearly].

## Why we follow it

A website operator sued over something a user posted has a defence
(Defamation Act 2013 s.5) **if** it follows the Defamation (Operators of
Websites) Regulations 2013 when it receives a valid notice of complaint.
Moderating content doesn't remove the defence (s.5(12)). Where this could
arise here: references, listings, profiles, owner questions and answers.

Regulations: <https://www.legislation.gov.uk/uksi/2013/3028/schedule/made>

## 1. Is it a valid notice? (s.5(6))

It must:

- give the complainant's name and an email address;
- say what the statement is and where it is (enough to find it);
- explain why it is defamatory of them;
- say which parts are factually wrong or opinions not supported by facts;
- say they don't have enough information about the poster to sue them;
- say whether they agree to their name and email being given to the poster.

If something is missing, reply within 48 hours saying what's missing. The
steps below start only once the notice is valid.

## 2. Within 48 hours of a valid notice

- **Tell the poster.** Email them (the address on their account) a copy of
  the notice, with the complainant's name and email removed unless they
  agreed to share them. Say:
  - they must reply by **midnight at the end of the 5th day** after our email;
  - they must say whether they want the statement removed;
  - if not, they must give their full name and postal address and say
    whether they agree to us passing these to the complainant;
  - if they don't reply properly, we'll remove it.
- **Acknowledge the complainant**: we've received the notice and contacted
  the poster.
- **If we can't contact the poster privately** (for example their account is
  deleted or the email bounces): **remove the statement within 48 hours** and
  tell the complainant.

## 3. After the poster's deadline

| Poster's response                                       | What we do, within 48 hours                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| No reply, or a reply that doesn't meet the requirements | Remove the statement; tell the poster and the complainant                                                           |
| Agrees to removal                                       | Remove it; tell the complainant                                                                                     |
| Refuses, and gives name and address                     | Keep it up; tell the complainant. Pass on the poster's details only if the poster agreed; otherwise say they didn't |

## How to remove

- References: ask Code, or delete the row in the Supabase dashboard (Table
  Editor > `work_references`).
- Listings: send back for changes through the review queue, or close it.
- Profile text: edit by hand in the dashboard and tell the user.

## Record keeping

Log every notice with dates and times of each step, copies of emails, and
the outcome. Keep it for at least 2 years (the limitation period for
defamation is 1 year; a margin helps) [solicitor to confirm].

## Templates

**To the poster:** "We've received a complaint that something you posted on
DirectWork is defamatory. A copy is below. Please reply by midnight on
[date] to tell us whether you want it removed. If you don't, please give
your full name and postal address, and tell us whether we may pass them to
the person who complained. If we don't hear from you by then, we'll remove
it."

**To the complainant:** "We've received your notice about [what and where].
We've contacted the person who posted it and will update you by [date]."
