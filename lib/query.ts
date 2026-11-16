import { focusManager, onlineManager, QueryCache, QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import { env } from "./env";

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

/** The request never got an answer: no connection, or the server is unreachable. */
export function isNetworkError(error: unknown): boolean {
  const message =
    error &&
    typeof error === "object" &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  return /network request failed|failed to fetch|fetch failed|load failed|networkerror/i.test(
    message,
  );
}

// ---------------------------------------------------------------------------
// Connectivity. TanStack Query pauses queries while onlineManager says we're
// offline (cached data stays on screen, nothing errors or retries) and
// refetches when it flips back. On web the browser's online/offline events
// drive it. React Native has no such events without the NetInfo native
// module, so we infer it: a request that never got an answer means "offline",
// and a cheap probe with backoff - plus one on every return to the app -
// decides when we're back. This also covers Supabase itself being
// unreachable, which NetInfo would not.
// ---------------------------------------------------------------------------
const PROBE_DELAYS_MS = [5_000, 10_000, 20_000, 40_000, 60_000];
let probeTimer: ReturnType<typeof setTimeout> | undefined;
let probeAttempt = 0;

function scheduleProbe() {
  if (probeTimer) clearTimeout(probeTimer);
  const delay = PROBE_DELAYS_MS[Math.min(probeAttempt, PROBE_DELAYS_MS.length - 1)];
  probeTimer = setTimeout(() => void checkConnection(), delay);
  // Never keep a Node process (tests) alive for a probe.
  (probeTimer as { unref?: () => void }).unref?.();
}

/** Any HTTP answer at all - even a 401 - means the backend is reachable. */
async function reachable(): Promise<boolean> {
  try {
    await fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/health`, { method: "HEAD" });
    return true;
  } catch {
    return false;
  }
}

/** Called for every failed query; a network failure switches to offline mode. */
export function reportFailure(error: unknown) {
  if (!isNetworkError(error) || !onlineManager.isOnline()) return;
  onlineManager.setOnline(false);
  probeAttempt = 0;
  scheduleProbe();
}

/** Probes now (the offline banner's "Try now", and returning to the app). */
export async function checkConnection(): Promise<boolean> {
  if (onlineManager.isOnline()) return true;
  if (probeTimer) clearTimeout(probeTimer);
  if (await reachable()) {
    probeTimer = undefined;
    // Resumes paused queries and refetches stale ones on screen.
    onlineManager.setOnline(true);
    return true;
  }
  probeAttempt += 1;
  scheduleProbe();
  return false;
}

/** False while requests are paused because the backend can't be reached. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
}

// Cost-conscious defaults (CLAUDE.md: query volume over freshness). Data is
// considered fresh for 30s, so tab-hopping doesn't refetch; it refreshes on
// app foreground and after any mutation that invalidates it. No Realtime.
export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: reportFailure }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => failureCount < 1 && isTransientError(error),
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
      // A save attempted while offline fails straight away with a clear
      // message (the form keeps what was typed) rather than hanging until
      // the connection returns and then firing unexpectedly.
      networkMode: "always",
    },
  },
});

// React Native has no window focus - map app foregrounding onto it so stale
// data refreshes when someone comes back to the app.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (status) => {
    if (status === "active") void checkConnection();
    focusManager.setFocused(status === "active");
  });
}
