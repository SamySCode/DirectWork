import type { Session } from "@supabase/supabase-js";
import { useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export function useProtectedRoute(session: Session | null, loading: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/sign-in");
    } else if (session && inAuthGroup) {
      router.replace("/dashboard");
    }
  }, [session, loading, segments, router]);
}
