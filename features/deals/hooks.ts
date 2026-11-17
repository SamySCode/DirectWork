import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDealForDispute,
  getDealSheet,
  getOpenDisputes,
  getPayRecord,
  runDealAction,
  type DealSheet,
  type DealTerms,
  type PaymentOutcome,
} from "./api";
import { snapshotTerms, type TermSnapshot } from "./logic";

export const dealKeys = {
  all: ["deals"] as const,
  sheet: (membershipId: string) => ["deals", "sheet", membershipId] as const,
  payRecord: (ownerId: string) => ["deals", "pay-record", ownerId] as const,
  disputes: ["deals", "disputes"] as const,
  dispute: (reportId: string) => ["deals", "dispute", reportId] as const,
  seen: (dealId: string) => ["deals", "seen", dealId] as const,
};

/** One small row per collaboration, fetched when a collaboration or deal screen opens. */
export function useDealSheet(membershipId: string | undefined) {
  return useQuery({
    queryKey: dealKeys.sheet(membershipId ?? ""),
    queryFn: () => getDealSheet(membershipId!),
    enabled: !!membershipId,
  });
}

/** Changes slowly and is shown next to owners - cache for 10 minutes, like the reply record. */
export function usePayRecord(ownerId: string | undefined) {
  return useQuery({
    queryKey: dealKeys.payRecord(ownerId ?? ""),
    queryFn: () => getPayRecord(ownerId!),
    enabled: !!ownerId,
    staleTime: 10 * 60_000,
  });
}

/*
 * The server keeps only the current version, so "what changed since you
 * confirmed" compares it with a copy of the terms kept on this device when
 * you proposed or confirmed them. Another device has no copy - the screen
 * then asks you to read the whole sheet again.
 */
const seenKey = (dealId: string) => `deal-seen:${dealId}`;

export async function rememberTerms(sheet: DealSheet): Promise<void> {
  try {
    await AsyncStorage.setItem(
      seenKey(sheet.id),
      JSON.stringify({ version: sheet.version, terms: snapshotTerms(sheet) }),
    );
  } catch {
    // A convenience only.
  }
}

export function useSeenTerms(dealId: string | undefined) {
  return useQuery({
    queryKey: dealKeys.seen(dealId ?? ""),
    queryFn: async (): Promise<{ version: number; terms: TermSnapshot } | null> => {
      try {
        const raw = await AsyncStorage.getItem(seenKey(dealId!));
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    enabled: !!dealId,
    staleTime: Infinity,
  });
}

function useDealMutation<V>(fn: (vars: V) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: dealKeys.all }),
  });
}

export const useProposeDeal = () =>
  useDealMutation((vars: { membershipId: string; business: boolean; sheet: DealTerms }) =>
    runDealAction({ action: "propose_deal", ...vars }),
  );

export const useConfirmDeal = () =>
  useDealMutation(async (vars: { sheet: DealSheet; business: boolean }) => {
    await runDealAction({
      action: "confirm_deal",
      dealId: vars.sheet.id,
      version: vars.sheet.version,
      business: vars.business,
    });
    await rememberTerms(vars.sheet);
  });

export const useReportPayment = () =>
  useDealMutation(
    (vars: {
      dealId: string;
      milestoneIndex: number | null;
      outcome: PaymentOutcome;
      paidOn?: string;
    }) => runDealAction({ action: "report_payment", ...vars }),
  );

export const useDisputePayment = () =>
  useDealMutation((vars: { reportId: string; reason: string }) =>
    runDealAction({ action: "dispute_payment", ...vars }),
  );

export const useResolvePaymentDispute = () =>
  useDealMutation((vars: { reportId: string; uphold: boolean; note?: string }) =>
    runDealAction({ action: "resolve_payment_dispute", ...vars }),
  );

export function useOpenDisputes(enabled: boolean) {
  return useQuery({ queryKey: dealKeys.disputes, queryFn: getOpenDisputes, enabled });
}

export function useDisputeCase(reportId: string, enabled: boolean) {
  return useQuery({
    queryKey: dealKeys.dispute(reportId),
    queryFn: () => getDealForDispute(reportId),
    enabled,
  });
}
