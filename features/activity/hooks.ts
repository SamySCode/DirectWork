import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/SessionProvider";
import { getActivity, getUnreadCount, markAllRead } from "./api";

export const activityKeys = {
  all: ["activity"] as const,
  list: (userId: string) => ["activity", "list", userId] as const,
  unread: (userId: string) => ["activity", "unread", userId] as const,
};

// No Realtime: the badge refreshes with the app's normal focus/stale cycle,
// which is plenty for things that need a reply within days, not seconds.
export function useUnreadCount() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: activityKeys.unread(userId ?? ""),
    queryFn: getUnreadCount,
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useActivity() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: activityKeys.list(userId ?? ""),
    queryFn: getActivity,
    enabled: !!userId,
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: markAllRead,
    // Only the badge: the open list keeps its unread dots until next visit.
    onSuccess: () => queryClient.setQueryData(activityKeys.unread(userId ?? ""), 0),
  });
}
