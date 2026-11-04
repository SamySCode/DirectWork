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

import { handle, HttpError, serviceClient } from "../_shared/http.ts";
import { deleteCustomer } from "../_shared/stripe.ts";

const BUCKETS = ["avatars", "portfolio", "listing-images", "application-attachments"];
const PAGE = 1000;
const REAUTH_WINDOW_MS = 10 * 60 * 1000;

type Admin = ReturnType<typeof serviceClient>;

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

handle(
  "delete-account",
  // Fail closed: an irreversible action shouldn't run unthrottled.
  { rateLimit: { max: 3, windowSeconds: 3600, failClosed: true } },
  async ({ user, requestId }) => {
    const admin = serviceClient();

    // Irreversible, so a valid session isn't enough on its own: the person
    // must have signed in (re-entered their password) in the last few
    // minutes. Stops a borrowed unlocked phone or a stolen token deleting
    // the account. The app asks for the password right before calling this.
    const { data: fresh, error: freshError } = await admin.auth.admin.getUserById(user.id);
    if (freshError || !fresh.user) throw new HttpError(401, "Sign in again to continue.");
    const lastSignIn = fresh.user.last_sign_in_at ? Date.parse(fresh.user.last_sign_in_at) : 0;
    if (Date.now() - lastSignIn > REAUTH_WINDOW_MS) {
      throw new HttpError(403, "Confirm your password to delete your account.", "REAUTH_REQUIRED");
    }

    const { data: subscription, error: lookupError } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (lookupError) throw new HttpError(500, "We couldn't delete your account. Try again.");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
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
  },
);
