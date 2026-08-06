# lib/

Cross-cutting infrastructure, not feature logic:

- `theme.ts` — colors, spacing, radius, typography shared by every screen/component
- `env.ts` — env accessor (placeholder until zod-validated parsing lands)
- `supabase.ts` — Supabase client (URL + publishable key from env, session persisted via AsyncStorage)

If it belongs to one feature only, it goes in `features/<feature>/` instead.
