import { invokeFunction } from "../../lib/functions";
import { supabase } from "../../lib/supabase";

export const payBases = ["fixed", "hourly", "daily", "equity", "mixed"] as const;
export const ipTermsOptions = [
  "client_owns_on_payment",
  "creator_licence",
  "joint",
  "other",
] as const;
export const dealCurrencies = ["GBP", "EUR", "USD"] as const;

export type PayBasis = (typeof payBases)[number];
export type IpTerms = (typeof ipTermsOptions)[number];
export type DealCurrency = (typeof dealCurrencies)[number];

export type Milestone = { title: string; due_date: string; amount: number | null };

export type PaymentOutcome = "on_time" | "late" | "unpaid";
export type DisputeStatus = "none" | "disputed" | "upheld" | "rejected";

export type PaymentReport = {
  id: string;
  deal_sheet_id: string;
  milestone_index: number | null;
  outcome: PaymentOutcome;
  paid_on: string | null;
  reported_by: string;
  created_at: string;
  updated_at: string;
  dispute_status: DisputeStatus;
  dispute_reason: string | null;
  disputed_at: string | null;
  resolved_at: string | null;
};

/** One per collaboration (membership). The two parties can read it (RLS). */
export type DealSheet = {
  id: string;
  membership_id: string;
  version: number;
  proposed_by: string;
  scope: string;
  pay_basis: PayBasis;
  amount: number | null;
  currency: DealCurrency;
  payment_terms_days: number;
  milestones: Milestone[];
  ip_terms: IpTerms;
  ip_notes: string | null;
  equity_percent: number | null;
  vesting_months: number | null;
  cliff_months: number | null;
  decision_rights: string | null;
  owner_business: boolean;
  member_business: boolean;
  owner_confirmed_version: number | null;
  member_confirmed_version: number | null;
  agreed_at: string | null;
  created_at: string;
  updated_at: string;
  payment_reports: PaymentReport[];
};

/** The terms a party proposes - the `sheet` of the propose_deal action. */
export type DealTerms = {
  scope: string;
  payBasis: PayBasis;
  amount?: number;
  currency: DealCurrency;
  paymentTermsDays: number;
  milestones: { title: string; dueDate: string; amount?: number }[];
  ipTerms: IpTerms;
  ipNotes?: string;
  equityPercent?: number;
  vestingMonths?: number;
  cliffMonths?: number;
  decisionRights?: string;
};

export type DealAction =
  | { action: "propose_deal"; membershipId: string; business: boolean; sheet: DealTerms }
  | { action: "confirm_deal"; dealId: string; version: number; business: boolean }
  | {
      action: "report_payment";
      dealId: string;
      milestoneIndex: number | null;
      outcome: PaymentOutcome;
      paidOn?: string;
    }
  | { action: "dispute_payment"; reportId: string; reason: string }
  | { action: "resolve_payment_dispute"; reportId: string; uphold: boolean; note?: string };

/** Every Deal Sheet write goes through supabase/functions/actions. */
export function runDealAction(payload: DealAction): Promise<{ ok: true }> {
  return invokeFunction("actions", payload);
}

type RawDealSheet = Omit<DealSheet, "milestones" | "payment_reports" | "amount"> & {
  amount: number | string | null;
  milestones: Milestone[] | null;
  payment_reports: PaymentReport[] | null;
};

const num = (value: number | string | null | undefined) =>
  value === null || value === undefined ? null : Number(value);

function toDealSheet(raw: RawDealSheet): DealSheet {
  return {
    ...raw,
    // numeric columns can arrive as strings.
    amount: num(raw.amount),
    equity_percent: num(raw.equity_percent),
    milestones: (raw.milestones ?? []).map((m) => ({ ...m, amount: num(m.amount) })),
    payment_reports: raw.payment_reports ?? [],
  };
}

export async function getDealSheet(membershipId: string): Promise<DealSheet | null> {
  const { data, error } = await supabase
    .from("deal_sheets")
    .select("*, payment_reports(*)")
    .eq("membership_id", membershipId)
    .maybeSingle();
  if (error) throw error;
  return data ? toDealSheet(data as RawDealSheet) : null;
}

export type PayRecord = { counted: number; on_time: number; late: number; unpaid: number };

/** No row until the owner has enough counting reports (the threshold lives in SQL). */
export async function getPayRecord(ownerId: string): Promise<PayRecord | null> {
  const { data, error } = await supabase.rpc("get_pay_record", { p_owner: ownerId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as PayRecord | null | undefined;
  return row ?? null;
}

/** Reports waiting for a moderator. RLS / the RPC decide who can see them. */
export async function getOpenDisputes(): Promise<PaymentReport[]> {
  const { data, error } = await supabase
    .from("payment_reports")
    .select("*")
    .eq("dispute_status", "disputed")
    .order("disputed_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as PaymentReport[];
}

export type DisputeCase = Record<string, unknown>;

/** Admin only: the report with the Deal Sheet it was made on. */
export async function getDealForDispute(reportId: string): Promise<DisputeCase | null> {
  const { data, error } = await supabase.rpc("get_deal_for_dispute", { p_report: reportId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as DisputeCase | null | undefined) ?? null;
}
