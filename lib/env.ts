import { z } from "zod";

// Expo only inlines EXPO_PUBLIC_* vars when they're referenced statically
// (process.env.NAME, not process.env[name]) - so each is listed explicitly.
const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.url("EXPO_PUBLIC_SUPABASE_URL must be a URL"),
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  // Optional: billing UI stays hidden until Stripe is configured on the
  // billing Edge Function (CLAUDE.md: no UI for unconfigured providers).
  EXPO_PUBLIC_BILLING_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

const parsed = envSchema.safeParse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  EXPO_PUBLIC_BILLING_ENABLED: process.env.EXPO_PUBLIC_BILLING_ENABLED,
});

if (!parsed.success) {
  const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Invalid environment configuration: ${missing}. See .env.example.`);
}

export const env = parsed.data;

type EnvKey = "EXPO_PUBLIC_SUPABASE_URL" | "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

export function getEnv(name: EnvKey): string {
  return env[name];
}
