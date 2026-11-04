import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/SessionProvider";
import {
  block,
  getBlockedIds,
  getBlockedPeople,
  getOpenReports,
  report,
  resolveReport,
  unblock,
  type ReportReason,
  type ReportTarget,
} from "./api";

export const safetyKeys = {
  all: ["safety"] as const,
  blockedIds: (userId: string) => ["safety", "blocked-ids", userId] as const,
  blockedPeople: (userId: string) => ["safety", "blocked-people", userId] as const,
  reports: ["safety", "reports"] as const,
};

export function useBlockedIds() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: safetyKeys.blockedIds(userId ?? ""),
    queryFn: getBlockedIds,
    enabled: !!userId,
    // Only changes when you block someone, which invalidates it.
    staleTime: Infinity,
  });
}

export function useBlockedPeople() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: safetyKeys.blockedPeople(userId ?? ""),
    queryFn: getBlockedPeople,
    enabled: !!userId,
  });
}

function useBlockMutation(fn: (userId: string) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: safetyKeys.all });
      // Discover hides blocked owners' listings.
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}

export const useBlock = () => useBlockMutation(block);
export const useUnblock = () => useBlockMutation(unblock);

export function useReport() {
  return useMutation({
    mutationFn: (vars: { target: ReportTarget; reason: ReportReason; details: string }) =>
      report(vars.target, vars.reason, vars.details),
  });
}

export function useOpenReports(enabled: boolean) {
  return useQuery({ queryKey: safetyKeys.reports, queryFn: getOpenReports, enabled });
}

export function useResolveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { reportId: string; takeAction: boolean; note?: string }) =>
      resolveReport(vars.reportId, vars.takeAction, vars.note),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: safetyKeys.reports });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}
