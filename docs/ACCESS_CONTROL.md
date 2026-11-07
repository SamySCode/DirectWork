# Access control strategy

Principle: **RLS handles ownership-scoped visibility. Edge Functions
handle state transitions with business rules.** Never let a client
directly write `applications.status`, insert into `project_memberships`,
or insert into `agreement_acceptances`. Both layers matter — RLS alone
can't express "and only if the prior status was X"; an Edge Function
alone can't stop a compromised or bypassed client from reading rows it
shouldn't.

## Original proposal (pre-build; not as built)

Kept for the reasoning. **Several rows describe things that don't exist:**
`agreement_acceptances`, `project_private_details`, messages and documents
were never built; applicants have no UPDATE on `applications` (withdraw goes
through `actions`); listings are readable by signed-in users only, never
anonymously; owner writes are column-granted and only while a listing is
`draft`/`changes_requested`, and delete applies only to drafts that were
never published. The as-built rules are in the sections from "As built:
the `actions` gate" onwards.

| Area                                                | Read policy                                                                                                                                                                                                                                            | Write policy                                                                                                                                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profiles                                            | Readable by any authenticated user — professional profiles are meant to be discoverable within the app, not private                                                                                                                                    | Insert/update restricted to `id = auth.uid()`; no delete for MVP                                                                                                                                                                    |
| Skills (shared lookup, grows from user input)       | Readable by any authenticated user (needed for the autocomplete)                                                                                                                                                                                       | Insert allowed by any authenticated user (adds a new skill on first use). A case-insensitive unique constraint on `name` rejects duplicates — client catches the conflict and reuses the existing row. No update/delete client-side |
| Profile skills (join)                               | Readable by any authenticated user (shown on profiles)                                                                                                                                                                                                 | Insert/delete restricted to rows where `profile_id = auth.uid()`                                                                                                                                                                    |
| Listing ownership (`projects`)                      | `public_summary` readable by anyone when `status = 'published'`                                                                                                                                                                                        | Insert/update/delete restricted to `owner_id = auth.uid()`                                                                                                                                                                          |
| Applications                                        | Applicant reads own rows; project owner reads rows where `projects.owner_id = auth.uid()`                                                                                                                                                              | Applicant may `insert` (submit) and `update` only to `withdrawn`. All other status changes go through an Edge Function (service role) that validates the transition and writes `application_status_history` atomically              |
| Partner agreements                                  | `agreement_acceptances` readable by the accepting user and the relevant project owner                                                                                                                                                                  | Insert only via Edge Function: verifies the application is `agreement_pending`, verifies the template version is current, writes the acceptance and moves status to `agreement_completed` in one transaction                        |
| Private project details (`project_private_details`) | Own table, not a column on `projects` — RLS is row-level, so a public/private split within one row isn't enforceable by a `select` policy alone. Readable only by the project owner or users with an active `project_memberships` row for that project | Read-only gate for applicants; owner writes go through the normal owner-write path, not a separate policy                                                                                                                           |
| Workspace membership (`project_memberships`)        | Readable by members of the same project + owner                                                                                                                                                                                                        | Insert only via the Edge Function above — never client-writable                                                                                                                                                                     |
| Messages                                            | Readable/writable only by users with a `project_memberships` row (or ownership) for that `project_id`                                                                                                                                                  | Insert requires membership; no update/delete (append-only)                                                                                                                                                                          |
| Documents (Storage)                                 | Storage policy mirrors the owning entity: CV/portfolio follow profile-visibility rules; shared project docs gated by membership                                                                                                                        | Upload restricted to the owning user or project owner                                                                                                                                                                               |

## Server-enforced actions (Edge Functions, not client writes)

- Accept / reject an application
- Record a partner agreement acceptance
- Create a `project_memberships` row
- Any other transition in the `applications.status` state machine

These exist specifically so ownership, agreement completion, and access
to private project data are never enforced solely by the client.

## Standing rules for every migration (not just this one)

- **Wrap `auth.uid()` as `(select auth.uid())` in every RLS policy.** Bare
  `auth.uid()` gets re-evaluated per row instead of hoisted into a single
  InitPlan — invisible at low row counts, real cost once tables grow. See
  Supabase's RLS performance guidance.
- **Revoke, then grant exactly, on every new table, function and
  sequence.** Our hosted project (checked 2026-11-05) still auto-grants
  ALL on new `public` tables, functions and sequences to `anon` and
  `authenticated`. Table-wide grants override column grants, so a
  migration that only adds `grant`s leaves writes wide open behind RLS.
  Pattern: `revoke all on public.x from anon, authenticated;` then the
  minimum `grant select` / column-level `grant insert (...)` /
  `grant update (...)`. Functions: `revoke execute ... from public, anon`
  (plus `authenticated` for `svc_*`). The PGlite harness mirrors the
  hosted defaults, and the "schema guardrails" tests fail on any
  anon-reachable table, function or sequence, and on table-wide
  writes to the protected tables (see `20261105090000_trust_grants.sql`).
- **RLS policies need their own tests, not just app-level tests.** A
  policy bug is a silent data leak, not a crash — it won't surface in
  typecheck, lint, or manual QA by the row's owner. Every migration that
  adds or changes a policy should get a corresponding test asserting the
  negative case (user B cannot read/write user A's row) before it's
  considered done. See `supabase/tests/` once that exists.

## As built: the `actions` gate

Every server-enforced action above runs through one Edge Function,
`supabase/functions/actions`:

1. It resolves the caller from their JWT via Supabase Auth (never from the
   request body) and validates the payload with zod.
2. It calls a `public.svc_*` wrapper with the service role. The wrappers
   are `revoke`d from `anon`/`authenticated`, so a user JWT can't call them
   through the Data API.
3. The wrapper calls a `private.*` function that takes the caller's id as
   `p_actor`, does its own authorization (owner? admin? applicant?),
   checks the current status, and writes the transition plus any side
   effects (status history, membership row) in one transaction.

`private` is not an exposed schema, and PUBLIC execute is explicitly
revoked on every function in it (`alter default privileges` can't do this
for a single schema; the test suite asserts it).

Actions: `submit_listing`, `review_listing` (admins), `set_listing_status`,
`decide_application`, `withdraw_application`, `record_outcome`,
`ask_question`, `answer_question`, `write_reference`, `resolve_report`
(admins).

Direct client writes that remain, all narrowed by **column-level grants**
on top of RLS: `profiles` (insert/update of profile columns, never
`availability_confirmed_at`), `profile_skills`, `portfolio_images`, listing
fields while editable (never `status`, `is_featured`, `review_note`,
`owner_id`), admission criteria, required skills and `listing_images` while
editable, `applications (project_id, cover_note)` — the trigger sets
everything else — `application_attachments`, `skills (name)`, `blocks`
(insert/delete own), `reports` (insert as yourself), `activity.read_at` on
your own rows, and Storage objects in your own folder.

Read-side RPCs with their own checks: `get_application_contact` (only the
two parties, only once accepted, nothing if either has blocked the other),
`get_track_record`, `get_listing_quota`, `get_owner_reply_record`,
`get_platform_pulse`, `count_professionals_for`, `get_review_note` (owner
and reviewers), `get_my_legal_status`, `export_my_data`. Write-side RPCs
called directly: `ensure_skills`, `confirm_availability`,
`record_legal_acceptance`.

Other functions: `delete-account` (App Store 5.1.1(v) / UK GDPR erasure;
requires a password or recovery-link sign-in within the last 10 minutes (JWT `amr`
claim), refuses while a legal hold exists, cancels any Stripe subscription
first), `billing` (Checkout/Portal sessions), `billing-webhook`
(`verify_jwt = false`; Stripe-Signature HMAC with a 5-minute replay window
instead), `maintenance` (`verify_jwt = false`; POST only, no CORS, checks
the `x-maintenance-key` header against `MAINTENANCE_SECRET` in constant time
and refuses everything if it's unset; runs retention and empties the
storage cleanup queue).

Tests: `npm run test:db` covers each negative path above, plus schema
guardrails (see below). 95 tests passed on 2026-11-07, including the
hardening migrations.

## Security pass (2026-11-04)

**Row level security**

- RLS is on for every table; the test suite fails if any `public` table
  is created without it, if any foreign key lacks an index, if any
  `security definer` function doesn't pin `search_path`, if anything in
  `private` is executable by PUBLIC, or if a `svc_*` wrapper is callable
  by signed-in users. New migrations can't regress these silently.
- Storage: files live in per-user folders (`<user id>/...`), enforced by
  `storage.objects` policies. Restrictive policies cap files per user per
  bucket and gate attachment uploads; bucket limits (size, JPEG/PNG/WebP
  only) are enforced by Storage itself. Current values: see "Launch
  hardening" below (2 MB; avatars 3, portfolio 8, listing images 40,
  attachments 15).
- Application attachments are in a **private** bucket, readable only by
  the applicant and the listing owner, via 1-hour signed URLs.
- `profiles.avatar_url` and every image `storage_path` must point inside
  the owner's own folder (check constraints/triggers), so a row can never
  reference someone else's file or an external tracking URL.

**Content rule**: emails, phone numbers and links are rejected in free
text other people read before mutual acceptance (headline, bio, listing
title/summary/admission criteria, cover notes, captions). Enforced
in the database by triggers (see "Launch hardening" below), mirrored by
`hasContactDetails()` in `lib/validation.ts` so the form can warn first.
The migration publishes the patterns for the client to copy; the two use
different regex dialects, so treat the database as the authority.

**Injection / input handling**

- SQL is parameterised (PostgREST, RPC args, `format`-free plpgsql)
  everywhere except two PostgREST filter strings built in the client: the
  Discover search `or()` filter and an inlined `not.in` list of owner ids.
  Both are sanitised, and the search one is tested.
- Discover search strips PostgREST syntax characters (`, ( ) "`) and
  escapes LIKE wildcards before building the `or()` filter; a test
  asserts an injected clause can't appear.
- Portfolio links must be `http(s)` (client + check constraint);
  `javascript:` etc. are rejected. Text renders as text (no HTML).
- URL-carried notices on the listing page are a fixed allowlist of keys,
  never displayed free text (prevented a content-spoofing link).
- The native password-reset deep link only accepts `type=recovery`
  tokens (prevents a crafted link logging the device into another account).
- Stripe Checkout redirect URLs come only from server config (`APP_URL`).

**Edge Function middleware** (`supabase/functions/_shared/http.ts`,
`handle()`): CORS allowlist from `ALLOWED_ORIGINS` (exact origins, never
`*`; localhost-only when unset), POST-only, body size cap (16 KB default),
safe JSON parsing, JWT -> user via Supabase Auth, per-user rate limits
stored in Postgres (`private.rate_limits`; actions 60/min, billing 10/min,
account deletion 3/hour), security headers (`nosniff`, `no-store`,
`no-referrer`), a request id on every response/log line, and generic 500s
that never leak database messages. The Stripe webhook verifies its HMAC
signature, then re-fetches the subscription from Stripe so out-of-order or
replayed events can't overwrite newer state.

**What this doesn't cover** (Supabase-managed): CORS and rate limiting on
the REST/Storage APIs themselves, and Auth's own limits (configure in the
dashboard, see `docs/LAUNCH.md`). Web sessions live in localStorage, so
an XSS bug would expose them - mitigated by text-only rendering and a CSP
once the production origin exists.

## Trust and activity (migration `20261104230000`)

| Table                   | Read                                                                  | Write                                                                                                |
| ----------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `activity`              | own rows                                                              | triggers only; client may set `read_at` on own rows                                                  |
| `work_references`       | any signed-in user                                                    | `actions` → `private.write_reference` (party to a mutually confirmed completed collaboration, once)  |
| `application_questions` | the two parties to the application                                    | `actions` → `ask_question` (owner) / `answer_question` (applicant)                                   |
| `reports`               | own reports (columns without `resolved_by`/`resolved_at`); admins all | insert as yourself (column grants, 10/day trigger); resolve via `actions` → `resolve_report` (admin) |
| `blocks`                | own blocks only                                                       | insert/delete own; enforced in the application insert trigger and `ask_question`                     |

`profiles.availability_confirmed_at` has no client grant: it's renewed by
`confirm_availability()` or by the trigger when what you're looking for
changes. Table privileges are now revoked and re-granted explicitly for
every table (`20261104220000`). The DB test harness mirrors the hosted
default privileges (new `public` objects get ALL for `anon`,
`authenticated` and `service_role`), so a migration that forgets to revoke
fails a guardrail test.

Note (A-19): comments in the applied migrations `20260815220116` and
`20261104220000`, and in `supabase/config.toml`, assume new tables are not
auto-exposed. That is wrong for our hosted project, which auto-grants ALL.
The applied files are left unchanged; this note is the correction.

## Supabase usage optimisation

- Lists select explicit columns and only the cover image per listing
  (`limit(1)` on the embedded table); detail pages fetch the rest.
- Skills are resolved in one `ensure_skills()` RPC instead of 2-3
  requests per skill.
- Every foreign key is indexed (test-enforced); every RLS policy wraps
  `(select auth.uid())`.
- TanStack Query: 30s stale time, refetch on foreground, no Realtime;
  signed URLs cached ~50 min; images cached on disk by expo-image and
  resized to <=1600px JPEG before upload (also strips EXIF/GPS).
- Public image buckets serve straight from the CDN with no per-request
  auth check.

## Adversarial pass (2026-11-05)

Every grant, policy and callable function was dumped from the migrated
schema and attacked as a stranger, an applicant and an owner (signed-out
probes ran against the live project too). Held: other users' emails,
activity, blocks, admins, rate limits, subscriptions, private attachments,
writes into other people's storage folders, spoofed reporters/blockers,
protected columns (`availability_confirmed_at`, `status`, ...), oversized
RPC inputs. Fixed in `20261105110000_privacy_fixes.sql`:

- **Reviewer's note leaked to applicants.** `projects` had a table-wide
  SELECT, so anyone who'd applied to a listing sent back for changes could
  read why. Now column grants (all but `review_note`) plus
  `get_review_note()` for the owner and reviewers. A guardrail test fails
  if a new `projects` column isn't added to the grant.
- **Reports against invisible listings.** Holding a draft's id was enough
  to report it (and confirm it exists). Now only published listings or
  ones you applied to; missing and hidden give the same answer.
- **Contact rule workarounds.** `john @ gmail.com`, `linkedin.com/in/x`,
  `t.me/x`, `(at)`/`dot com`, and full-width digits got through. Patterns
  widened (DB and `lib/validation.ts`, same test cases). Spelled-out
  numbers and `@handles` still pass by design (too many false positives
  on "PM @Stripe"); reports and curation are the backstop.

Known and accepted:

- Public buckets (avatars, portfolio, listing images) serve to anyone
  holding a URL, including people who aren't signed in. Paths are random
  UUIDs, but the privacy policy has to say so.
- Any signed-in account can read every profile (they're meant to be
  discoverable). Sign-up is open, so treat profiles as semi-public; there's
  no PostgREST rate limit on reads beyond Supabase's own.
- Storage: one user can hold up to 66 files x 2 MB (about 132 MB) across
  buckets, down from ~1 GB before the hardening migration.

## Launch hardening (`20261105110000`, `20261105120000`; not yet applied to any hosted project)

Both migrations are tested locally (`npm run test:db`) and must be pushed
together with the matching app build: older clients that select
`projects.review_note` get a permission error once `20261105110000` is live.

**Contact rule as triggers.** The `*_no_contact` CHECK constraints are gone.
BEFORE INSERT OR UPDATE triggers (`private.enforce_contact_rule`, one per
table, with the guarded columns as arguments) test a column only when it is
new or changed (`new.col is distinct from old.col`). Postgres re-checks every
CHECK on every UPDATE, so the old design made rows written under the earlier
rule impossible to update at all (status changes, the billing webhook,
moderation). Text is normalised first (`private.contact_text`: invisible and
format characters stripped, NFKC, non-ASCII digits folded to ASCII, common
Cyrillic/Greek look-alikes folded to Latin). Phone numbers need a `+`, `00`
or `0` prefix, so year ranges such as "2015-2019" pass. Questions and
answers are tested separately. A violation raises SQLSTATE `23514` with HINT
`CONTACT_DETAILS`; the Edge Function error mapper turns that into HTTP 400
with "Leave out emails, phone numbers and links. Contact details are shared
automatically once you both accept." (other 23514s stay generic; 23505
becomes 409).

**Reports.** Anonymised on deletion: reporter and target foreign keys are
`on delete set null`, and `target_kind` (`profile | project`) records what
was reported. `prepare_report` enforces exactly one target on insert and
only accepts listings you can see; `resolve_report` closes by report id plus
other open reports on the same live target. Non-admins get column-level
SELECT without `resolved_by`/`resolved_at`, so a reporter can't learn which
moderator closed their report. `projects` likewise has column-level SELECT
without `review_note` (read through `get_review_note()`).

**Skills.** Column-level SELECT `(id, name, created_at)`: `created_by` is
moderation data and no longer readable by other users.

**Blocks.** When a block exists in either direction, `decide_application`
answers "not found" and `get_application_contact` returns nothing, even on an
already-accepted application. Creating a block withdraws pending
applications between the two people (the blocker's own as withdrawn by them,
the blocked person's by the system).

**Re-apply rule and listing limit.** One application per listing per
person; re-applying only after a withdrawal or a `closed_by_listing`
rejection. Application inserts take `pg_advisory_xact_lock` per applicant,
so the daily cap can't be overshot in parallel. The live-listing limit is
checked under a per-owner advisory lock on submit and **re-checked on resume**
(paused listings count), closing the pause-downgrade-resume loophole.

**Activity de-duplication.** `record_outcome` writes activity only when the
stored outcome or a side's confirmation changes, and a partial unique index
keeps at most one unread row per (user, kind, collaboration).

**RPC input checks.** Array caps use `cardinality()` (a 2-D array can't slip
past), and blank or invisible-only questions, answers and references are
rejected.

**Storage.** Bucket file limit 2 MB. Per-user caps: avatars 3, portfolio 8,
listing images 40, application attachments 15. An attachment upload needs a
submitted application of the uploader's with fewer than 3 attachment rows.
Unreferenced files go into `private.storage_cleanup` (AFTER DELETE triggers
on the image tables, avatar changes, retention). The `maintenance` function
claims up to 500 paths (`svc_claim_storage_cleanup`, a 15-minute lease so a
crashed run's rows come back), deletes them through the Storage API and
completes them (`svc_complete_storage_cleanup`). The maintenance function
must be scheduled daily on the hosted project (`docs/NEXT_STEPS.md` 2.15).

**Retention.** `private.apply_retention()` (service-only wrapper
`svc_apply_retention`): activity read 180 days / any 365 days;
rejected or withdrawn applications 12 months after their last change;
resolved reports 3 years (actioned) or 12 months (dismissed). Never touches
pending or accepted applications, memberships, outcomes or references.
Scheduled with `pg_cron` as `directwork-retention` at 03:17 daily when the
extension is available (not in the PGlite tests, which call it directly).

**Legal.** `public.legal_acceptances`: users can SELECT their own rows only;
no client insert, update or delete. Rows come from an AFTER INSERT trigger
on `auth.users` (reads the sign-up metadata once, never raises) and from
`record_legal_acceptance(p_terms_version, p_privacy_version)` (security
definer, always for `auth.uid()`, idempotent; records `terms`, `privacy` and
`age_18`). `get_my_legal_status()` returns the latest accepted versions.
`export_my_data()` is SECURITY INVOKER and returns only the caller's own data
(no other people's emails, no reports about the caller, no blocks against
them, no Stripe ids).

**Legal holds.** `private.legal_holds(user_id, reason, created_at)`, not
reachable by clients; `svc_has_legal_hold()` is service-role only.
`delete-account` refuses while a hold exists, and the foreign key is
`on delete restrict` as a backstop. Admins add and remove holds in SQL
(`docs/NEXT_STEPS.md` 2.20).

**Guardrail tests** now also check column-level privileges
(`information_schema.column_privileges`) on protected tables, and `admins`,
`project_memberships`, `project_outcomes`, `application_status_history` and
`legal_acceptances` are on the no-client-write lists.
