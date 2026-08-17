import type { z } from "zod";

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(
    Object.entries(flattened).map(([key, messages]) => [key, messages?.[0] ?? ""]),
  );
}
