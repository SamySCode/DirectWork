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
