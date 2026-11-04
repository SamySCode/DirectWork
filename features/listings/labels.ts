import type { BadgeTone } from "../../components/Badge";
import type { Listing, ListingStatus } from "./api";

export { remotePrefLabels } from "../profile/labels";

export const opportunityLabels = {
  paid: "Paid work",
  partner: "Partnership",
} as const;

export const commitmentLabels = {
  few_hours: "A few hours a week",
  part_time: "Part-time",
  full_time: "Full-time",
} as const;

export const compensationLabels = {
  fixed: "Fixed price",
  hourly: "Hourly",
  daily: "Day rate",
} as const;

export const listingStatusMeta: Record<
  ListingStatus,
  { label: string; tone: BadgeTone; hint: string }
> = {
  draft: {
    label: "Draft",
    tone: "neutral",
    hint: "Only you can see this. Submit it when it's ready.",
  },
  in_review: {
    label: "In review",
    tone: "warning",
    hint: "Our team checks every listing before it goes live, usually within a day.",
  },
  changes_requested: {
    label: "Changes requested",
    tone: "danger",
    hint: "A reviewer asked for changes before this can go live.",
  },
  published: { label: "Live", tone: "mint", hint: "Visible in Discover and open to applications." },
  paused: { label: "Paused", tone: "neutral", hint: "Hidden from Discover. Resume any time." },
  completed: { label: "Completed", tone: "accent", hint: "Closed - the work got done." },
  abandoned: { label: "Closed", tone: "neutral", hint: "Closed without completing." },
};

const currencySymbols = { GBP: "£", EUR: "€", USD: "$" } as const;

export function formatCompensation(
  listing: Pick<
    Listing,
    "opportunity_type" | "compensation_type" | "compensation_min" | "compensation_max" | "currency"
  >,
): string | null {
  if (listing.opportunity_type !== "paid" || !listing.compensation_type) return null;
  const symbol = currencySymbols[listing.currency];
  const suffix =
    listing.compensation_type === "hourly"
      ? "/hr"
      : listing.compensation_type === "daily"
        ? "/day"
        : "";
  const { compensation_min: min, compensation_max: max } = listing;
  const amount = (value: number) => `${symbol}${value.toLocaleString("en-GB")}`;
  if (min != null && max != null && min !== max) return `${amount(min)}–${amount(max)}${suffix}`;
  if (min != null || max != null) return `${amount((min ?? max)!)}${suffix}`;
  return compensationLabels[listing.compensation_type];
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  if (seconds < 86400 * 30) return `${Math.round(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
