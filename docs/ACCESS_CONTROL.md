# Access control strategy

Principle: **RLS handles ownership-scoped visibility. Edge Functions
handle state transitions with business rules.** Never let a client
directly write `applications.status`, insert into `project_memberships`,
or insert into `agreement_acceptances`. Both layers matter — RLS alone
can't express "and only if the prior status was X"; an Edge Function
alone can't stop a compromised or bypassed client from reading rows it
shouldn't.

| Area                                         | Read policy                                                                                                                                                                      | Write policy                                                                                                                                                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Listing ownership (`projects`)               | `public_summary` readable by anyone when `status = 'published'`; `private_summary` readable only by the owner or users with an active `project_memberships` row for that project | Insert/update/delete restricted to `owner_id = auth.uid()`                                                                                                                                                             |
| Applications                                 | Applicant reads own rows; project owner reads rows where `projects.owner_id = auth.uid()`                                                                                        | Applicant may `insert` (submit) and `update` only to `withdrawn`. All other status changes go through an Edge Function (service role) that validates the transition and writes `application_status_history` atomically |
| Partner agreements                           | `agreement_acceptances` readable by the accepting user and the relevant project owner                                                                                            | Insert only via Edge Function: verifies the application is `agreement_pending`, verifies the template version is current, writes the acceptance and moves status to `agreement_completed` in one transaction           |
| Private project details                      | Gated on `project_memberships` (or ownership) — same pattern as `private_summary` above                                                                                          | Read-only gate, no separate write policy                                                                                                                                                                               |
| Workspace membership (`project_memberships`) | Readable by members of the same project + owner                                                                                                                                  | Insert only via the Edge Function above — never client-writable                                                                                                                                                        |
| Messages                                     | Readable/writable only by users with a `project_memberships` row (or ownership) for that `project_id`                                                                            | Insert requires membership; no update/delete (append-only)                                                                                                                                                             |
| Documents (Storage)                          | Storage policy mirrors the owning entity: CV/portfolio follow profile-visibility rules; shared project docs gated by membership                                                  | Upload restricted to the owning user or project owner                                                                                                                                                                  |

## Server-enforced actions (Edge Functions, not client writes)

- Accept / reject an application
- Record a partner agreement acceptance
- Create a `project_memberships` row
- Any other transition in the `applications.status` state machine

These exist specifically so ownership, agreement completion, and access
to private project data are never enforced solely by the client.
