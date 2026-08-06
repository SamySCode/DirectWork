# lib/

Cross-cutting infrastructure, not feature logic:

- `supabase.ts` — Supabase client init (added once the Supabase project exists)
- `env.ts` — zod-validated environment variables
- other framework-level helpers shared across every feature

If it belongs to one feature only, it goes in `features/<feature>/` instead.
