# lib/

Cross-cutting infrastructure, not feature logic:

- `theme.ts` — colors, spacing, radius, typography shared by every screen/component
- `env.ts` — env accessor (placeholder until zod-validated parsing lands)
- `supabase.ts` — Supabase client (URL + publishable key from env, session persisted via AsyncStorage)
- `animation.ts` — `nativeDriverEnabled`: pass to every `Animated.timing`/`Animated.spring` call's `useNativeDriver` option. Native only; web has no native animated module and warns if you pass `true` unconditionally.

If it belongs to one feature only, it goes in `features/<feature>/` instead.
