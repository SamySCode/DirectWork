import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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
  syncListingImages,
  updateListing,
} from "./api";
import type { ListingInput } from "./schemas";

export const listingKeys = {
  all: ["listings"] as const,
  discover: (filters: DiscoverFilters) => ["listings", "discover", filters] as const,
  detail: (id: string) => ["listings", "detail", id] as const,
  mine: (userId: string) => ["listings", "mine", userId] as const,
  reviewQueue: ["listings", "review-queue"] as const,
  quota: ["listings", "quota"] as const,
};

export function useDiscover(filters: DiscoverFilters) {
  return useInfiniteQuery({
    queryKey: listingKeys.discover(filters),
    queryFn: ({ pageParam }) => discoverListings(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === DISCOVER_PAGE_SIZE ? pages.length : undefined,
    // Keep showing the last results while a new filter loads.
    placeholderData: keepPreviousData,
  });
}

export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: listingKeys.detail(id ?? ""),
    queryFn: () => getListing(id!),
    enabled: !!id,
  });
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
  return useMutation({
    mutationFn: async ({ input, images }: { input: ListingInput; images: ImageDraft }) => {
      let projectId = id;
      if (projectId) {
        await updateListing(projectId, input);
      } else {
        projectId = await createListing(input);
      }
      await syncListingImages(projectId, session!.user.id, images);
      return projectId;
    },
    onSuccess: invalidate,
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
    onSuccess: () => {
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
  return useMutation({ mutationFn: deleteDraft, onSuccess: invalidate });
}
