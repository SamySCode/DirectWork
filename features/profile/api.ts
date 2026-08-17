import { supabase } from "../../lib/supabase";
import type { ProfileInput } from "./schemas";

export type Profile = {
  id: string;
  full_name: string;
  headline: string;
  bio: string | null;
  location: string | null;
  remote_pref: "remote" | "hybrid" | "onsite" | "flexible" | null;
  availability: string | null;
  current_title: string | null;
  experience_level: string | null;
  seeking_paid: boolean;
  seeking_partner: boolean;
  portfolio_url: string | null;
  avatar_url: string | null;
  cv_url: string | null;
  created_at: string;
  updated_at: string;
};

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

type SkillJoinRow = { skills: { name: string } | { name: string }[] | null };

export async function getMyProfileSkills(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("profile_skills")
    .select("skills(name)")
    .eq("profile_id", userId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as SkillJoinRow[];
  return rows.flatMap((row) => {
    if (!row.skills) return [];
    return Array.isArray(row.skills) ? row.skills.map((s) => s.name) : [row.skills.name];
  });
}

// Postgres LIKE/ILIKE treats %, _ and \ as pattern metacharacters even in
// input the caller thinks of as a literal string - escape them so a skill
// name/search term containing those characters can't alter the match.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export async function searchSkills(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { data, error } = await supabase
    .from("skills")
    .select("name")
    .ilike("name", `%${escapeLikePattern(trimmed)}%`)
    .limit(10);
  if (error) throw error;
  return (data ?? []).map((row) => row.name);
}

async function ensureSkillId(name: string): Promise<string> {
  const trimmed = name.trim();
  const exactPattern = escapeLikePattern(trimmed);

  const { data: existing, error: selectError } = await supabase
    .from("skills")
    .select("id")
    .ilike("name", exactPattern)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing.id;

  const { data: inserted, error: insertError } = await supabase
    .from("skills")
    .insert({ name: trimmed })
    .select("id")
    .single();
  if (!insertError) return inserted.id;

  // Unique constraint race: someone else inserted the same skill concurrently.
  if (insertError.code === "23505") {
    const { data: retry, error: retryError } = await supabase
      .from("skills")
      .select("id")
      .ilike("name", exactPattern)
      .single();
    if (retryError) throw retryError;
    return retry.id;
  }
  throw insertError;
}

export async function upsertMyProfile(userId: string, input: ProfileInput): Promise<void> {
  const { skills, ...fields } = input;

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    full_name: fields.fullName,
    headline: fields.headline,
    bio: fields.bio ?? null,
    location: fields.location ?? null,
    remote_pref: fields.remotePref ?? null,
    availability: fields.availability ?? null,
    current_title: fields.currentRole ?? null,
    experience_level: fields.experienceLevel ?? null,
    seeking_paid: fields.seekingPaid,
    seeking_partner: fields.seekingPartner,
    portfolio_url: fields.portfolioUrl ?? null,
  });
  if (profileError) throw profileError;

  const skillIds = await Promise.all(skills.map((name) => ensureSkillId(name)));

  const { error: deleteError } = await supabase
    .from("profile_skills")
    .delete()
    .eq("profile_id", userId);
  if (deleteError) throw deleteError;

  if (skillIds.length > 0) {
    const { error: insertSkillsError } = await supabase
      .from("profile_skills")
      .insert(skillIds.map((skillId) => ({ profile_id: userId, skill_id: skillId })));
    if (insertSkillsError) throw insertSkillsError;
  }
}
