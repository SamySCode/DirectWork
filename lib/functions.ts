import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { CONTACT_DETAILS_MESSAGE } from "./validation";

/** An error returned by one of our Edge Functions, with its message already user-facing. */
export class FunctionError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

/**
 * Calls an Edge Function and unwraps its `{ error, code }` body on failure,
 * so screens can show the server's message instead of "non-2xx status code".
 */
export async function invokeFunction<T = unknown>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response;
      const payload = await response.json().catch(() => null);
      // A gateway or rate limiter can answer without our JSON body.
      const message =
        typeof payload?.error === "string" ? payload.error : statusMessage(response.status);
      throw new FunctionError(message, response.status, payload?.code);
    }
    throw new FunctionError("Can't reach DirectWork. Check your connection and try again.", 0);
  }
  return data as T;
}

type ActionPayload =
  | { action: "submit_listing"; projectId: string }
  | { action: "review_listing"; projectId: string; approve: boolean; note?: string }
  | {
      action: "set_listing_status";
      projectId: string;
      status: "draft" | "published" | "paused" | "completed" | "abandoned";
    }
  | { action: "decide_application"; applicationId: string; accept: boolean; note?: string }
  | { action: "withdraw_application"; applicationId: string }
  | {
      action: "record_outcome";
      membershipId: string;
      outcome: "completed" | "abandoned";
      summary?: string;
    }
  | { action: "write_reference"; membershipId: string; body: string }
  | { action: "ask_question"; applicationId: string; question: string }
  | { action: "answer_question"; questionId: string; answer: string }
  | { action: "resolve_report"; reportId: string; takeAction: boolean; note?: string };

/** Every sensitive state transition goes through supabase/functions/actions. */
export function runAction(payload: ActionPayload): Promise<{ ok: true }> {
  return invokeFunction("actions", payload);
}

const GENERIC = "Something went wrong. Try again.";
const OFFLINE = "Can't reach DirectWork right now. Check your connection and try again.";
const DUPLICATE = "That's already been done.";
const TOO_MANY = "That's a lot of requests in a short time. Wait a minute and try again.";

/** Fallback copy when a response carries no message of its own. */
function statusMessage(status: number): string {
  if (status === 409) return DUPLICATE;
  if (status === 429) return TOO_MANY;
  return GENERIC;
}

/**
 * The request never reached the server: browsers say "Failed to fetch",
 * React Native says "Network request failed", and supabase-js wraps both
 * in AuthRetryableFetchError (status 0) or reports them in a PostgREST
 * error's message.
 */
function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === "AuthRetryableFetchError") return true;
  return (
    typeof message === "string" &&
    /failed to fetch|network request failed|networkerror|load failed/i.test(message)
  );
}

/**
 * A message that's safe to show a person. Our own errors (FunctionError,
 * thrown Errors with written copy, Auth errors) pass through; raw database
 * and storage errors don't - they leak table/policy names and mean nothing
 * to the reader. Rule violations our SQL raises on purpose (P0001) are
 * written for people, so those pass too.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof FunctionError) {
    // Codes from supabase/functions/_shared/http.ts.
    if (error.code === "CONTACT_DETAILS") return CONTACT_DETAILS_MESSAGE;
    if (error.code === "DUPLICATE") return DUPLICATE;
    if (error.code === "RATE_LIMITED" || error.status === 429) return TOO_MANY;
    return error.message || statusMessage(error.status);
  }
  if (isNetworkError(error)) return OFFLINE;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if ("__isStorageError" in record) return "That upload didn't work. Try again.";
    // PostgrestError shape: { code, details, hint, message }.
    if (typeof record.code === "string" && "details" in record) {
      // Our own SQL raises these with copy written for people.
      if (
        (record.code === "P0001" || record.code === "P0002") &&
        typeof record.message === "string"
      ) {
        return record.message;
      }
      // The contact rule's triggers / *_no_contact constraints: the
      // server-side mirror of the form rule.
      if (
        record.code === "23514" &&
        (record.hint === "CONTACT_DETAILS" ||
          String(record.details ?? "").startsWith("no_contact:") ||
          /contact/i.test(String(record.message)))
      ) {
        return CONTACT_DETAILS_MESSAGE;
      }
      if (record.code === "23505") return DUPLICATE;
      return GENERIC;
    }
    // Auth errors carry a status; 429 is Supabase's email/sign-in rate limit.
    if (record.status === 429 || record.code === "over_email_send_rate_limit") {
      return "We've sent a few emails already. Wait a few minutes and try again.";
    }
  }
  // Only real Errors with a written message pass through - never a
  // stringified object (an offline fetch once surfaced as "{}").
  if (error instanceof Error && error.message && !/^s*[{[]/.test(error.message)) {
    return error.message;
  }
  return GENERIC;
}
