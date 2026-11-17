# Subject access and other data-rights requests

> **Draft for solicitor review.** Prepared 2026-11-07 from the team's
> data-flow review. Not legal advice.
>
> Owner sign-off: Name [ ] Role [ ] Date [ ]
>
> Solicitor reviewed: Name and firm [ ] Date [ ]
>
> Next review: [date, at least yearly].

Anyone can ask what data we hold about them (UK GDPR Art 15), and ask us to
correct, delete, restrict, move or stop using it (Arts 16-21). A request can
arrive by any route (privacy@, support@, in the app, by post) and doesn't
need to use special words.

## Deadlines (including the Data (Use and Access) Act 2025 changes)

- **One month** to respond. The month runs from the **latest** of: receiving
  the request, confirming the person's identity, or receiving a fee (we don't
  charge one).
- **Extension:** up to two more months if the request is complex or the
  person has sent several. Tell them within the first month, with reasons.
- **Clock stop** (UK GDPR Art 12A, in force 5 Feb 2026): if we reasonably
  need the person to clarify what they want, the clock pauses until they
  reply. Ask promptly.
- **Reasonable and proportionate search** (Art 15(1A), added by the Data
  (Use and Access) Act 2025 s.78): we must search properly, but needn't do
  searches that are out of proportion to the request.
  <https://www.legislation.gov.uk/ukpga/2025/18/section/78>

## Steps

1. **Log it** (requests log: date received, who, what, deadline).
2. **Acknowledge** within a few days. If we're not sure who they are, ask for
   the minimum proof: usually an email from the address on the account.
   Don't ask for ID documents unless there's real doubt.
3. **Self-service first.** Signed-in users can download their data in the
   app: Profile > Help & legal > Download my data (`export_my_data`). Tell
   them, and offer to send it ourselves if they can't sign in.
4. **Search everywhere else:**
   - the database (anything `export_my_data` leaves out, such as reports
     about them, with the reporter removed);
   - Storage files (avatar, portfolio, listing images, attachments);
   - Supabase Auth (sign-in history) and logs (7 days);
   - Stripe (if billing was on);
   - support@ and privacy@ emails;
   - Sentry (if adopted).
5. **Remove other people's data** before sending: for example another
   person's identity as a reporter (DPA 2018 Sch 2 para 16), or other
   applicants' details.
6. **Send** the data in a common format (JSON plus files) with a short
   explanation of what each part is, the purposes, recipients, retention and
   their rights, including the right to complain to the ICO.
7. **Close the log entry.** Keep it 2 years.

## Other rights

| Right       | How we handle it                                                                                                                                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correction  | Most fields can be edited in the app. The email address can't yet; change it by hand in the Supabase dashboard after confirming identity                                                                                                  |
| Deletion    | In the app: Profile > Delete account. If they can't sign in, they follow the email route on the public account-deletion page (`/legal/account-deletion`). Refused while a legal hold exists; billing records stay with Stripe for 6 years |
| Restriction | No switch yet: ban the login in the dashboard and hide the profile by hand                                                                                                                                                                |
| Objection   | Mainly references and the reply record (legitimate interests). Consider each case; hide or remove a reference by hand if the objection wins                                                                                               |
| Portability | The in-app export (JSON)                                                                                                                                                                                                                  |
| Complaints  | `complaints-procedure.md`: acknowledge within 30 days                                                                                                                                                                                     |
