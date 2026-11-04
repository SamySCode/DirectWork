import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { countProfessionalsFor, getPlatformPulse } from "./api";

export const insightKeys = {
  pulse: ["insights", "pulse"] as const,
  talent: (skills: string[], type: string) => ["insights", "talent", type, skills] as const,
};

/** Platform-wide totals change slowly - one fetch per 10 minutes at most. */
export function usePlatformPulse(enabled = true) {
  return useQuery({
    queryKey: insightKeys.pulse,
    queryFn: getPlatformPulse,
    staleTime: 10 * 60_000,
    enabled,
  });
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
}

/**
 * Live talent count for a listing being written. Debounced and keyed on the
 * sorted, lower-cased skill set, so typing and re-ordering don't refetch.
 */
export function useTalentCount(skills: string[], type: "paid" | "partner") {
  const normalised = [...new Set(skills.map((s) => s.trim().toLowerCase()))].sort();
  const debounced = useDebounced(normalised.join("|"), 500);
  const list = debounced ? debounced.split("|") : [];
  return useQuery({
    queryKey: insightKeys.talent(list, type),
    queryFn: () => countProfessionalsFor(list, type),
    enabled: list.length > 0,
    staleTime: 5 * 60_000,
  });
}
