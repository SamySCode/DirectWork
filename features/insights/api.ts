import { supabase } from "../../lib/supabase";

export type PlatformPulse = {
  open_to_paid: number;
  open_to_partner: number;
  live_listings: number;
  completed: number;
};

export async function getPlatformPulse(): Promise<PlatformPulse> {
  const { data, error } = await supabase.rpc("get_platform_pulse").single();
  if (error) throw error;
  return data as PlatformPulse;
}

/** Professionals open to this kind of work with at least one of these skills. */
export async function countProfessionalsFor(
  skills: string[],
  type: "paid" | "partner",
): Promise<number> {
  if (skills.length === 0) return 0;
  const { data, error } = await supabase.rpc("count_professionals_for", {
    p_skills: skills.slice(0, 15),
    p_type: type,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

/**
 * Small exact counts are both discouraging and slightly identifying
 * ("2 people with Elixir" points at someone), so they're softened.
 */
export function describeCount(count: number): string {
  if (count <= 0) return "No one yet";
  if (count < 5) return "A few";
  return count.toLocaleString("en-GB");
}
