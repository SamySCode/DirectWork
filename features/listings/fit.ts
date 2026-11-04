import type { Profile } from "../profile/api";
import type { Listing } from "./api";

export type FitSignal = { key: string; label: string; ok: boolean };

export type Fit = {
  matchedSkills: string[];
  missingSkills: string[];
  /** Non-skill signals that both sides already state - no guessing. */
  signals: FitSignal[];
};

/**
 * "Why you fit" from data already on screen: the viewer's profile and the
 * listing. Deliberately no score or percentage - a number would imply
 * precision that free-text profiles can't support. It lists facts instead.
 */
export function computeFit(
  listing: Pick<Listing, "opportunity_type" | "remote_pref" | "location"> & { skills: string[] },
  profile: Pick<Profile, "seeking_paid" | "seeking_partner" | "remote_pref" | "location"> | null,
  mySkills: ReadonlySet<string>,
): Fit {
  const matchedSkills = listing.skills.filter((skill) => mySkills.has(skill.toLowerCase()));
  const missingSkills = listing.skills.filter((skill) => !mySkills.has(skill.toLowerCase()));
  const signals: FitSignal[] = [];
  if (!profile) return { matchedSkills, missingSkills, signals };

  const paid = listing.opportunity_type === "paid";
  signals.push({
    key: "type",
    label: paid ? "You're open to paid work" : "You're open to partnerships",
    ok: paid ? profile.seeking_paid : profile.seeking_partner,
  });

  if (listing.remote_pref && profile.remote_pref) {
    const flexible = listing.remote_pref === "flexible" || profile.remote_pref === "flexible";
    const ok = flexible || listing.remote_pref === profile.remote_pref;
    signals.push({
      key: "remote",
      label: ok ? "Working setup matches yours" : "Different working setup to yours",
      ok,
    });
  }

  return { matchedSkills, missingSkills, signals };
}
