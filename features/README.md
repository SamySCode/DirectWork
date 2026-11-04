# features/

One folder per product feature:

```
features/<feature>/
  api.ts          # typed Supabase queries/mutations for this feature
  schemas.ts      # zod validation for client forms
  hooks.ts        # TanStack Query hooks + query keys
  labels.ts       # user-facing copy for enum values (status, type...)
  components/     # UI specific to this feature
```

Built: `auth`, `profile`, `listings` (includes discovery), `applications`
(includes collaborations and outcomes), `billing`, `admin`.
Not built yet: `agreements` (slice 9), `messaging`, `notifications`,
`workspace` (Phase 3).

**Dependencies flow one way:** `applications -> listings -> profile`, and
any feature may use `auth`. Never import in the reverse direction. If two
features both need something, it moves down a level (e.g.
`remotePrefLabels` lives in `profile` because that's where the options
are defined, and `listings/labels.ts` re-exports it). Cross-feature UI
belongs in `components/`; cross-feature infrastructure belongs in `lib/`.

Status changes never write tables directly. They go through
`runAction()` (`lib/functions.ts`) to the `actions` Edge Function. See
`docs/ACCESS_CONTROL.md`.
