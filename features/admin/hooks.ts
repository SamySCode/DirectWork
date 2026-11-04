import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/SessionProvider";

// RLS only lets a user see their own admins row, so this is a cheap
// existence check. It only decides whether to show reviewer UI - the actual
// authorization is private.is_admin inside every review transition.
export function useIsAdmin() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ["admin", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!userId,
    staleTime: Infinity,
  });
}
