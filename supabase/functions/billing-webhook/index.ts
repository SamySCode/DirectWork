// Stripe -> plan state. The only writer of public.subscriptions.
// Deployed with verify_jwt = false (Stripe can't send a Supabase JWT);
// authenticity comes from the Stripe-Signature HMAC check instead, with a
// 5-minute tolerance against replays (_shared/stripe.ts).
//
// Events can arrive out of order or be retried late, so the payload is only
// used to learn *which* subscription changed - its current state is then
// fetched from Stripe, so an old event can never overwrite newer state.

import { handle, HttpError, serviceClient } from "../_shared/http.ts";
import {
  deleteCustomer,
  planFor,
  shouldApply,
  stripeRequest,
  toStatus,
  verifySignature,
} from "../_shared/stripe.ts";

type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  metadata?: { user_id?: string };
  current_period_end?: number;
  items?: { data?: { current_period_end?: number }[] };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

handle(
  "billing-webhook",
  // Server-to-server: no CORS, no Supabase auth, raw body for the HMAC.
  { auth: false, cors: false, rawBody: true, maxBodyBytes: 512 * 1024 },
  async ({ req, rawBody, requestId }) => {
    const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secret || !stripeKey) throw new HttpError(503, "Webhook not configured");

    const signature = req.headers.get("Stripe-Signature") ?? "";
    if (!(await verifySignature(rawBody, signature, secret))) {
      throw new HttpError(400, "Invalid signature");
    }

    const event = JSON.parse(rawBody);
    if (!event.type?.startsWith("customer.subscription.")) {
      return { received: true, ignored: event.type };
    }

    const subscriptionId = String(event.data?.object?.id ?? "");
    if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) return { received: true, ignored: "bad id" };

    const response = await stripeRequest(stripeKey, "GET", `subscriptions/${subscriptionId}`);
    if (!response.ok) throw new HttpError(502, "Couldn't fetch subscription from Stripe");
    const subscription = (await response.json()) as StripeSubscription;

    const userId = subscription.metadata?.user_id ?? "";
    if (!UUID.test(userId)) {
      console.error(`[${requestId}] subscription without a valid user_id`, subscription.id);
      return { received: true, ignored: "no user_id" };
    }

    const admin = serviceClient();
    const { data: stored, error: readError } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id, status")
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) throw new HttpError(500, "Failed to read subscription");
    if (!shouldApply(stored, subscription)) {
      return { received: true, ignored: "superseded subscription" };
    }

    const status = toStatus(subscription.status);
    // current_period_end moved onto subscription items in newer API versions.
    const periodEnd =
      subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end ?? null;

    const { error } = await admin.rpc("svc_apply_subscription", {
      p_user: userId,
      p_plan: planFor(status),
      p_status: status,
      p_customer: subscription.customer,
      p_subscription: subscription.id,
      p_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    });
    if (error) {
      // 23503: the user no longer exists - e.g. they finished an open Checkout
      // after deleting their account. Nobody can use this plan, so cancel it
      // and erase the customer rather than keep charging a deleted account.
      if (error.code === "23503") {
        const erased = await deleteCustomer(stripeKey, subscription.customer);
        if (!erased) throw new HttpError(502, "Couldn't cancel orphaned subscription");
        console.warn(`[${requestId}] erased Stripe customer for deleted user`);
        return { received: true, cancelled: "user deleted" };
      }
      console.error(`[${requestId}] failed to apply subscription`, error);
      // Non-2xx makes Stripe retry, which is what we want for a transient DB error.
      throw new HttpError(500, "Failed to apply subscription");
    }
    return { received: true };
  },
);
