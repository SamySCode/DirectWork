import type { Profile } from "./api";

export type StrengthItem = { key: string; label: string; done: boolean };

/**
 * What an owner looks at before replying, as a checklist. Each item is
 * something the person can fix in one tap, in the order that matters most -
 * so the first unchecked item is always the most useful next step.
 */
export function profileStrength(
  profile: Pick<Profile, "avatar_url" | "bio" | "availability" | "portfolio_url">,
  skillCount: number,
  portfolioCount: number,
): StrengthItem[] {
  return [
    { key: "photo", label: "Add a profile photo", done: !!profile.avatar_url },
    { key: "skills", label: "List at least 3 skills", done: skillCount >= 3 },
    {
      key: "bio",
      label: "Write a short bio",
      done: (profile.bio?.trim().length ?? 0) >= 40,
    },
    { key: "work", label: "Show some work", done: portfolioCount > 0 || !!profile.portfolio_url },
    { key: "availability", label: "Say when you're available", done: !!profile.availability },
  ];
}
