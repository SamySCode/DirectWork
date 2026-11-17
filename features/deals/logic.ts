import type { ListingDetail } from "../listings/api";
import type { DealSheet, Milestone, PaymentReport, PayRecord } from "./api";
import { payBasisLabels, ipTermsLabels, formatMoney } from "./labels";
import { parseDate } from "../../lib/latePayment";

export type Side = "owner" | "member";

/** Agreed = both parties confirmed the current version. */
export function isAgreed(sheet: DealSheet): boolean {
  return (
    sheet.owner_confirmed_version === sheet.version &&
    sheet.member_confirmed_version === sheet.version
  );
}

export function myConfirmedVersion(sheet: DealSheet, side: Side): number | null {
  return side === "owner" ? sheet.owner_confirmed_version : sheet.member_confirmed_version;
}

export type DealEntryState =
  | { kind: "none"; action: "Propose terms" }
  | { kind: "review"; action: "Review and confirm"; version: number }
  | { kind: "waiting"; action: "View terms"; version: number }
  | { kind: "agreed"; action: "View agreed terms"; version: number; agreedAt: string | null };

/** What the Deal Sheet entry point on a collaboration offers this side. */
export function dealEntryState(sheet: DealSheet | null, side: Side): DealEntryState {
  if (!sheet) return { kind: "none", action: "Propose terms" };
  if (isAgreed(sheet)) {
    return {
      kind: "agreed",
      action: "View agreed terms",
      version: sheet.version,
      agreedAt: sheet.agreed_at,
    };
  }
  if (myConfirmedVersion(sheet, side) === sheet.version) {
    return { kind: "waiting", action: "View terms", version: sheet.version };
  }
  return { kind: "review", action: "Review and confirm", version: sheet.version };
}

export const shortDate = (value: string) =>
  new Date(value.length === 10 ? `${value}T00:00:00Z` : value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** The terms as label/value lines - used for the read view, the diff and the PDF. */
export function termLines(
  sheet: Pick<DealSheet, TermKey>,
): { key: TermKey; label: string; value: string }[] {
  const lines: { key: TermKey; label: string; value: string }[] = [
    { key: "scope", label: "Scope", value: sheet.scope },
    { key: "pay_basis", label: "Pay basis", value: payBasisLabels[sheet.pay_basis] },
  ];
  if (sheet.pay_basis !== "equity") {
    lines.push({
      key: "amount",
      label: "Amount",
      value: sheet.amount != null ? formatMoney(sheet.amount, sheet.currency) : "Not set",
    });
  }
  lines.push({
    key: "payment_terms_days",
    label: "Payment terms",
    value:
      sheet.payment_terms_days === 0
        ? "On invoice or milestone"
        : `${sheet.payment_terms_days} days after invoice or milestone`,
  });
  lines.push({
    key: "milestones",
    label: "Milestones",
    value:
      sheet.milestones.length === 0
        ? "None"
        : sheet.milestones
            .map(
              (m, i) =>
                `${i + 1}. ${m.title} - due ${shortDate(m.due_date)}${
                  m.amount != null ? ` - ${formatMoney(m.amount, sheet.currency)}` : ""
                }`,
            )
            .join("\n"),
  });
  lines.push({
    key: "ip_terms",
    label: "Intellectual property",
    value: ipTermsLabels[sheet.ip_terms],
  });
  if (sheet.ip_notes) lines.push({ key: "ip_notes", label: "IP notes", value: sheet.ip_notes });
  if (sheet.equity_percent != null) {
    lines.push({ key: "equity_percent", label: "Equity", value: `${sheet.equity_percent}%` });
  }
  if (sheet.vesting_months != null) {
    lines.push({
      key: "vesting_months",
      label: "Vesting",
      value: `${sheet.vesting_months} months`,
    });
  }
  if (sheet.cliff_months != null) {
    lines.push({ key: "cliff_months", label: "Cliff", value: `${sheet.cliff_months} months` });
  }
  if (sheet.decision_rights) {
    lines.push({ key: "decision_rights", label: "Decision rights", value: sheet.decision_rights });
  }
  return lines;
}

export const TERM_KEYS = [
  "scope",
  "pay_basis",
  "amount",
  "currency",
  "payment_terms_days",
  "milestones",
  "ip_terms",
  "ip_notes",
  "equity_percent",
  "vesting_months",
  "cliff_months",
  "decision_rights",
] as const;
export type TermKey = (typeof TERM_KEYS)[number];
export type TermSnapshot = Pick<DealSheet, TermKey>;

export function snapshotTerms(sheet: DealSheet): TermSnapshot {
  const snapshot = {} as Record<TermKey, unknown>;
  for (const key of TERM_KEYS) snapshot[key] = sheet[key];
  return snapshot as TermSnapshot;
}

/** Labels of the terms that differ between what you last saw and the current version. */
export function changedTerms(before: TermSnapshot, after: TermSnapshot): string[] {
  const a = new Map(termLines(before).map((line) => [line.label, line.value]));
  const b = new Map(termLines(after).map((line) => [line.label, line.value]));
  const labels = new Set([...a.keys(), ...b.keys()]);
  return [...labels].filter((label) => a.get(label) !== b.get(label));
}

/** Today in UK time (YYYY-MM-DD) - due dates are UK dates, as on the server. */
export function ukToday(now: Date = new Date()): string {
  return ukDate(now);
}

function ukDate(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Add days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * When a payment is due (mirrors private.payment_due_date): the milestone's
 * date, or with no milestones the UK date it was agreed plus the payment terms.
 */
export function paymentDueDate(sheet: DealSheet, index: number | null): string | null {
  if (index !== null) return sheet.milestones[index]?.due_date ?? null;
  if (!sheet.agreed_at) return null;
  return addDays(ukDate(new Date(sheet.agreed_at)), sheet.payment_terms_days);
}

export type ReportablePayment = {
  index: number | null;
  label: string;
  dueDate: string | null;
  amount: number | null;
  report: PaymentReport | null;
};

/**
 * Payments that can be (or have been) reported: each milestone - or the
 * whole deal - from the day after its due date. Equity-only deals have none.
 */
export function reportablePayments(
  sheet: DealSheet,
  today: string = ukToday(),
): ReportablePayment[] {
  if (sheet.pay_basis === "equity" || !sheet.agreed_at) return [];
  const reportFor = (index: number | null) =>
    sheet.payment_reports.find((r) => r.milestone_index === index) ?? null;
  const items: ReportablePayment[] =
    sheet.milestones.length === 0
      ? [
          {
            index: null,
            label: "The whole deal",
            dueDate: paymentDueDate(sheet, null),
            amount: sheet.amount,
            report: reportFor(null),
          },
        ]
      : sheet.milestones.map((m: Milestone, index) => ({
          index,
          label: `Milestone ${index + 1}: ${m.title}`,
          dueDate: m.due_date,
          amount: m.amount ?? null,
          report: reportFor(index),
        }));
  return items.filter((item) => item.report || (item.dueDate !== null && item.dueDate < today));
}

export const REPORT_WINDOW_DAYS = 14;
const windowOpen = (from: string, now: Date) =>
  now.getTime() - new Date(from).getTime() <= REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** Owners can dispute an undisputed report within 14 days of it being made or last corrected. */
export function canDispute(report: PaymentReport, now: Date = new Date()): boolean {
  return report.dispute_status === "none" && windowOpen(report.updated_at, now);
}

/** Professionals can correct their own undisputed report within 14 days of making it. */
export function canCorrect(report: PaymentReport, now: Date = new Date()): boolean {
  return report.dispute_status === "none" && windowOpen(report.created_at, now);
}

/** Once a payment has been reported the terms are fixed - no new versions. */
export function canRepropose(sheet: DealSheet | null): boolean {
  return !sheet || sheet.payment_reports.length === 0;
}

/** Checks a paid-on date for a report (mirrors private.report_payment). */
export function paidOnProblem(
  outcome: "on_time" | "late",
  paidOn: string,
  dueDate: string | null,
  today: string = ukToday(),
): string | null {
  if (outcome !== "late") return null;
  if (!parseDate(paidOn)) {
    return "Enter the date you were paid, like 2026-11-30.";
  }
  if (paidOn > today) return "The paid date can't be in the future.";
  if (dueDate && paidOn <= dueDate) {
    return "That's on or before the due date, so it was paid on time.";
  }
  return null;
}

/** The fact-only owner line. Null hides it (no row, or nothing counted). */
export function payRecordLine(record: PayRecord | null | undefined): string | null {
  if (!record || record.counted <= 0) return null;
  return `Paid on time on ${record.on_time} of ${record.counted} reported payments · reported by professionals`;
}

/** Form defaults from the listing the collaboration came from. */
export function prefillFromListing(listing: ListingDetail | null | undefined, partner: boolean) {
  const min = listing?.compensation_min ?? null;
  const max = listing?.compensation_max ?? null;
  // A range isn't a price: only prefill a single figure.
  const amount = min != null && max != null ? (min === max ? min : null) : (min ?? max);
  // Partnership listings state their terms as text ("20% equity, 48 months
  // vesting, 12 month cliff"); pick out what we can, leave the rest to them.
  const terms = listing?.admission?.proposed_terms ?? "";
  const equity = /(\d{1,3}(?:\.\d+)?)\s*%/.exec(terms)?.[1];
  const months = (word: string) => {
    const match = new RegExp(`(\\d{1,3})[\\s-]*(year|yr|month|mo)s?[\\s-]*${word}`, "i").exec(
      terms,
    );
    if (!match) return "";
    const n = Number(match[1]);
    return String(/^y/i.test(match[2] ?? "") ? n * 12 : n);
  };
  return {
    scope: (listing?.public_summary ?? "").slice(0, 2000),
    payBasis: partner ? ("equity" as const) : (listing?.compensation_type ?? "fixed"),
    currency: listing?.currency ?? "GBP",
    amount: !partner && amount != null ? String(amount) : "",
    equityPercent: partner && equity ? equity : "",
    vestingMonths: partner ? months("vest") : "",
    cliffMonths: partner ? months("cliff") : "",
  };
}
