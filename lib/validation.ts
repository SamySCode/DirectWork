import { useState } from "react";
import { z } from "zod";

/**
 * Maps each zod issue to its field name - the last string segment of its
 * path, so nested objects (e.g. a listing's `admission.firstMilestone`)
 * land on the input that can fix them. First message per field wins.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = [...issue.path].reverse().find((part) => typeof part === "string") ?? "form";
    if (!(key in result)) result[key] = issue.message;
  }
  return result;
}

// Mirrors private.has_contact_details() in the images/content-rules
// migration - the database is the real enforcement, this is for inline
// feedback. Keep the patterns in sync.
const CONTACT_PATTERNS = [
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /(https?:\/\/|www\.)/i,
  /\+?\(?[0-9](?:[\s().-]*[0-9]){9,}/,
];

export function hasContactDetails(text: string | undefined | null): boolean {
  return !!text && CONTACT_PATTERNS.some((pattern) => pattern.test(text));
}

export const CONTACT_DETAILS_MESSAGE =
  "Leave out emails, phone numbers and links. Contact details are shared automatically once you both accept.";

/** Trimmed text up to `max` characters that carries no contact details. */
export const plainText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .refine((value) => !hasContactDetails(value), CONTACT_DETAILS_MESSAGE);

/**
 * Form validation that feels live without being naggy: a field's error
 * appears once you leave it (or press submit), then updates as you type.
 */
export function useFormValidation<T>(schema: z.ZodType<T>, values: unknown) {
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const parsed = schema.safeParse(values);
  const all = parsed.success ? {} : fieldErrors(parsed.error);
  const errors = submitted
    ? all
    : Object.fromEntries(Object.entries(all).filter(([key]) => touched.has(key)));

  return {
    errors,
    hasErrors: Object.keys(errors).length > 0,
    /** Call from a field's onBlur. */
    touch: (field: string) =>
      setTouched((prev) => (prev.has(field) ? prev : new Set(prev).add(field))),
    /** Shows every error; returns the parsed data, or null if invalid. */
    submit: (): T | null => {
      setSubmitted(true);
      return parsed.success ? parsed.data : null;
    },
    /** Error keys in the order they appear in the form - for jumping to the first. */
    allErrors: all,
  };
}
