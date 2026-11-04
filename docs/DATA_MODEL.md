# Data model (MVP proposal)

This is a starting proposal to refine before the first migration is
written, not a final schema. Read `docs/PRODUCT_STRATEGY.md` first — the
admission-criteria fields and outcome ledger below exist because of it.

| Entity                                   | Key fields                                                                                                                                           | Notes                                                                                                                                                                                                                                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                               | id (= auth.users.id), full_name, headline, bio, location, remote_pref, availability, seeking_paid (bool), seeking_partner (bool), avatar_url, cv_url | 1:1 with an auth user                                                                                                                                                                                                                                                                             |
| `skills`                                 | id, name (unique, case-insensitive)                                                                                                                  | grows from user input — free text with autocomplete against this table, not a fixed seed list                                                                                                                                                                                                     |
| `profile_skills`                         | profile_id, skill_id                                                                                                                                 | join table                                                                                                                                                                                                                                                                                        |
| `projects`                               | id, owner_id, title, public_summary, status, opportunity_type, location, remote_pref, commitment, start_date/duration, compensation_*, created_at    | public fields only — see `project_private_details` for the gated split                                                                                                                                                                                                                            |
| `project_private_details`                | project_id (pk, fk), private_summary                                                                                                                 | separate table, not a column on `projects` — RLS is row-level, so a public/private split within one row can't be enforced by a `select` policy alone. Same `select` gate as `projects.private_summary` was going to use (owner or active `project_memberships`), applied to the whole row instead |
| `project_admission` (partner route only) | project_id (pk, fk), what_exists_already, weekly_commitment_hours, first_milestone, proposed_terms, owner_contribution                               | structured fields, not prose — required before a partner-route listing can publish. Direct fix for "vague idea + 5% equity" reaching the marketplace; see `docs/PRODUCT_STRATEGY.md` Phase 0                                                                                                      |
| `project_required_skills`                | project_id, skill_id, is_required                                                                                                                    |                                                                                                                                                                                                                                                                                                   |
| `applications`                           | id, project_id, applicant_id, application_type, status, cover_note, created_at                                                                       | see state machine below                                                                                                                                                                                                                                                                           |
| `application_status_history`             | id, application_id, from_status, to_status, changed_by, created_at                                                                                   | append-only audit trail                                                                                                                                                                                                                                                                           |
| `project_memberships`                    | id, project_id, user_id, role, joined_at, left_at                                                                                                    | created only by a trusted server-side process after acceptance (+ agreement for partners). `left_at` nullable — memberships aren't permanent, a bad-fit partner needs a revocation path                                                                                                           |
| `project_outcomes`                       | project_id (pk, fk), outcome (completed \| abandoned), confirmed_by_owner_at, confirmed_by_member_at, summary                                        | the actual differentiated asset per `docs/PRODUCT_STRATEGY.md` — mutually confirmed by both owner and member, not self-declared, so it can't be gamed. Feeds future profile reputation                                                                                                            |
| `agreement_templates`                    | id, version, content, content_hash, created_at                                                                                                       | one active version per template type. Immutable once published — never edit a version's `content` in place, publish a new version; `content_hash` makes tampering detectable. Optional per listing, scoped to attached materials, not "the idea" broadly — see `docs/PRODUCT_STRATEGY.md`         |
| `agreement_acceptances`                  | id, template_id, user_id, project_id, accepted_at                                                                                                    | immutable once written                                                                                                                                                                                                                                                                            |
| `messages`                               | id, project_id, sender_id, body, created_at                                                                                                          | project-scoped, not global DMs (see open decisions). Deferred past Phase 2 — contact reveal on mutual acceptance covers Phase 1/2, see `docs/PRODUCT_STRATEGY.md`                                                                                                                                 |
| `notifications`                          | id, user_id, type, payload, read_at, created_at                                                                                                      | deferred past Phase 2, same reasoning as `messages`                                                                                                                                                                                                                                               |
| `documents`                              | id, owner_id, storage_path, kind, created_at                                                                                                         | backed by Supabase Storage                                                                                                                                                                                                                                                                        |

## State machines

`projects.status`: `draft → published → paused ⇄ published`,
`published/paused → completed | abandoned` (terminal — not a single
`closed`, which conflated "shipped" with "gave up" and made the outcome
unmeasurable; see `docs/PRODUCT_STRATEGY.md`). A `completed`/`abandoned`
transition should write the corresponding `project_outcomes` row.

`applications.status`:

```
submitted → under_review → accepted
                          → rejected (terminal)
submitted/under_review     → rejected (terminal)
submitted                  → withdrawn (terminal, by applicant)

Partner route only, after "accepted", and only if the listing opted into
an agreement (docs/PRODUCT_STRATEGY.md - optional per listing, not
mandatory):
accepted → agreement_pending → agreement_completed

Partner route, listing did not opt into an agreement:
accepted → membership created directly
```

Paid-route applications are done once `accepted`. Partner-route
`accepted` is not membership yet when an agreement is required —
`project_memberships` is only created after `agreement_completed` (or
directly on `accepted` if the listing didn't require one). Enforce
allowed transitions server-side (see `docs/ACCESS_CONTROL.md`), not just
with a DB check constraint.

`application_type`: `paid | partner` (explicit, not inferred).

`project_memberships.role`: `owner | partner | contractor`.

`project_outcomes.outcome`: `completed | abandoned`, written only once
both `confirmed_by_owner_at` and `confirmed_by_member_at` are set —
mutual confirmation, not self-declared.

## As built (migration `20261104090000_listings_applications_outcomes.sql`)

Where the implementation deliberately differs from the proposal above:

- **`profiles.wants_to_hire`** added; the check is now
  `seeking_paid or seeking_partner or wants_to_hire`. The original
  constraint forced people who only post projects to claim they were
  job-seeking.
- **`projects.status`** adds `in_review` and `changes_requested` for
  curation: `draft -> in_review -> published | changes_requested`, then
  `published <-> paused`, `published/paused -> draft` (edit + re-review),
  `-> completed | abandoned`. Owners can only edit columns while the
  listing is `draft`/`changes_requested`, so a listing can't be changed
  after approval without going back through review.
- **Compensation shape** (was an open decision): `compensation_type`
  (`fixed | hourly | daily`) + optional `compensation_min`/`max` +
  `currency` (`GBP | EUR | USD`). Paid route only.
- **`applications.status`** uses the trimmed slice-6 machine:
  `submitted -> accepted | rejected`, `submitted -> withdrawn`. No
  `under_review`, no `agreement_*` states yet (slice 9 not built). Closing a
  listing auto-rejects anything still `submitted`.
- **`project_memberships`** is created on acceptance (no agreement step
  yet), keyed 1:1 to the application.
- **`project_outcomes` is per membership, not per project.** Keyed by
  `project_id` it couldn't represent more than one collaborator. Either
  side proposes `completed | abandoned`; it only counts once both
  `confirmed_by_*_at` are set to the same outcome. Proposing a different
  outcome resets the other side's confirmation. Feeds
  `public.get_track_record()`.
- **`project_private_details`** not built yet — contact reveal covers the
  Phase 1/2 need.
- **New: `admins`** (operator/reviewer allow-list, seeded by hand) and
  **`subscriptions`** (owner plan state, written only by the Stripe
  webhook). See `docs/MONETIZATION.md`.
- **`skills.created_by`** added for a 50-per-user-per-day insert cap.

**Images** (migration `20261104120000_images_and_content_rules.sql`):
`profiles.avatar_url` holds a path in the `avatars` bucket;
`portfolio_images` (max 6), `listing_images` (max 4, editable only while
the listing is), `application_attachments` (max 3, private bucket). Files
are uploaded straight to Storage; rows record their paths.

Abuse limits enforced in the database: 25 listings per owner, 20
applications per applicant per 24h, 50 new skills per user per 24h, one
live application per person per listing.

## Trust and activity (migration `20261104230000_trust_and_activity.sql`)

- `activity(user_id, kind, actor_id, project_id, application_id, membership_id, read_at)`
  — written by AFTER triggers on applications, projects, project_outcomes,
  work_references and application_questions, in the same transaction as the
  event. Read on demand (unread count is a head-only query); no Realtime.
- `work_references(membership_id, author_id, subject_id, project_title, body)`
  — unique per (membership, author).
- `application_questions(application_id, question, answer, asked_at, answered_at)`
  — embedded in the applications select, so no extra request.
- `reports(reporter_id, profile_id | project_id, reason, details, status)`
  and `blocks(blocker_id, blocked_id)`.
- `profiles.availability_confirmed_at` — the 30-day freshness clock.
- `applications.closed_by_listing` (`20261104220000`) replaces matching on
  the "Listing closed" note text.
