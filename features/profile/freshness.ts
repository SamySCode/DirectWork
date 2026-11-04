import type { Profile } from "./api";

/** Mirrors the 30-day window in get_platform_pulse / count_professionals_for. */
export const FRESH_DAYS = 30;
/** Ask a week before the claim lapses. */
export const NUDGE_DAYS = 23;

const DAY = 24 * 60 * 60 * 1000;

export type Freshness = {
  /** Open to paid work or partnerships at all. */
  seeking: boolean;
  daysAgo: number;
  /** Past the window: no longer counted as available. */
  stale: boolean;
  /** Time to ask "still available?". */
  nudge: boolean;
};

export function availabilityFreshness(
  profile: Pick<Profile, "seeking_paid" | "seeking_partner" | "availability_confirmed_at">,
  now = Date.now(),
): Freshness {
  const seeking = profile.seeking_paid || profile.seeking_partner;
  const daysAgo = Math.max(
    0,
    Math.floor((now - new Date(profile.availability_confirmed_at).getTime()) / DAY),
  );
  return {
    seeking,
    daysAgo,
    stale: seeking && daysAgo >= FRESH_DAYS,
    nudge: seeking && daysAgo >= NUDGE_DAYS,
  };
}

export function freshnessLabel({ seeking, daysAgo, stale }: Freshness): string | null {
  if (!seeking) return null;
  if (stale) return "Hasn't confirmed availability in over a month";
  if (daysAgo === 0) return "Availability confirmed today";
  return `Availability confirmed ${daysAgo} ${daysAgo === 1 ? "day" : "days"} ago`;
}
