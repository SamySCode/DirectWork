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

// Routes reachable regardless of auth/profile state: password reset, the
// legal documents (signed out, during onboarding - and Google Play links the
// public account-deletion page) and Help & legal.
const OPEN_ROUTES = new Set(["update-password", "legal", "help"]);

/**
 * Keeps people on the right step of the journey:
 * signed out -> welcome, signed in with outdated Terms/Privacy acceptance ->
 * the re-acceptance screen, signed in without a profile -> onboarding,
 * fully set up -> the app (never back to auth/onboarding screens).
 *
 * `needsAcceptance` is undefined while unknown (or if the check failed -
 * we don't lock people out over a network error); only `true` gates.
 */
export function useProtectedRoute(
  session: Session | null,
  loading: boolean,
  hasProfile: boolean | undefined,
  needsAcceptance?: boolean,
) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const first = segments[0] ?? "";
    const onAcceptScreen = first === "legal" && segments[1] === "accept";

    if (onAcceptScreen) {
      if (!session) router.replace("/welcome");
      else if (needsAcceptance === false || needsAcceptance === undefined) {
        if (hasProfile !== undefined) router.replace(hasProfile ? "/home" : "/onboarding");
      }
      return;
    }
    // Documents stay readable while the gate is up (the accept screen links to them).
    if (OPEN_ROUTES.has(first)) return;

    const inAuthGroup = first === "(auth)";
    const inOnboarding = first === "onboarding";

    if (!session) {
      if (!inAuthGroup) router.replace("/welcome");
      return;
    }
    if (needsAcceptance) {
      router.replace("/legal/accept");
      return;
    }
    if (hasProfile === undefined) return; // profile still loading
    if (!hasProfile) {
      if (!inOnboarding) router.replace("/onboarding");
    } else if (inAuthGroup || inOnboarding) {
      router.replace("/home");
    }
  }, [session, loading, hasProfile, needsAcceptance, segments, router]);
}
