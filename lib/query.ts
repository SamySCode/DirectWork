import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

// Cost-conscious defaults (CLAUDE.md: query volume over freshness). Data is
// considered fresh for 30s, so tab-hopping doesn't refetch; it refreshes on
// app foreground and after any mutation that invalidates it. No Realtime.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
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
