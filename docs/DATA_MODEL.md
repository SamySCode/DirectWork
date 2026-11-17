# Data model

The first half of this page is the **original proposal**, written before
any migration existed. Tables marked **(not built)** don't exist. What was
actually built is in the "As built" sections further down, which win
wherever the two disagree. Read `docs/PRODUCT_STRATEGY.md` first — the
admission-criteria fields and outcome ledger exist because of it.

## Original proposal (pre-build; not as built)

| Entity                                   | Key fields                                                                                                                                           | Notes                                                                                                                                                                                                                                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                               | id (= auth.users.id), full_name, headline, bio, location, remote_pref, availability, seeking_paid (bool), seeking_partner (bool), avatar_url, cv_url | 1:1 with an auth user                                                                                                                                                                                                                                                                             |
| `skills`                                 | id, name (unique, case-insensitive)                                                                                                                  | grows from user input — free text with autocomplete against this table, not a fixed seed list                                                                                                                                                                                                     |
| `profile_skills`                         | profile_id, skill_id                                                                                                                                 | join table                                                                                                                                                                                                                                                                                        |
| `projects`                               | id, owner_id, title, public_summary, status, opportunity_type, location, remote_pref, commitment, start_date/duration, compensation_*, created_at    | public fields only — see `project_private_details` for the gated split                                                                                                                                                                                                                            |
| `project_private_details` (not built)    | project_id (pk, fk), private_summary                                                                                                                 | separate table, not a column on `projects` — RLS is row-level, so a public/private split within one row can't be enforced by a `select` policy alone. Same `select` gate as `projects.private_summary` was going to use (owner or active `project_memberships`), applied to the whole row instead |
| `project_admission` (partner route only) | project_id (pk, fk), what_exists_already, weekly_commitment_hours, first_milestone, proposed_terms, owner_contribution                               | structured fields, not prose — required before a partner-route listing can publish. Direct fix for "vague idea + 5% equity" reaching the marketplace; see `docs/PRODUCT_STRATEGY.md` Phase 0                                                                                                      |
| `project_required_skills`                | project_id, skill_id, is_required                                                                                                                    |                                                                                                                                                                                                                                                                                                   |
| `applications`                           | id, project_id, applicant_id, application_type, status, cover_note, created_at                                                                       | see state machine below                                                                                                                                                                                                                                                                           |
| `application_status_history`             | id, application_id, from_status, to_status, changed_by, created_at                                                                                   | append-only audit trail                                                                                                                                                                                                                                                                           |
| `project_memberships`                    | id, project_id, user_id, role, joined_at, left_at                                                                                                    | created only by a trusted server-side process after acceptance (+ agreement for partners). `left_at` nullable — memberships aren't permanent, a bad-fit partner needs a revocation path                                                                                                           |
| `project_outcomes`                       | project_id (pk, fk), outcome (completed \| abandoned), confirmed_by_owner_at, confirmed_by_member_at, summary                                        | the actual differentiated asset per `docs/PRODUCT_STRATEGY.md` — mutually confirmed by both owner and member, not self-declared, so it can't be gamed. Feeds future profile reputation                                                                                                            |
| `agreement_templates` (not built)        | id, version, content, content_hash, created_at                                                                                                       | one active version per template type. Immutable once published — never edit a version's `content` in place, publish a new version; `content_hash` makes tampering detectable. Optional per listing, scoped to attached materials, not "the idea" broadly — see `docs/PRODUCT_STRATEGY.md`         |
| `agreement_acceptances` (not built)      | id, template_id, user_id, project_id, accepted_at                                                                                                    | immutable once written                                                                                                                                                                                                                                                                            |
| `messages` (not built)                   | id, project_id, sender_id, body, created_at                                                                                                          | project-scoped, not global DMs (see open decisions). Deferred past Phase 2 — contact reveal on mutual acceptance covers Phase 1/2, see `docs/PRODUCT_STRATEGY.md`                                                                                                                                 |
| `notifications` (not built)              | id, user_id, type, payload, read_at, created_at                                                                                                      | deferred past Phase 2, same reasoning as `messages`                                                                                                                                                                                                                                               |
| `documents` (not built)                  | id, owner_id, storage_path, kind, created_at                                                                                                         | backed by Supabase Storage                                                                                                                                                                                                                                                                        |

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
the listing is), `application_attachments` (max 3, private bucket).
These per-row limits are unchanged; the bucket size and per-user file caps
were lowered in `20261105120000` (below). Files
are uploaded straight to Storage; rows record their paths.

Abuse limits enforced in the database: 25 unfinished drafts (draft or
changes_requested) per owner, 20 applications per applicant per 24h, 50 new
skills per user per 24h, one application per person per listing (see the
re-apply rule below). Image counts and sizes changed in `20261105120000`
(see below).

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

## Privacy and launch hardening (`20261105110000`, `20261105120000`; not yet applied to any hosted project)

- **`reports`** survive account deletion, anonymised: `reporter_id`,
  `profile_id` and `project_id` are `on delete set null`, and a new
  `target_kind` (`profile | project`, set by `prepare_report`) remembers what
  was reported once the target is gone. The one-target check is now "at most
  one"; `prepare_report` still requires exactly one on insert. No email hash
  is kept.
- **`applications`**: one per person per listing. Re-applying is allowed only
  after a withdrawal, or after the listing closing turned you away
  (`closed_by_listing`), never after the owner rejected you.
- **`activity`**: at most one unread row per (user, kind, collaboration),
  enforced by the partial unique index `activity_one_unread_per_membership`;
  a repeat event refreshes the existing row. `record_outcome` writes activity
  only when the stored outcome or a side's confirmation actually changes.
- **`public.legal_acceptances`** `(id, user_id -> auth.users on delete
cascade, document in ('terms','privacy','age_18'), version, accepted_at,
unique (user_id, document, version))`. Filled by an AFTER INSERT trigger on
  `auth.users` from the sign-up metadata `{ terms_version, privacy_version,
age_confirmed: true }` (the trigger never raises, so a bad value can't break
  sign-up), and later by `record_legal_acceptance()`.
- **`private.legal_holds`** `(user_id pk -> auth.users on delete restrict,
reason, created_at)`. Added by admins in SQL; while a row exists the account
  can't be deleted.
- **`private.storage_cleanup`** `(id, bucket, path, queued_at)`: files that
  are no longer referenced (image rows deleted, including by cascade or
  retention, or an avatar replaced or removed). Emptied by the `maintenance`
  Edge Function through the Storage API.
- **Storage**: every bucket's file limit is **2 MB** (the client compresses
  in steps 0.8 → 0.65 → 0.5 to fit). Per-user file caps: avatars 3,
  portfolio 8, listing images 40, application attachments 15.
- **Retention**: `private.apply_retention()` deletes read activity after 180
  days and any activity after 365; rejected or withdrawn applications 12
  months after their last change (their history, questions and attachment
  rows cascade, and the files are queued for cleanup); resolved reports 3
  years after resolution if actioned, 12 months if dismissed. It never
  touches pending or accepted applications, memberships, outcomes or
  references. Scheduled daily at 03:17 with `pg_cron` where available.
- **Contact rule**: the `*_no_contact` CHECK constraints are replaced by
  BEFORE INSERT/UPDATE triggers that test only new or changed columns, so
  older rows stay updatable. See `docs/ACCESS_CONTROL.md`.

## Deal Sheets and payment records (`20261107090000`–`20261107092000`; not yet applied to any hosted project)

Spec: `docs/specs/deal-sheet.md`. Access rules: `docs/ACCESS_CONTROL.md`.

- **`deal_sheets`**: one per collaboration (`membership_id` unique, cascades
  with the membership). Holds the terms (`scope`, `pay_basis`, `amount`,
  `currency`, `payment_terms_days` 0–120 (default 14), `milestones` jsonb array of up to
  12 `{title, due_date, amount}`, `ip_terms` + `ip_notes`, the partner-only
  `equity_percent` / `vesting_months` / `cliff_months` / `decision_rights`),
  each side's "acting in the course of business" flag (`owner_business`,
  `member_business`), and `version`, `proposed_by`,
  `owner_confirmed_version`, `member_confirmed_version` and `agreed_at`.
  **Agreed** = both confirmed versions equal `version` (CHECK-enforced);
  `agreed_at` is set the moment that happens.
- **`payment_reports`**: the professional's report per milestone, or one per
  deal when it has no milestones (unique on
  `(deal_sheet_id, coalesce(milestone_index, -1))`). `outcome` is
  `on_time | late | unpaid`, with `paid_on` required for `late` and absent for
  `unpaid`. Disputes live on the row: `dispute_status`
  `none → disputed → upheld | rejected`, `dispute_reason`, `disputed_at`,
  `resolved_at`.
- **`private.payment_dispute_resolutions`**: the reviewer, the decision and
  an optional note. Never readable by clients, and left out of the data
  export.
- **`private.payment_due_notices`**: one row per (deal, milestone) once its
  `payment_due` notice has gone out, so it goes out only once. Cleared when
  a new version is proposed.
- **Due date**: the milestone's `due_date`, or for no milestones the
  `agreed_at` date in UK time (Europe/London) plus `payment_terms_days`. A
  report is allowed only when today (UK) is strictly after the due date.
- **Activity kinds**: `deal_proposed` (to the other party), `deal_agreed`
  (both), `payment_due` (professional, from the daily
  `private.emit_payment_due()`, scheduled by pg_cron as
  `directwork-payment-due` at 06:07 UTC; looks back 7 days in case a run
  was missed and skips anything already reported), `payment_reported`
  (owner), `payment_disputed` (professional) and `payment_dispute_resolved`
  (both, with no actor, so the reviewer stays anonymous).
- **Deletion and export**: everything cascades with the collaboration.
  `export_my_data()` (schema_version 2) adds `deal_sheets`,
  `payment_reports` and `payment_disputes_raised` for the caller's own
  collaborations.
