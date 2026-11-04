// Client copy of the plan rules. The enforcement lives in
// private.live_listing_limit / private.has_pro (migrations) - if you change
// a number here, change it there too, or the UI will promise something the
// database refuses. See docs/MONETIZATION.md for the reasoning.

export type PlanId = "free" | "pro";

export type Plan = {
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  liveListings: number;
  features: string[];
};

export const plans: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    price: "£0",
    cadence: "forever",
    liveListings: 1,
    features: [
      "1 live listing at a time",
      "Reviewed by our team before it goes live",
      "Unlimited applicants",
      "Contact details shared on mutual acceptance",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: "£29",
    cadence: "per month",
    liveListings: 10,
    features: [
      "Up to 10 live listings at a time",
      "Featured placement at the top of Discover",
      "Everything in Free",
      "Cancel any time",
    ],
  },
};

export const PROFESSIONAL_PROMISE =
  "Finding work on DirectWork is free, always. Only people posting listings ever pay.";
