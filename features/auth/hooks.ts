import type { Session } from "@supabase/supabase-js";
import { useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { queryClient } from "../../lib/query";
import { supabase } from "../../lib/supabase";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let userId: string | undefined;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        userId = data.session?.user.id;
        setSession(data.session);
      })
      // Unreadable stored session (e.g. keystore reset): treat as signed out
      // rather than hanging on the splash screen.
      .catch(() => setSession(null))
      .finally(() => setLoading(false));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const nextId = newSession?.user.id;
      // Another account (or nobody) on this device: drop everything cached
      // for the previous one - several query keys aren't user-scoped.
      if (nextId !== userId) queryClient.clear();
      userId = nextId;
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

// Routes reachable regardless of auth/profile state.
const OPEN_ROUTES = new Set(["update-password"]);

/**
 * Keeps people on the right step of the journey:
 * signed out -> welcome, signed in without a profile -> onboarding,
 * fully set up -> the app (never back to auth/onboarding screens).
 */
export function useProtectedRoute(
  session: Session | null,
  loading: boolean,
  hasProfile: boolean | undefined,
) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const first = segments[0] ?? "";
    if (OPEN_ROUTES.has(first)) return;

    const inAuthGroup = first === "(auth)";
    const inOnboarding = first === "onboarding";

    if (!session) {
      if (!inAuthGroup) router.replace("/welcome");
      return;
    }
    if (hasProfile === undefined) return; // profile still loading
    if (!hasProfile) {
      if (!inOnboarding) router.replace("/onboarding");
    } else if (inAuthGroup || inOnboarding) {
      router.replace("/home");
    }
  }, [session, loading, hasProfile, segments, router]);
}
