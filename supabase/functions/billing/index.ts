// Owner-side billing: Stripe Checkout to start DirectWork Pro, and the
// Stripe customer portal to manage/cancel it. Checkout, not Connect - no
// money moves between users, so no KYC/escrow (docs/PRODUCT_STRATEGY.md).
//
// Requires STRIPE_SECRET_KEY, STRIPE_PRICE_PRO and APP_URL; returns 503 if
// billing isn't configured so the client can hide it.

import { z } from "npm:zod@4.4.3";
import { handle, HttpError, serviceClient } from "../_shared/http.ts";
import { isActive, stripeRequest } from "../_shared/stripe.ts";

const bodySchema = z.object({ action: z.enum(["checkout", "portal"]) });

async function stripePost(
  key: string,
  path: string,
  params: Record<string, string>,
  idem?: string,
) {
  const response = await stripeRequest(key, "POST", path, params, idem);
  const data = await response.json();
  if (!response.ok) {
    console.error(`Stripe ${path} failed`, data?.error?.type);
    throw new HttpError(502, "Billing is unavailable right now. Try again shortly.");
  }
  return data;
}

handle(
  "billing",
  // Fail closed: if the limiter is down, don't let checkout sessions be spammed.
  { rateLimit: { max: 10, windowSeconds: 60, failClosed: true } },
  async ({ user, body }) => {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const priceId = Deno.env.get("STRIPE_PRICE_PRO");
    const appUrl = Deno.env.get("APP_URL");
    if (!stripeKey || !priceId || !appUrl) {
      throw new HttpError(503, "Billing isn't available yet.", "BILLING_DISABLED");
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, "Invalid request");

    // A failed lookup must not fall through to "no customer yet" - that would
    // create a second Stripe customer and possibly a second subscription.
    const { data: existing, error: lookupError } = await serviceClient()
      .from("subscriptions")
      .select("stripe_customer_id, status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (lookupError) throw new HttpError(500, "Something went wrong on our side. Try again.");

    if (parsed.data.action === "portal") {
      if (!existing?.stripe_customer_id) throw new HttpError(404, "No billing account yet.");
      const session = await stripePost(stripeKey, "billing_portal/sessions", {
        customer: existing.stripe_customer_id,
        return_url: `${appUrl}/billing`,
      });
      return { url: session.url };
    }

    // One Pro subscription per person. Checked against our record and,
    // because the webhook may not have landed yet, against Stripe itself.
    if (isActive(existing?.status)) {
      throw new HttpError(409, "You're already on Pro.", "ALREADY_SUBSCRIBED");
    }
    if (existing?.stripe_customer_id) {
      const response = await stripeRequest(stripeKey, "GET", "subscriptions", {
        customer: existing.stripe_customer_id,
        status: "all",
        limit: "10",
      });
      if (!response.ok)
        throw new HttpError(502, "Billing is unavailable right now. Try again shortly.");
      const { data } = (await response.json()) as { data: { status: string }[] };
      if (data.some((subscription) => isActive(subscription.status))) {
        throw new HttpError(409, "You're already on Pro.", "ALREADY_SUBSCRIBED");
      }
    }

    // Redirect targets come only from APP_URL (server config), never from
    // the request - no open redirect through Checkout.
    const params: Record<string, string> = {
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      client_reference_id: user.id,
      "subscription_data[metadata][user_id]": user.id,
      success_url: `${appUrl}/billing?status=success`,
      cancel_url: `${appUrl}/billing?status=cancelled`,
      allow_promotion_codes: "true",
    };
    if (existing?.stripe_customer_id) {
      params.customer = existing.stripe_customer_id;
    } else if (user.email) {
      params.customer_email = user.email;
    }
    // Double-clicks and second tabs within 10 minutes get the same session
    // back from Stripe instead of a new one.
    const window = Math.floor(Date.now() / 600_000);
    const session = await stripePost(
      stripeKey,
      "checkout/sessions",
      params,
      `checkout:${user.id}:${window}`,
    );
    return { url: session.url };
  },
);
