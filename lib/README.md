# lib/

Cross-cutting infrastructure, not feature logic:

- `theme.ts` — colors, spacing, radius, typography shared by every screen/component
- `env.ts` — env accessor (placeholder until zod-validated parsing lands)
- `supabase.ts` — Supabase client (URL + publishable key from env, session persisted via AsyncStorage)
- `animation.ts` — `nativeDriverEnabled`: pass to every `Animated.timing`/`Animated.spring` call's `useNativeDriver` option. Native only; web has no native animated module and warns if you pass `true` unconditionally.
- `fonts.ts` — `useAppFonts()` loads the one display font (see `theme.ts`'s `displayFontFamily`); gate app reveal on it finishing, same as the session check (see `app/_layout.tsx`).
- `validation.ts` — `fieldErrors()` flattens a `ZodError` into a `{field: message}` map for form state. Shared across features so schemas.ts stays feature-local per `features/README.md`.

If it belongs to one feature only, it goes in `features/<feature>/` instead.
