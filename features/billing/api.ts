import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { FunctionError, invokeFunction } from "../../lib/functions";
import { supabase } from "../../lib/supabase";

export type Subscription = {
  plan: "free" | "pro";
  status: "inactive" | "active" | "trialing" | "past_due" | "canceled";
  current_period_end: string | null;
};

export async function getMySubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Subscription | null;
}

export function isPro(subscription: Subscription | null | undefined): boolean {
  if (!subscription || subscription.plan !== "pro") return false;
  if (!["active", "trialing", "past_due"].includes(subscription.status)) return false;
  return !subscription.current_period_end || new Date(subscription.current_period_end) > new Date();
}

// Only ever navigate to Stripe's own hosted pages - a compromised or
// misconfigured function response must not become an open redirect.
const STRIPE_HOSTS = new Set(["checkout.stripe.com", "billing.stripe.com"]);

export function isStripeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && STRIPE_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

async function openStripe(action: "checkout" | "portal"): Promise<void> {
  const { url } = await invokeFunction<{ url: string }>("billing", { action });
  if (!isStripeUrl(url)) throw new Error("Billing is unavailable right now. Try again shortly.");
  if (Platform.OS === "web") {
    window.location.assign(url);
    return;
  }
  // The webhook updates the plan; the billing screen refetches on return.
  await WebBrowser.openBrowserAsync(url);
}

/** Already on Pro (e.g. a second tab, or before the webhook landed)? Manage it instead. */
export async function startCheckout(): Promise<void> {
  try {
    await openStripe("checkout");
  } catch (error) {
    if (error instanceof FunctionError && error.code === "ALREADY_SUBSCRIBED") {
      await openStripe("portal");
      return;
    }
    throw error;
  }
}
export const openBillingPortal = () => openStripe("portal");
