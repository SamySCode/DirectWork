# features/

One folder per product feature, each self-contained:

```
features/<feature>/
  api.ts          # typed Supabase queries/mutations for this feature
  schemas.ts      # zod validation, shared by client forms and Edge Functions
  hooks.ts        # data-fetching hooks (e.g. TanStack Query)
  components/     # UI specific to this feature
```

Planned features (see `docs/ARCHITECTURE.md` for the vertical-slice order):
`auth`, `profile`, `listings`, `discovery`, `applications`, `agreements`,
`workspace`, `messaging`, `notifications`.

Cross-feature UI belongs in `components/`; cross-feature utilities belong in
`lib/`.
