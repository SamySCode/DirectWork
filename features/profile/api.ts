import { PreparedImage, publicImageUrl, removeImages, uploadImage } from "../../lib/images";
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
  wants_to_hire: boolean;
  portfolio_url: string | null;
  avatar_url: string | null;
  cv_url: string | null;
  /** Renewed by confirm_availability or by changing what you are looking for. */
  availability_confirmed_at: string;
  created_at: string;
  updated_at: string;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

type SkillJoinRow = { skills: { name: string } | { name: string }[] | null };

export async function getProfileSkills(userId: string): Promise<string[]> {
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

export type TrackRecord = { completed: number; total: number };

/** Mutually confirmed outcomes only - see private.record_outcome. */
export async function getTrackRecord(userId: string): Promise<TrackRecord> {
  const { data, error } = await supabase.rpc("get_track_record", { p_user: userId }).single();
  if (error) throw error;
  return data as TrackRecord;
}

// Postgres LIKE/ILIKE treats %, _ and \ as pattern metacharacters even in
// input the caller thinks of as a literal string - escape them so a skill
// name/search term containing those characters can't alter the match.
export function escapeLikePattern(value: string): string {
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

/**
 * Looks up (creating where new) a whole list of skills in one round trip.
 * Matching is case-insensitive, so "react native" reuses "React Native".
 */
export async function ensureSkillIds(names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const { data, error } = await supabase.rpc("ensure_skills", { p_names: names });
  if (error) throw error;
  return ((data ?? []) as { id: string }[]).map((row) => row.id);
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
    wants_to_hire: fields.wantsToHire,
    portfolio_url: fields.portfolioUrl ?? null,
  });
  if (profileError) throw profileError;

  const skillIds = await ensureSkillIds(skills);

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

export function avatarUrl(path: string | null | undefined): string | null {
  return path ? publicImageUrl("avatars", path) : null;
}

/** Uploads a new photo, points the profile at it, then deletes the old file. */
export async function setAvatar(userId: string, image: PreparedImage, previous: string | null) {
  const path = await uploadImage("avatars", userId, image);
  const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
  if (error) {
    await removeImages("avatars", [path]).catch(() => {});
    throw error;
  }
  if (previous) await removeImages("avatars", [previous]).catch(() => {});
}

export async function clearAvatar(userId: string, previous: string | null) {
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
  if (error) throw error;
  if (previous) await removeImages("avatars", [previous]).catch(() => {});
}

export type PortfolioImage = {
  id: string;
  storage_path: string;
  caption: string | null;
  position: number;
  url: string;
};

export async function getPortfolio(userId: string): Promise<PortfolioImage[]> {
  const { data, error } = await supabase
    .from("portfolio_images")
    .select("id, storage_path, caption, position")
    .eq("profile_id", userId)
    .order("position")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    url: publicImageUrl("portfolio", row.storage_path),
  }));
}

export async function addPortfolioImages(userId: string, images: PreparedImage[], startAt: number) {
  for (const [index, image] of images.entries()) {
    const path = await uploadImage("portfolio", userId, image);
    const { error } = await supabase
      .from("portfolio_images")
      .insert({ storage_path: path, position: startAt + index });
    if (error) {
      await removeImages("portfolio", [path]).catch(() => {});
      throw error;
    }
  }
}

export async function removePortfolioImage(image: PortfolioImage) {
  const { error } = await supabase.from("portfolio_images").delete().eq("id", image.id);
  if (error) throw error;
  await removeImages("portfolio", [image.storage_path]).catch(() => {});
}

export type ReplyRecord = { received: number; replied: number; median_hours: number | null };

/** Owner responsiveness (anti-ghosting) - aggregates only, see the reply_record migration. */
export async function getReplyRecord(ownerId: string): Promise<ReplyRecord> {
  const { data, error } = await supabase
    .rpc("get_owner_reply_record", { p_owner: ownerId })
    .single();
  if (error) throw error;
  return data as ReplyRecord;
}

export type WorkReference = {
  id: string;
  body: string;
  project_title: string;
  created_at: string;
  author: {
    id: string;
    full_name: string;
    current_title: string | null;
    avatar_url: string | null;
  } | null;
};

/** Written only from mutually confirmed completed collaborations (private.write_reference). */
export async function getReferences(userId: string): Promise<WorkReference[]> {
  const { data, error } = await supabase
    .from("work_references")
    .select(
      "id, body, project_title, created_at, author:profiles!work_references_author_id_fkey(id, full_name, current_title, avatar_url)",
    )
    .eq("subject_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  type Raw = Omit<WorkReference, "author"> & {
    author: WorkReference["author"] | WorkReference["author"][];
  };
  return ((data ?? []) as unknown as Raw[]).map((row) => ({
    ...row,
    author: Array.isArray(row.author) ? (row.author[0] ?? null) : row.author,
  }));
}

export async function confirmAvailability(): Promise<void> {
  const { error } = await supabase.rpc("confirm_availability");
  if (error) throw error;
}
