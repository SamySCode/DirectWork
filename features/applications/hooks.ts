import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage, runAction } from "../../lib/functions";
import type { PreparedImage } from "../../lib/images";
import { useAuth } from "../auth/SessionProvider";
import {
  applyToListing,
  attachImages,
  getAttachmentUrls,
  getApplication,
  getContact,
  getIncomingPending,
  getListingApplications,
  getMyApplications,
  hasWrittenReference,
  type Application,
} from "./api";

export const applicationKeys = {
  all: ["applications"] as const,
  mine: (userId: string) => ["applications", "mine", userId] as const,
  incoming: (userId: string) => ["applications", "incoming", userId] as const,
  forListing: (projectId: string) => ["applications", "listing", projectId] as const,
  detail: (id: string) => ["applications", "detail", id] as const,
  contact: (id: string) => ["applications", "contact", id] as const,
  attachments: (paths: string[]) => ["applications", "attachments", paths] as const,
  reference: (membershipId: string, userId: string) =>
    ["applications", "reference", membershipId, userId] as const,
};

export function useMyApplications() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: applicationKeys.mine(userId ?? ""),
    queryFn: () => getMyApplications(userId!),
    enabled: !!userId,
  });
}

export function useIncomingPending() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: applicationKeys.incoming(userId ?? ""),
    queryFn: () => getIncomingPending(userId!),
    enabled: !!userId,
  });
}

export function useListingApplications(projectId: string | undefined) {
  return useQuery({
    queryKey: applicationKeys.forListing(projectId ?? ""),
    queryFn: () => getListingApplications(projectId!),
    enabled: !!projectId,
  });
}

const LIST_KEYS = new Set(["mine", "incoming", "listing"]);

/** This application from the freshest list that has it, with when that list was fetched. */
function findApplicationInLists(client: QueryClient, id: string) {
  let best: { application: Application; updatedAt: number } | undefined;
  const lists = client.getQueryCache().findAll({
    queryKey: applicationKeys.all,
    predicate: (query) => LIST_KEYS.has(String(query.queryKey[1])),
  });
  for (const query of lists) {
    const rows = query.state.data;
    if (!Array.isArray(rows)) continue;
    const application = (rows as Application[]).find((row) => row?.id === id);
    if (application && (!best || query.state.dataUpdatedAt > best.updatedAt)) {
      best = { application, updatedAt: query.state.dataUpdatedAt };
    }
  }
  return best;
}

/**
 * One application. The lists (your applications, a listing's applicants)
 * fetch the very same columns, so when one of them already holds this row
 * the screen starts from it: no placeholder, and no request at all if the
 * list is fresh. It carries the list's fetch time, so it goes stale and
 * refreshes on the usual schedule.
 */
export function useApplication(id: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: applicationKeys.detail(id ?? ""),
    queryFn: () => getApplication(id!),
    enabled: !!id,
    initialData: () => (id ? findApplicationInLists(queryClient, id)?.application : undefined),
    initialDataUpdatedAt: () =>
      id ? findApplicationInLists(queryClient, id)?.updatedAt : undefined,
  });
}

/** Only fetched once accepted - the RPC returns nothing before that anyway. */
export function useContact(applicationId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: applicationKeys.contact(applicationId ?? ""),
    queryFn: () => getContact(applicationId!),
    enabled: !!applicationId && enabled,
    staleTime: Infinity,
  });
}

function useInvalidateApplications() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: applicationKeys.all });
}

export function useApply() {
  const invalidate = useInvalidateApplications();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (vars: {
      projectId: string;
      coverNote: string;
      images: PreparedImage[];
    }): Promise<{ id: string; attachmentError: string | null }> => {
      const id = await applyToListing(vars.projectId, vars.coverNote);
      // The application exists from here on, so an attachment failure is a
      // warning on success - not an error the "You've applied" card hides.
      let attachmentError: string | null = null;
      if (vars.images.length > 0) {
        try {
          await attachImages(id, session!.user.id, vars.images);
        } catch (err) {
          attachmentError = errorMessage(err);
        }
      }
      return { id, attachmentError };
    },
    // Settled, not success: a partial attachment failure still created the application.
    onSettled: invalidate,
  });
}

export function useDecideApplication() {
  const invalidate = useInvalidateApplications();
  return useMutation({
    mutationFn: (vars: { applicationId: string; accept: boolean; note?: string }) =>
      runAction({ action: "decide_application", ...vars }),
    onSettled: invalidate,
  });
}

export function useWithdrawApplication() {
  const invalidate = useInvalidateApplications();
  return useMutation({
    mutationFn: (applicationId: string) =>
      runAction({ action: "withdraw_application", applicationId }),
    onSettled: invalidate,
  });
}

export function useRecordOutcome() {
  const invalidate = useInvalidateApplications();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      membershipId: string;
      outcome: "completed" | "abandoned";
      summary?: string;
    }) => runAction({ action: "record_outcome", ...vars }),
    onSettled: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

/** Signed URLs (1h) for private attachments - one batched request per set. */
export function useAttachmentUrls(paths: string[]) {
  return useQuery({
    queryKey: applicationKeys.attachments(paths),
    queryFn: () => getAttachmentUrls(paths),
    enabled: paths.length > 0,
    staleTime: 50 * 60_000,
    // Keep the URLs for as long as they're valid. With the default 5 minutes,
    // coming back to an application minted new URLs - and a new URL is a
    // cache miss, so every attachment downloaded again.
    gcTime: 55 * 60_000,
  });
}

export function useAskQuestion() {
  const invalidate = useInvalidateApplications();
  return useMutation({
    mutationFn: (vars: { applicationId: string; question: string }) =>
      runAction({ action: "ask_question", ...vars }),
    onSuccess: invalidate,
  });
}

export function useAnswerQuestion() {
  const invalidate = useInvalidateApplications();
  return useMutation({
    mutationFn: (vars: { questionId: string; answer: string }) =>
      runAction({ action: "answer_question", ...vars }),
    onSuccess: invalidate,
  });
}

export function useHasWrittenReference(membershipId: string, enabled: boolean) {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: applicationKeys.reference(membershipId, userId ?? ""),
    queryFn: () => hasWrittenReference(membershipId, userId!),
    enabled: enabled && !!userId,
  });
}

export function useWriteReference() {
  const invalidate = useInvalidateApplications();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { membershipId: string; body: string }) =>
      runAction({ action: "write_reference", ...vars }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
