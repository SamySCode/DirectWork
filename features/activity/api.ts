import { supabase } from "../../lib/supabase";

export type ActivityKind =
  | "application_received"
  | "application_accepted"
  | "application_declined"
  | "application_closed"
  | "listing_published"
  | "listing_changes_requested"
  | "outcome_to_confirm"
  | "outcome_confirmed"
  | "reference_received"
  | "question_asked"
  | "question_answered";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  created_at: string;
  read_at: string | null;
  project_id: string | null;
  application_id: string | null;
  actor: { id: string; full_name: string; avatar_url: string | null } | null;
  project: { id: string; title: string; owner_id: string } | null;
};

/** Enough for anyone's recent history; older items aren't worth the bytes. */
export const ACTIVITY_LIMIT = 50;

const SELECT = `
  id, kind, created_at, read_at, project_id, application_id,
  actor:profiles!activity_actor_id_fkey(id, full_name, avatar_url),
  project:projects(id, title, owner_id)
`;

type Raw = Omit<ActivityItem, "actor" | "project"> & {
  actor: ActivityItem["actor"] | ActivityItem["actor"][];
  project: ActivityItem["project"] | ActivityItem["project"][];
};

const one = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

export async function getActivity(): Promise<ActivityItem[]> {
  const { data, error } = await supabase
    .from("activity")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(ACTIVITY_LIMIT);
  if (error) throw error;
  return ((data ?? []) as unknown as Raw[]).map((row) => ({
    ...row,
    actor: one(row.actor),
    project: one(row.project),
  }));
}

/** A head-only count: no rows are transferred. */
export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from("activity")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markAllRead(): Promise<void> {
  const { error } = await supabase
    .from("activity")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
}
