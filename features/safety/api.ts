import { runAction } from "../../lib/functions";
import { supabase } from "../../lib/supabase";

export const reportReasons = {
  scam: "Scam or asks for money",
  spam: "Spam",
  misleading: "Misleading or fake",
  inappropriate: "Inappropriate content",
  harassment: "Harassment",
  other: "Something else",
} as const;

export type ReportReason = keyof typeof reportReasons;

export type ReportTarget = { kind: "profile" | "listing"; id: string };

export async function report(target: ReportTarget, reason: ReportReason, details: string) {
  const { error } = await supabase.from("reports").insert({
    profile_id: target.kind === "profile" ? target.id : null,
    project_id: target.kind === "listing" ? target.id : null,
    reason,
    details: details.trim() || null,
  });
  if (error) {
    // The partial unique index: one open report per person per target.
    if (error.code === "23505") throw new Error("You've already reported this - we're on it.");
    throw error;
  }
}

/** Ids of people I've blocked - small, so it's fetched whole. */
export async function getBlockedIds(): Promise<string[]> {
  const { data, error } = await supabase.from("blocks").select("blocked_id");
  if (error) throw error;
  return (data ?? []).map((row) => row.blocked_id);
}

export type BlockedPerson = { id: string; full_name: string; headline: string };

export async function getBlockedPeople(): Promise<BlockedPerson[]> {
  const { data, error } = await supabase
    .from("blocks")
    .select("blocked:profiles!blocks_blocked_id_fkey(id, full_name, headline)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Raw = { blocked: BlockedPerson | BlockedPerson[] | null };
  return ((data ?? []) as unknown as Raw[]).flatMap((row) =>
    Array.isArray(row.blocked) ? row.blocked : row.blocked ? [row.blocked] : [],
  );
}

export async function block(userId: string) {
  const { error } = await supabase.from("blocks").insert({ blocked_id: userId });
  // Already blocked is fine.
  if (error && error.code !== "23505") throw error;
}

export async function unblock(userId: string) {
  const { error } = await supabase.from("blocks").delete().eq("blocked_id", userId);
  if (error) throw error;
}

export type OpenReport = {
  id: string;
  reason: ReportReason;
  details: string | null;
  created_at: string;
  profile: { id: string; full_name: string; headline: string } | null;
  project: { id: string; title: string; status: string } | null;
};

/** Admin queue, oldest first. RLS only returns rows to admins (or the reporter). */
export async function getOpenReports(): Promise<OpenReport[]> {
  const { data, error } = await supabase
    .from("reports")
    .select(
      `id, reason, details, created_at,
       profile:profiles!reports_profile_id_fkey(id, full_name, headline),
       project:projects(id, title, status)`,
    )
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw error;
  type Raw = Omit<OpenReport, "profile" | "project"> & {
    profile: OpenReport["profile"] | OpenReport["profile"][];
    project: OpenReport["project"] | OpenReport["project"][];
  };
  const one = <T>(value: T | T[] | null): T | null =>
    Array.isArray(value) ? (value[0] ?? null) : value;
  return ((data ?? []) as unknown as Raw[]).map((row) => ({
    ...row,
    profile: one(row.profile),
    project: one(row.project),
  }));
}

export function resolveReport(reportId: string, takeAction: boolean, note?: string) {
  return runAction({ action: "resolve_report", reportId, takeAction, note });
}
