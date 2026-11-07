import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

/**
 * Whether a failed query is worth one automatic retry. Only failures that
 * can go away on their own are: the network, a gateway/5xx, a timeout.
 * A bad id, a permission refusal or a rule our SQL raised will fail the same
 * way again, so retrying just doubles the requests (e.g. every query on a
 * screen opened from a malformed link).
 */
export function isTransientError(error: unknown): boolean {
  if (!error || typeof error !== "object") return true;
  const { code, status } = error as { code?: unknown; status?: unknown };
  if (typeof status === "number" && status >= 400 && status < 500) return status === 408;
  if (typeof code !== "string" || code === "") return true;
  // PostgREST's own codes: PGRST0xx are connection problems and 301/303 an
  // expired token (supabase-js refreshes it); the rest are request errors.
  if (code.startsWith("PGRST")) {
    return code.startsWith("PGRST0") || code === "PGRST301" || code === "PGRST303";
  }
  // SQLSTATE classes: connection, transaction rollback (serialization,
  // deadlock), insufficient resources, operator intervention (incl.
  // statement timeout), system errors. Everything else is deterministic.
  return /^(08|40|53|57|58|XX)/.test(code);
}

// Cost-conscious defaults (CLAUDE.md: query volume over freshness). Data is
// considered fresh for 30s, so tab-hopping doesn't refetch; it refreshes on
// app foreground and after any mutation that invalidates it. No Realtime.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => failureCount < 1 && isTransientError(error),
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

// React Native has no window focus - map app foregrounding onto it so stale
// data refreshes when someone comes back to the app.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (status) => {
    focusManager.setFocused(status === "active");
  });
}
