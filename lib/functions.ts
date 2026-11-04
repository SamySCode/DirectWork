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
      throw new FunctionError(
        payload?.error ?? "Something went wrong. Try again.",
        response.status,
        payload?.code,
      );
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
  if (error instanceof FunctionError) return error.message;
  if (isNetworkError(error)) return OFFLINE;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if ("__isStorageError" in record) return "That upload didn't work. Try again.";
    // PostgrestError shape: { code, details, hint, message }.
    if (typeof record.code === "string" && "details" in record) {
      if (record.code === "P0001" && typeof record.message === "string") return record.message;
      // A *_no_contact check constraint: the server-side mirror of the form rule.
      if (record.code === "23514" && String(record.message).includes("no_contact")) {
        return CONTACT_DETAILS_MESSAGE;
      }
      return GENERIC;
    }
  }
  return error instanceof Error && error.message ? error.message : GENERIC;
}
