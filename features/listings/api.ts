import { PreparedImage, publicImageUrl, removeImages, uploadImage } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { ensureSkillIds, escapeLikePattern } from "../profile/api";
import type { ListingInput } from "./schemas";

export type ListingStatus =
  "draft" | "in_review" | "changes_requested" | "published" | "paused" | "completed" | "abandoned";

export type Admission = {
  what_exists_already: string;
  weekly_commitment_hours: number;
  first_milestone: string;
  proposed_terms: string;
  owner_contribution: string;
};

export type Listing = {
  id: string;
  owner_id: string;
  title: string;
  public_summary: string;
  opportunity_type: "paid" | "partner";
  status: ListingStatus;
  location: string | null;
  remote_pref: "remote" | "hybrid" | "onsite" | "flexible" | null;
  commitment: "few_hours" | "part_time" | "full_time" | null;
  duration: string | null;
  compensation_type: "fixed" | "hourly" | "daily" | null;
  compensation_min: number | null;
  compensation_max: number | null;
  currency: "GBP" | "EUR" | "USD";
  review_note: string | null;
  is_featured: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ListingImage = { id: string; storage_path: string; position: number; url: string };

export type ListingDetail = Listing & {
  owner: { id: string; full_name: string; headline: string; avatar_url: string | null } | null;
  images: ListingImage[];
  skills: string[];
  admission: Admission | null;
};

// Explicit columns rather than * - keeps payloads small and stops new
// columns (e.g. future internal fields) leaking into the client by default.
const LISTING_COLUMNS = `
  id, owner_id, title, public_summary, opportunity_type, status, location, remote_pref,
  commitment, duration, compensation_type, compensation_min, compensation_max, currency,
  review_note, is_featured, published_at, created_at, updated_at
`;

const DETAIL_SELECT = `
  ${LISTING_COLUMNS},
  owner:profiles!projects_owner_id_fkey(id, full_name, headline, avatar_url),
  project_required_skills(skills(name)),
  project_admission(what_exists_already, weekly_commitment_hours, first_milestone, proposed_terms, owner_contribution),
  listing_images(id, storage_path, position)
`;

// Lists (Discover, My listings, review queue) don't render admission
// criteria, and only need the cover image - see withCoverImageOnly().
const LIST_SELECT = `
  ${LISTING_COLUMNS},
  owner:profiles!projects_owner_id_fkey(id, full_name, headline, avatar_url),
  project_required_skills(skills(name)),
  listing_images(id, storage_path, position)
`;

type RawDetail = Listing & {
  owner: ListingDetail["owner"] | ListingDetail["owner"][];
  project_required_skills: { skills: { name: string } | { name: string }[] | null }[];
  project_admission?: Admission | Admission[] | null;
  listing_images?: Omit<ListingImage, "url">[] | null;
};

const one = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

function toDetail(raw: RawDetail): ListingDetail {
  const { project_required_skills, project_admission, owner, listing_images, ...listing } = raw;
  return {
    ...listing,
    owner: one(owner),
    admission: one(project_admission),
    images: [...(listing_images ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((image) => ({ ...image, url: publicImageUrl("listing-images", image.storage_path) })),
    skills: (project_required_skills ?? []).flatMap((row) => {
      if (!row.skills) return [];
      return Array.isArray(row.skills) ? row.skills.map((s) => s.name) : [row.skills.name];
    }),
  };
}

export const DISCOVER_PAGE_SIZE = 20;

export type DiscoverSort = "newest" | "pay" | "match";

export type DiscoverFilters = {
  query: string;
  type?: "paid" | "partner";
  remoteOnly: boolean;
  commitment?: "few_hours" | "part_time" | "full_time";
  compensationType?: "fixed" | "hourly" | "daily";
  /** Whole currency units; matches if either end of the listing's range reaches it. */
  minPay?: number;
  /** "match" is applied client-side (needs the viewer's skills) - the server sees "newest". */
  sort?: DiscoverSort;
  /** Owners the viewer has blocked. */
  excludeOwners?: string[];
};

export async function discoverListings(
  filters: DiscoverFilters,
  page: number,
): Promise<ListingDetail[]> {
  let request = supabase
    .from("projects")
    .select(LIST_SELECT)
    .eq("status", "published")
    .order("position", { referencedTable: "listing_images" })
    .limit(1, { referencedTable: "listing_images" });

  // Featured first only in the default order; an explicit sort is respected as asked.
  if (filters.sort === "pay") {
    request = request
      .order("compensation_max", { ascending: false, nullsFirst: false })
      .order("compensation_min", { ascending: false, nullsFirst: false });
  } else {
    request = request.order("is_featured", { ascending: false });
  }
  request = request
    .order("published_at", { ascending: false })
    .range(page * DISCOVER_PAGE_SIZE, (page + 1) * DISCOVER_PAGE_SIZE - 1);

  // PostgREST's or() syntax uses commas/parens as separators and double
  // quotes for quoting, and treats * as a LIKE wildcard - strip them so a search term can't inject extra
  // filter clauses. LIKE wildcards are escaped separately.
  const term = filters.query
    .replace(/[,()"*]/g, " ")
    .trim()
    .slice(0, 100);
  if (term) {
    const pattern = `%${escapeLikePattern(term)}%`;
    request = request.or(`title.ilike.${pattern},public_summary.ilike.${pattern}`);
  }
  if (filters.type) request = request.eq("opportunity_type", filters.type);
  if (filters.remoteOnly) request = request.in("remote_pref", ["remote", "flexible"]);
  // Ids come from our own blocks table (uuids), so they're safe to inline.
  if (filters.excludeOwners?.length) {
    request = request.not("owner_id", "in", `(${filters.excludeOwners.join(",")})`);
  }
  if (filters.commitment) request = request.eq("commitment", filters.commitment);
  if (filters.compensationType) request = request.eq("compensation_type", filters.compensationType);
  if (filters.minPay && Number.isInteger(filters.minPay) && filters.minPay > 0) {
    // Either end of the range reaching the minimum counts ("from £450" with
    // no max still matches £400+). A second or= is ANDed with the search one.
    const n = filters.minPay;
    request = request.or(
      `compensation_max.gte.${n},and(compensation_max.is.null,compensation_min.gte.${n})`,
    );
  }

  const { data, error } = await request;
  if (error) throw error;
  return ((data ?? []) as unknown as RawDetail[]).map(toDetail);
}

export async function getListing(id: string): Promise<ListingDetail | null> {
  const { data, error } = await supabase
    .from("projects")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toDetail(data as unknown as RawDetail) : null;
}

export async function getMyListings(userId: string): Promise<ListingDetail[]> {
  const { data, error } = await supabase
    .from("projects")
    .select(LIST_SELECT)
    .eq("owner_id", userId)
    .order("position", { referencedTable: "listing_images" })
    .limit(1, { referencedTable: "listing_images" })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as RawDetail[]).map(toDetail);
}

export async function getReviewQueue(): Promise<ListingDetail[]> {
  const { data, error } = await supabase
    .from("projects")
    .select(DETAIL_SELECT)
    .eq("status", "in_review")
    .order("updated_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as RawDetail[]).map(toDetail);
}

export type ListingQuota = { live: number; max_live: number };

export async function getListingQuota(): Promise<ListingQuota> {
  const { data, error } = await supabase.rpc("get_listing_quota").single();
  if (error) throw error;
  return data as ListingQuota;
}

function toRow(input: ListingInput) {
  const paid = input.opportunityType === "paid";
  return {
    title: input.title,
    public_summary: input.publicSummary,
    opportunity_type: input.opportunityType,
    location: input.location ?? null,
    remote_pref: input.remotePref ?? null,
    commitment: input.commitment ?? null,
    duration: input.duration ?? null,
    compensation_type: paid ? (input.compensationType ?? null) : null,
    compensation_min: paid ? (input.compensationMin ?? null) : null,
    compensation_max: paid ? (input.compensationMax ?? null) : null,
    currency: input.currency,
  };
}

async function syncChildren(projectId: string, input: ListingInput) {
  const skillIds = await ensureSkillIds(input.skills);
  const { error: deleteError } = await supabase
    .from("project_required_skills")
    .delete()
    .eq("project_id", projectId);
  if (deleteError) throw deleteError;
  const { error: insertError } = await supabase
    .from("project_required_skills")
    .insert(skillIds.map((skillId) => ({ project_id: projectId, skill_id: skillId })));
  if (insertError) throw insertError;

  if (input.opportunityType === "partner" && input.admission) {
    const { error } = await supabase.from("project_admission").upsert({
      project_id: projectId,
      what_exists_already: input.admission.whatExistsAlready,
      weekly_commitment_hours: input.admission.weeklyCommitmentHours,
      first_milestone: input.admission.firstMilestone,
      proposed_terms: input.admission.proposedTerms,
      owner_contribution: input.admission.ownerContribution,
    });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("project_admission").delete().eq("project_id", projectId);
    if (error) throw error;
  }
}

export async function createListing(input: ListingInput): Promise<string> {
  const { data, error } = await supabase
    .from("projects")
    .insert(toRow(input))
    .select("id")
    .single();
  if (error) throw error;
  await syncChildren(data.id, input);
  return data.id;
}

export async function updateListing(id: string, input: ListingInput): Promise<void> {
  const { data, error } = await supabase
    .from("projects")
    .update(toRow(input))
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data?.length) {
    throw new Error("This listing can't be edited right now. Move it back to draft first.");
  }
  await syncChildren(id, input);
}

export async function deleteDraft(id: string): Promise<void> {
  // Files first: once the row is gone, the cascade drops the image rows and
  // the storage objects would be orphaned.
  const { data: images } = await supabase
    .from("listing_images")
    .select("storage_path")
    .eq("project_id", id);
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
  await removeImages(
    "listing-images",
    (images ?? []).map((image) => image.storage_path),
  ).catch(() => {});
}

/** Local edit state for a listing's images: kept existing rows + newly picked files. */
export type ImageDraft = { keep: ListingImage[]; added: PreparedImage[] };

/**
 * Applies the image edits after the listing row is saved (new listings have
 * no id, so no folder, until then). Removals first so the 4-image cap
 * counts the final set.
 */
export async function syncListingImages(
  projectId: string,
  ownerId: string,
  draft: ImageDraft,
): Promise<void> {
  const { data: current, error } = await supabase
    .from("listing_images")
    .select("id, storage_path")
    .eq("project_id", projectId);
  if (error) throw error;
  const keepIds = new Set(draft.keep.map((image) => image.id));
  const removed = (current ?? []).filter((image) => !keepIds.has(image.id));
  if (removed.length > 0) {
    const { error: deleteError } = await supabase
      .from("listing_images")
      .delete()
      .in(
        "id",
        removed.map((image) => image.id),
      );
    if (deleteError) throw deleteError;
    await removeImages(
      "listing-images",
      removed.map((image) => image.storage_path),
    ).catch(() => {});
  }
  for (const [index, image] of draft.added.entries()) {
    const path = await uploadImage("listing-images", `${ownerId}/${projectId}`, image);
    const { error: insertError } = await supabase.from("listing_images").insert({
      project_id: projectId,
      storage_path: path,
      position: draft.keep.length + index,
    });
    if (insertError) {
      await removeImages("listing-images", [path]).catch(() => {});
      throw insertError;
    }
  }
}
