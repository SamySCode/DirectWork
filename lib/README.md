# lib/

Cross-cutting infrastructure, not feature logic:

- `theme.ts` — colors, gradients, spacing, radius, shadows, layout and
  typography shared by every screen/component. See `components/README.md`
  for what each color is reserved for.
- `env.ts` — zod-validated `EXPO_PUBLIC_*` config. Fails fast at startup
  with the missing names rather than at the first network call.
- `supabase.ts` — Supabase client (URL + publishable key from env, session
  persisted via AsyncStorage, URL session detection on web only).
- `query.ts` — the TanStack Query client. Cost-conscious defaults (30s
  stale time, refetch on app foreground, no Realtime).
- `functions.ts` — `invokeFunction()` unwraps Edge Function error bodies
  into a `FunctionError` with a user-facing message and optional `code`.
  `runAction()` is the typed caller for the `actions` gate (every
  sensitive state transition).
- `images.ts`: `pickImages()` (type and size checks, resize to <=1600px
  JPEG, which also strips EXIF/GPS), `uploadImage()` into the caller's own
  folder, `removeImages()`, `publicImageUrl()`, and batched
  `signedImageUrls()` for the private attachments bucket.
- `confirm.ts` — a cross-platform confirm dialog. React Native Web's
  `Alert` is a no-op, so web falls back to `window.confirm`.
- `animation.ts` — `nativeDriverEnabled`: pass to every `Animated.timing`/`Animated.spring` call's `useNativeDriver` option. Native only; web has no native animated module and warns if you pass `true` unconditionally.
- `fonts.ts` — `useAppFonts()` loads the one display font (see `theme.ts`'s `displayFontFamily`); gate app reveal on it finishing, same as the session check (see `app/_layout.tsx`).
- `validation.ts`: `useFormValidation()` shows a field's error once you
  leave it, then keeps it live; `fieldErrors()` maps zod issues (including
  nested ones) to field names; `hasContactDetails()` mirrors the
  database's no-contact-details rule.

If it belongs to one feature only, it goes in `features/<feature>/` instead.
