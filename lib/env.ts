// Placeholder until zod-validated parsing replaces this (see docs/ARCHITECTURE.md).
const REQUIRED_ENV_VARS = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

export function getEnv(name: RequiredEnvVar): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function assertEnv(): void {
  for (const name of REQUIRED_ENV_VARS) {
    getEnv(name);
  }
}
