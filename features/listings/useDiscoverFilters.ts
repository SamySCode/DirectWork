import { useMemo, useState } from "react";
import { useDebounced } from "../../lib/useDebounced";
import type { DiscoverFilters, DiscoverSort } from "./api";
import { commitmentLabels, compensationLabels } from "./labels";

export type TypeTab = "all" | "paid" | "partner";

type Refinements = {
  remoteOnly: boolean;
  commitment?: DiscoverFilters["commitment"];
  compensationType?: DiscoverFilters["compensationType"];
  /** Raw input; parsed to a whole number. */
  minPay: string;
  /** Client-side: only listings needing at least one of the viewer's skills. */
  matchesOnly: boolean;
};

const EMPTY: Refinements = { remoteOnly: false, minPay: "", matchesOnly: false };

export type ActiveFilter = { key: keyof Refinements; label: string };

/** All Discover filter state in one place, plus what goes to the server. */
export function useDiscoverFilters(query: string) {
  const [type, setType] = useState<TypeTab>("all");
  const [sort, setSort] = useState<DiscoverSort>("newest");
  const [refine, setRefine] = useState<Refinements>(EMPTY);

  const minPay = /^\d{1,7}$/.test(refine.minPay.trim()) ? Number(refine.minPay.trim()) : undefined;
  // Typing "450" shouldn't fire three queries.
  const serverMinPay = useDebounced(minPay);
  // Pay filters only make sense for paid work.
  const payApplies = type !== "partner";

  const server: DiscoverFilters = useMemo(
    () => ({
      query,
      type: type === "all" ? undefined : type,
      remoteOnly: refine.remoteOnly,
      commitment: refine.commitment,
      compensationType: payApplies ? refine.compensationType : undefined,
      minPay: payApplies ? serverMinPay : undefined,
      // "match" sorts the loaded page client-side; the server returns newest.
      sort: sort === "pay" ? "pay" : "newest",
    }),
    [query, type, refine, payApplies, serverMinPay, sort],
  );

  const active: ActiveFilter[] = [
    refine.remoteOnly ? { key: "remoteOnly" as const, label: "Remote-friendly" } : null,
    refine.commitment
      ? { key: "commitment" as const, label: commitmentLabels[refine.commitment] }
      : null,
    payApplies && refine.compensationType
      ? { key: "compensationType" as const, label: compensationLabels[refine.compensationType] }
      : null,
    payApplies && minPay
      ? { key: "minPay" as const, label: `£${minPay.toLocaleString("en-GB")}+` }
      : null,
    refine.matchesOnly ? { key: "matchesOnly" as const, label: "Needs my skills" } : null,
  ].filter((item) => item !== null);

  return {
    type,
    setType,
    sort,
    setSort,
    refine,
    update: (patch: Partial<Refinements>) => setRefine((prev) => ({ ...prev, ...patch })),
    remove: (key: keyof Refinements) =>
      setRefine((prev) => ({ ...prev, [key]: EMPTY[key] }) as Refinements),
    clear: () => setRefine(EMPTY),
    payApplies,
    server,
    active,
  };
}
