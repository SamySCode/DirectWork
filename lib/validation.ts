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

// Mirrors private.has_contact_details() (the trigger-based version in
// 20261105120000_launch_hardening.sql) - the database is the real
// enforcement, this is for inline feedback. Keep the patterns in sync.
// JS translation of the SQL patterns: \m/\M -> \b, [[:space:]] -> \s.
const CONTACT_PATTERNS = [
  /[a-z0-9._%+-]+\s*@\s*[a-z0-9-]+\.[a-z]{2,}/i,
  /[a-z0-9._%+-]+@(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|proton|protonmail)\b/i,
  /(https?:\/\/|www\.)/i,
  /\b(linkedin\.com|lnkd\.in|instagram\.com|facebook\.com|fb\.com|fb\.me|twitter\.com|x\.com|tiktok\.com|calendly\.com|wa\.me|t\.me|telegram\.me|discord\.gg|discord\.com|skype\.com|snapchat\.com|linktr\.ee|youtube\.com|youtu\.be|bit\.ly|tinyurl\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com)\b/i,
  /[a-z0-9._%+-]\s*[([{<]\s*at\s*[)\]}>]\s*[a-z0-9-]+\s*(\.|[([{<]\s*dot\s*[)\]}>]|\bdot\b)/i,
  /[([{<]\s*dot\s*[)\]}>]\s*(com|co|net|org|io|uk|me|dev)\b/i,
  /\bat\s+[a-z0-9-]+\s+dot\s+(com|co|net|org|io|uk|me|dev)\b/i,
  // Phone numbers need a dialling prefix (+, 00 or a leading 0) and 9+ more
  // digits, with at most two separator characters between digits, so dates,
  // year ranges ("2015-2019 2020-2024") and money don't trip it.
  /(?:\+\s?|\b00?)[1-9](?:[\s()./,_|·‐-―•−-]{0,2}[0-9]){8,}/,
];

// Zero-width spaces/joiners, soft hyphens, word joiners, bidi marks: invisible
// characters someone can wedge into "07700 900123" to slip past the patterns.
const FORMAT_CHARS = /\p{Cf}/gu;
const NON_ASCII_DIGIT = /(?![0-9])\p{Nd}/gu;
const DECIMAL_DIGIT = /^\p{Nd}$/u;

/**
 * Folds any script's decimal digit (Arabic-Indic, Devanagari, ...) to ASCII.
 * Unicode lays each set out as 10 consecutive code points from zero, so a
 * digit's value is its distance from the start of its run, mod 10.
 */
function foldDigit(digit: string): string {
  const code = digit.codePointAt(0)!;
  let start = code;
  while (start > 0 && DECIMAL_DIGIT.test(String.fromCodePoint(start - 1))) start -= 1;
  return String((code - start) % 10);
}

/** The text the patterns see: NFKC, invisible format characters dropped, digits folded. */
export function normalizeForContactCheck(text: string): string {
  return text.normalize("NFKC").replace(FORMAT_CHARS, "").replace(NON_ASCII_DIGIT, foldDigit);
}

export function hasContactDetails(text: string | undefined | null): boolean {
  if (!text) return false;
  const normalized = normalizeForContactCheck(text);
  return CONTACT_PATTERNS.some((pattern) => pattern.test(normalized));
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
