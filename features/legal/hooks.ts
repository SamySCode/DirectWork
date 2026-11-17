import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { exportMyData, getMyLegalStatus, recordLegalAcceptance, saveExport } from "./api";
import { needsLegalAcceptance } from "./versions";

export const legalKeys = {
  status: (userId: string) => ["legal", "status", userId] as const,
};

/**
 * Has this person accepted the current Terms and Privacy Notice? Fetched
 * once per sign-in: staleTime Infinity means no refetch on focus or
 * re-render, and the session listener clears the cache whenever the
 * signed-in account changes, so each sign-in asks again.
 */
export function useLegalStatus(userId: string | undefined) {
  return useQuery({
    queryKey: legalKeys.status(userId ?? ""),
    queryFn: getMyLegalStatus,
    enabled: !!userId,
    staleTime: Infinity,
    select: needsLegalAcceptance,
  });
}

export function useAcceptLegal(userId: string | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: recordLegalAcceptance,
    onSuccess: () => client.invalidateQueries({ queryKey: legalKeys.status(userId ?? "") }),
  });
}

export function useExportMyData() {
  return useMutation({
    mutationFn: async () => saveExport(await exportMyData()),
  });
}
