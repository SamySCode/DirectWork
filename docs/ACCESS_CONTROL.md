# Access control strategy

Principle: **RLS handles ownership-scoped visibility. Edge Functions
handle state transitions with business rules.** Never let a client
directly write `applications.status`, insert into `project_memberships`,
or insert into `agreement_acceptances`. Both layers matter — RLS alone
can't express "and only if the prior status was X"; an Edge Function
alone can't stop a compromised or bypassed client from reading rows it
shouldn't.

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
- **Add explicit `grant`s on every new table.** Current Supabase projects
  do not auto-expose new `public` schema tables to the `anon`/
  `authenticated` Data API roles (see `supabase/config.toml`'s
  `auto_expose_new_tables` note) — without an explicit `grant`, correct
  RLS policies are simply unreachable, which presents as a confusing
  "everything 404s" bug that looks like an RLS mistake but isn't one.
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
`decide_application`, `withdraw_application`, `record_outcome`.

Direct client writes that remain, all narrowed by **column-level grants**
on top of RLS: listing fields while editable (never `status`,
`is_featured`, `review_note`, `owner_id`), admission criteria and required
skills while editable, `applications (project_id, cover_note)` — the
trigger sets everything else — and `skills (name)`.

Read-side RPCs with their own checks: `get_application_contact` (only the
two parties, only once accepted), `get_track_record`, `get_listing_quota`.

Other functions: `delete-account` (App Store 5.1.1(v) / UK GDPR erasure;
cancels any Stripe subscription first), `billing` (Checkout/Portal
sessions), `billing-webhook` (`verify_jwt = false`; Stripe-Signature HMAC
with a 5-minute replay window instead).

Tests: `npm run test:db` — 43 cases covering each negative path above,
plus schema guardrails (see below).

## Security pass (2026-11-04)

**Row level security**

- RLS is on for every table; the test suite fails if any `public` table
  is created without it, if any foreign key lacks an index, if any
  `security definer` function doesn't pin `search_path`, if anything in
  `private` is executable by PUBLIC, or if a `svc_*` wrapper is callable
  by signed-in users. New migrations can't regress these silently.
- Storage: files live in per-user folders (`<user id>/...`), enforced by
  `storage.objects` policies. Restrictive policies cap files per user per
  bucket (avatars 5, portfolio 12, listing images 120, attachments 60) and
  require a pending application before attachment uploads. Bucket limits
  (5 MB, JPEG/PNG/WebP only) are enforced by Storage itself.
- Application attachments are in a **private** bucket, readable only by
  the applicant and the listing owner, via 1-hour signed URLs.
- `profiles.avatar_url` and every image `storage_path` must point inside
  the owner's own folder (check constraints/triggers), so a row can never
  reference someone else's file or an external tracking URL.

**Content rule**: emails, phone numbers and links are rejected in free
text other people read before mutual acceptance (headline, bio, listing
title/summary/admission criteria, cover notes, captions). Check
constraints in the database, mirrored by `hasContactDetails()` in
`lib/validation.ts`; both are tested against the same cases.

**Injection / input handling**

- All SQL is parameterised (PostgREST, RPC args, `format`-free plpgsql).
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

| Table                   | Read                               | Write                                                                                                |
| ----------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `activity`              | own rows                           | triggers only; client may set `read_at` on own rows                                                  |
| `work_references`       | any signed-in user                 | `actions` → `private.write_reference` (party to a mutually confirmed completed collaboration, once)  |
| `application_questions` | the two parties to the application | `actions` → `ask_question` (owner) / `answer_question` (applicant)                                   |
| `reports`               | own reports; admins all            | insert as yourself (column grants, 10/day trigger); resolve via `actions` → `resolve_report` (admin) |
| `blocks`                | own blocks only                    | insert/delete own; enforced in the application insert trigger and `ask_question`                     |

`profiles.availability_confirmed_at` has no client grant: it's renewed by
`confirm_availability()` or by the trigger when what you're looking for
changes. Table privileges are now revoked and re-granted explicitly for
every table (`20261104220000`), and the DB test harness no longer grants
service_role anything blanket, so a missing grant fails a test.

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
