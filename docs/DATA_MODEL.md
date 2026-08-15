# Data model (MVP proposal)

This is a starting proposal to refine before the first migration is
written, not a final schema.

| Entity                       | Key fields                                                                                                                                                         | Notes                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `profiles`                   | id (= auth.users.id), full_name, headline, bio, location, remote_pref, availability, seeking_paid (bool), seeking_partner (bool), avatar_url, cv_url               | 1:1 with an auth user                                                                         |
| `skills`                     | id, name (unique, case-insensitive)                                                                                                                                | grows from user input — free text with autocomplete against this table, not a fixed seed list |
| `profile_skills`             | profile_id, skill_id                                                                                                                                               | join table                                                                                    |
| `projects`                   | id, owner_id, title, public_summary, private_summary, status, opportunity_type, location, remote_pref, commitment, start_date/duration, compensation_*, created_at | `public_summary` vs `private_summary` is the public/private split                             |
| `project_required_skills`    | project_id, skill_id, is_required                                                                                                                                  |                                                                                               |
| `applications`               | id, project_id, applicant_id, application_type, status, cover_note, created_at                                                                                     | see state machine below                                                                       |
| `application_status_history` | id, application_id, from_status, to_status, changed_by, created_at                                                                                                 | append-only audit trail                                                                       |
| `project_memberships`        | id, project_id, user_id, role, joined_at                                                                                                                           | created only by a trusted server-side process after acceptance (+ agreement for partners)     |
| `agreement_templates`        | id, version, content, created_at                                                                                                                                   | one active version per template type                                                          |
| `agreement_acceptances`      | id, template_id, user_id, project_id, accepted_at                                                                                                                  | immutable once written                                                                        |
| `messages`                   | id, project_id, sender_id, body, created_at                                                                                                                        | project-scoped, not global DMs (see open decisions)                                           |
| `notifications`              | id, user_id, type, payload, read_at, created_at                                                                                                                    |                                                                                               |
| `documents`                  | id, owner_id, storage_path, kind, created_at                                                                                                                       | backed by Supabase Storage                                                                    |

## State machines

`projects.status`: `draft → published → paused ⇄ published`,
`published/paused → closed` (terminal).

`applications.status`:

```
submitted → under_review → accepted
                          → rejected (terminal)
submitted/under_review     → rejected (terminal)
submitted                  → withdrawn (terminal, by applicant)

Partner route only, after "accepted":
accepted → agreement_pending → agreement_completed
```

Paid-route applications are done once `accepted`. Partner-route
`accepted` is not membership yet — `project_memberships` is only created
after `agreement_completed`. Enforce allowed transitions server-side (see
`docs/ACCESS_CONTROL.md`), not just with a DB check constraint.

`application_type`: `paid | partner` (explicit, not inferred).

`project_memberships.role`: `owner | partner | contractor`.
