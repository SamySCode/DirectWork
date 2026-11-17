import {
  type InfiniteData,
  keepPreviousData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRef } from "react";
import { runAction } from "../../lib/functions";
import { useAuth } from "../auth/SessionProvider";
import {
  createListing,
  deleteDraft,
  DISCOVER_PAGE_SIZE,
  DiscoverFilters,
  discoverListings,
  getListing,
  getListingQuota,
  getMyListings,
  getReviewQueue,
  ImageDraft,
  type ListingDetail,
  syncListingImages,
  updateListing,
} from "./api";
import type { ListingInput } from "./schemas";

/**
 * The part of the filters that changes what the server returns. Home and
 * Discover both show the default first page; without this they cached (and
 * fetched) it twice, because Discover spells the same request with
 * `sort: "newest"` and Home leaves it out.
 */
export function discoverKeyFilters(filters: DiscoverFilters): DiscoverFilters {
  const { sort, excludeOwners, query, ...rest } = filters;
  return {
    ...rest,
    query: query.trim(),
    ...(sort === "pay" ? { sort } : {}),
    ...(excludeOwners?.length ? { excludeOwners: [...excludeOwners].sort() } : {}),
  };
}

export const listingKeys = {
  all: ["listings"] as const,
  discover: (filters: DiscoverFilters) =>
    ["listings", "discover", discoverKeyFilters(filters)] as const,
  detail: (id: string) => ["listings", "detail", id] as const,
  mine: (userId: string) => ["listings", "mine", userId] as const,
  reviewQueue: ["listings", "review-queue"] as const,
  quota: ["listings", "quota"] as const,
};

/** Pages of Discover results kept in memory (and refetched) at once. */
export const DISCOVER_MAX_PAGES = 5;

export function useDiscover(filters: DiscoverFilters) {
  return useInfiniteQuery({
    queryKey: listingKeys.discover(filters),
    queryFn: ({ pageParam }) => discoverListings(filters, pageParam),
    initialPageParam: 0,
    // Page params are page numbers. Count from the param, not pages.length:
    // with maxPages the stored pages no longer start at page 0.
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.length === DISCOVER_PAGE_SIZE ? lastPageParam + 1 : undefined,
    getPreviousPageParam: (_firstPage, _pages, firstPageParam) =>
      firstPageParam > 0 ? firstPageParam - 1 : undefined,
    // Keep at most DISCOVER_MAX_PAGES in the cache, so a refetch on returning
    // to the app (or pull-to-refresh) costs at most that many requests.
    // Scrolling on drops the oldest page off the top; the screen fetches it
    // back with fetchPreviousPage when the user scrolls up to it.
    maxPages: DISCOVER_MAX_PAGES,
    // Keep showing the last results while a new filter loads.
    placeholderData: keepPreviousData,
  });
}

const LIST_KEYS = new Set(["discover", "mine", "review-queue"]);

/** The row for this listing from any list already in the cache (Discover, My listings). */
function findListingInLists(client: QueryClient, id: string): ListingDetail | undefined {
  const lists = client.getQueriesData<InfiniteData<ListingDetail[]> | ListingDetail[]>({
    queryKey: listingKeys.all,
    predicate: (query) => LIST_KEYS.has(String(query.queryKey[1])),
  });
  for (const [, data] of lists) {
    const rows = Array.isArray(data) ? data : (data?.pages.flat() ?? []);
    const hit = rows.find((row) => row?.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * One listing. With `instant`, the screen opens at once using the row a
 * list already holds (the card that was just tapped), while the full
 * listing loads behind it: `isPlaceholderData` is true until it arrives.
 *
 * That row is only part of a listing: no admission criteria and only the
 * cover image. So `instant` is for showing a listing, never for anything
 * that edits it or copies from it (the edit form, the Deal Sheet prefill),
 * which would save the gaps back as if they were real.
 */
export function useListing(id: string | undefined, { instant = false } = {}) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: listingKeys.detail(id ?? ""),
    queryFn: () => getListing(id!),
    enabled: !!id,
    placeholderData: instant && id ? () => findListingInLists(queryClient, id) : undefined,
  });
}

/**
 * A listing's title if it is already in the cache, kept up to date as it
 * loads. Never fetches: the listing screen owns the request, this only
 * listens (it names the browser tab).
 */
export function useListingTitle(id: string | undefined): string | undefined {
  const { data } = useQuery({
    queryKey: listingKeys.detail(id ?? ""),
    queryFn: () => getListing(id!),
    enabled: false,
  });
  return id ? (data?.title ?? undefined) : undefined;
}

export function useMyListings() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: listingKeys.mine(userId ?? ""),
    queryFn: () => getMyListings(userId!),
    enabled: !!userId,
  });
}

export function useReviewQueue(enabled: boolean) {
  return useQuery({ queryKey: listingKeys.reviewQueue, queryFn: getReviewQueue, enabled });
}

export function useListingQuota() {
  return useQuery({ queryKey: listingKeys.quota, queryFn: getListingQuota });
}

/** Any listing change can affect discover, detail, my listings and quota - refresh them together. */
function useInvalidateListings() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: listingKeys.all });
}

export function useSaveListing(id?: string) {
  const invalidate = useInvalidateListings();
  const { session } = useAuth();
  // Set once the first attempt has inserted the row: if skills or images
  // failed after that, the retry updates this draft rather than adding a twin.
  const createdId = useRef<string | undefined>(undefined);
  return useMutation({
    mutationFn: async ({ input, images }: { input: ListingInput; images: ImageDraft }) => {
      let projectId = id ?? createdId.current;
      if (projectId) {
        await updateListing(projectId, input);
      } else {
        projectId = await createListing(input, (newId) => {
          createdId.current = newId;
        });
      }
      await syncListingImages(projectId, session!.user.id, images);
      return projectId;
    },
    // Settled: a half-finished create still left a draft in My listings.
    onSettled: invalidate,
  });
}

export function useSubmitListing() {
  const invalidate = useInvalidateListings();
  return useMutation({
    mutationFn: (projectId: string) => runAction({ action: "submit_listing", projectId }),
    onSettled: invalidate,
  });
}

export function useSetListingStatus() {
  const invalidate = useInvalidateListings();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      projectId: string;
      status: "draft" | "published" | "paused" | "completed" | "abandoned";
    }) => runAction({ action: "set_listing_status", ...vars }),
    // Settled: a refusal usually means the state moved on elsewhere - redraw it.
    onSettled: () => {
      invalidate();
      // Closing a listing auto-rejects pending applicants.
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}

export function useReviewListing() {
  const invalidate = useInvalidateListings();
  return useMutation({
    mutationFn: (vars: { projectId: string; approve: boolean; note?: string }) =>
      runAction({ action: "review_listing", ...vars }),
    onSuccess: invalidate,
  });
}

export function useDeleteDraft() {
  const invalidate = useInvalidateListings();
  return useMutation({ mutationFn: deleteDraft, onSettled: invalidate });
}
