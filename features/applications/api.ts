import { PreparedImage, removeImages, signedImageUrls, uploadImage } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import type { ListingStatus } from "../listings/api";

export type ApplicationStatus = "submitted" | "accepted" | "rejected" | "withdrawn";

export type Outcome = {
  outcome: "completed" | "abandoned";
  summary: string | null;
  confirmed_by_owner_at: string | null;
  confirmed_by_member_at: string | null;
};

export type Membership = {
  id: string;
  role: "partner" | "contractor";
  left_at: string | null;
  outcome: Outcome | null;
};

export type Application = {
  id: string;
  project_id: string;
  applicant_id: string;
  application_type: "paid" | "partner";
  status: ApplicationStatus;
  cover_note: string;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
  project: { id: string; title: string; status: ListingStatus; owner_id: string } | null;
  applicant: { id: string; full_name: string; headline: string; avatar_url: string | null } | null;
  membership: Membership | null;
  attachments: { id: string; storage_path: string }[];
  questions: ApplicationQuestion[];
};

const SELECT = `
  id, project_id, applicant_id, application_type, status, cover_note, decision_note, decided_at, created_at,
  project:projects(id, title, status, owner_id),
  applicant:profiles!applications_applicant_id_fkey(id, full_name, headline, avatar_url),
  project_memberships(id, role, left_at, project_outcomes(outcome, summary, confirmed_by_owner_at, confirmed_by_member_at)),
  application_attachments(id, storage_path),
  application_questions(id, question, answer, asked_at, answered_at)
`;

type RawMembership = Omit<Membership, "outcome"> & { project_outcomes: Outcome | Outcome[] | null };
type Raw = Omit<
  Application,
  "membership" | "project" | "applicant" | "attachments" | "questions"
> & {
  application_attachments?: Application["attachments"] | null;
  application_questions?: ApplicationQuestion[] | null;
  project: Application["project"] | Application["project"][];
  applicant: Application["applicant"] | Application["applicant"][];
  project_memberships: RawMembership | RawMembership[] | null;
};

const one = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

function toApplication(raw: Raw): Application {
  const {
    project_memberships,
    project,
    applicant,
    application_attachments,
    application_questions,
    ...rest
  } = raw;
  const membership = one(project_memberships);
  return {
    ...rest,
    project: one(project),
    applicant: one(applicant),
    attachments: application_attachments ?? [],
    questions: [...(application_questions ?? [])].sort((a, b) =>
      a.asked_at.localeCompare(b.asked_at),
    ),
    membership: membership
      ? {
          id: membership.id,
          role: membership.role,
          left_at: membership.left_at,
          outcome: one(membership.project_outcomes),
        }
      : null,
  };
}

export async function applyToListing(projectId: string, coverNote: string): Promise<string> {
  const { data, error } = await supabase
    .from("applications")
    .insert({ project_id: projectId, cover_note: coverNote })
    .select("id")
    .single();
  if (error) {
    // 23505 = the partial unique index: already a live application here.
    if (error.code === "23505") throw new Error("You've already applied to this listing.");
    if (error.code === "P0001") throw new Error(error.message);
    throw error;
  }
  return data.id;
}

export async function getMyApplications(userId: string): Promise<Application[]> {
  const { data, error } = await supabase
    .from("applications")
    .select(SELECT)
    .eq("applicant_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Raw[]).map(toApplication);
}

export async function getListingApplications(projectId: string): Promise<Application[]> {
  const { data, error } = await supabase
    .from("applications")
    .select(SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Raw[]).map(toApplication);
}

/** Applications on any of the owner's listings still waiting for a decision. */
export async function getIncomingPending(ownerId: string): Promise<Application[]> {
  const { data, error } = await supabase
    .from("applications")
    .select(`${SELECT}, owned:projects!inner(owner_id)`)
    .eq("owned.owner_id", ownerId)
    .eq("status", "submitted")
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) throw error;
  return ((data ?? []) as unknown as Raw[]).map(toApplication);
}

export async function getApplication(id: string): Promise<Application | null> {
  const { data, error } = await supabase
    .from("applications")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toApplication(data as unknown as Raw) : null;
}

export type Contact = { full_name: string; email: string };

export async function getContact(applicationId: string): Promise<Contact | null> {
  const { data, error } = await supabase
    .rpc("get_application_contact", { p_application: applicationId })
    .maybeSingle();
  if (error) throw error;
  return (data as Contact | null) ?? null;
}

/**
 * Uploads work samples after the application exists (the attachment rows
 * reference it). If an upload fails the application still stands - the
 * error says how many images didn't make it.
 */
export async function attachImages(
  applicationId: string,
  applicantId: string,
  images: PreparedImage[],
): Promise<void> {
  let failed = 0;
  for (const image of images) {
    let path: string | null = null;
    try {
      path = await uploadImage("application-attachments", applicantId, image);
      const { error } = await supabase
        .from("application_attachments")
        .insert({ application_id: applicationId, storage_path: path });
      if (error) throw error;
    } catch {
      failed += 1;
      if (path) await removeImages("application-attachments", [path]).catch(() => {});
    }
  }
  if (failed > 0) {
    throw new Error(
      `Application sent, but ${failed} of ${images.length} images couldn't be attached.`,
    );
  }
}

export const getAttachmentUrls = signedImageUrls;

export type ApplicationQuestion = {
  id: string;
  question: string;
  answer: string | null;
  asked_at: string;
  answered_at: string | null;
};

/** Owner questions are capped server-side (private.ask_question). */
export const MAX_QUESTIONS = 3;

/** Whether `authorId` has already written their reference for this collaboration. */
export async function hasWrittenReference(
  membershipId: string,
  authorId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("work_references")
    .select("id", { count: "exact", head: true })
    .eq("membership_id", membershipId)
    .eq("author_id", authorId);
  if (error) throw error;
  return (count ?? 0) > 0;
}
