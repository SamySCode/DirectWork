// In-app account deletion - required by App Store Review Guideline 5.1.1(v)
// for any app with account creation, and a UK GDPR erasure path. Deleting
// the auth user cascades through profiles -> projects/applications/
// memberships/outcomes (see the migrations' `on delete cascade`).
//
// Order matters: erase the Stripe customer first (cancels every
// subscription they have - a deleted user must never be billed again - and
// removes their data from Stripe), then remove stored files (not covered by
// the cascade), then delete the user. If a Checkout completes *after* this,
// billing-webhook erases that customer too.

import {
  type AuthMethod,
  type Context,
  createHandler,
  type Deps,
  HttpError,
} from "../_shared/http.ts";
import { deleteCustomer } from "../_shared/stripe.ts";

const BUCKETS = ["avatars", "portfolio", "listing-images", "application-attachments"];
const PAGE = 1000;
const REAUTH_WINDOW_MS = 10 * 60 * 1000;

type Admin = Context<true>["admin"];

// Methods that prove the person just typed a secret on this session: a
// password sign-in, or a password-reset link. Refreshing a token keeps the
// session's original amr timestamps, so it can't renew this.
const FRESH_METHODS = new Set(["password", "recovery"]);
const CLOCK_SKEW_SECONDS = 60;

export function freshlyAuthenticated(amr: AuthMethod[], nowMs = Date.now()): boolean {
  const now = nowMs / 1000;
  return amr.some(
    ({ method, timestamp }) =>
      FRESH_METHODS.has(method) &&
      now - timestamp <= REAUTH_WINDOW_MS / 1000 &&
      timestamp <= now + CLOCK_SKEW_SECONDS,
  );
}

export const LEGAL_HOLD_MESSAGE = "Your account can't be deleted right now. Contact support.";

/** Every entry in one folder, following pagination past 1000. */
async function listAll(admin: Admin, bucket: string, prefix: string) {
  const entries: { name: string; id: string | null }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw error;
    entries.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return entries;
  }
}

/** Every object under `<userId>/`, including one level of subfolders (listing images). */
async function listUserFiles(admin: Admin, bucket: string, userId: string): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await listAll(admin, bucket, userId)) {
    if (entry.id) {
      paths.push(`${userId}/${entry.name}`);
    } else {
      const folder = `${userId}/${entry.name}`;
      for (const file of await listAll(admin, bucket, folder)) paths.push(`${folder}/${file.name}`);
    }
  }
  return paths;
}

export async function deleteAccount({ user, requestId, admin, env }: Context<true>) {
  // Irreversible, so a valid session isn't enough on its own: *this*
  // session must have been authenticated with the password in the last few
  // minutes (the app asks for it right before calling). Read from the
  // verified token's amr claim, not the user's last_sign_in_at - that is
  // per user (any other session of theirs would pass) and a legacy token
  // refresh moves it.
  if (!freshlyAuthenticated(user.amr)) {
    throw new HttpError(403, "Confirm your password to delete your account.", "REAUTH_REQUIRED");
  }

  // Legal hold (e.g. an open CSEA report under the Online Safety Act): the
  // data must be preserved. The message deliberately doesn't say why.
  const { data: held, error: holdError } = await admin.rpc("svc_has_legal_hold", {
    p_user: user.id,
  });
  if (holdError) {
    console.error(`[${requestId}] legal hold check failed`, holdError);
    throw new HttpError(500, "We couldn't delete your account. Try again.");
  }
  if (held !== false) throw new HttpError(403, LEGAL_HOLD_MESSAGE, "DELETION_UNAVAILABLE");

  const { data: subscription, error: lookupError } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupError) throw new HttpError(500, "We couldn't delete your account. Try again.");

  const stripeKey = env("STRIPE_SECRET_KEY");
  if (stripeKey && subscription?.stripe_customer_id) {
    // Covers every status (active, past_due, unpaid, paused...), not just
    // the ones we store as active.
    if (!(await deleteCustomer(stripeKey, subscription.stripe_customer_id))) {
      console.error(`[${requestId}] Stripe customer deletion failed`);
      throw new HttpError(
        502,
        "We couldn't cancel your subscription. Try again or contact support.",
      );
    }
  }

  for (const bucket of BUCKETS) {
    try {
      const paths = await listUserFiles(admin, bucket, user.id);
      for (let i = 0; i < paths.length; i += PAGE) {
        const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + PAGE));
        if (error) throw error;
      }
    } catch (error) {
      // Not fatal: the account still gets deleted; leftovers are logged.
      console.error(`[${requestId}] file cleanup failed in ${bucket}`, error);
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error(`[${requestId}] account deletion failed`, error);
    throw new HttpError(500, "We couldn't delete your account. Try again.");
  }
  return { ok: true };
}

export function createDeleteAccountHandler(deps?: Deps) {
  return createHandler(
    "delete-account",
    // Fail closed: an irreversible action shouldn't run unthrottled.
    { rateLimit: { max: 3, windowSeconds: 3600, failClosed: true } },
    deleteAccount,
    deps,
  );
}
