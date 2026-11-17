import type { DealCurrency, IpTerms, PaymentOutcome, PayBasis } from "./api";

export const payBasisLabels: Record<PayBasis, string> = {
  fixed: "Fixed price",
  hourly: "Hourly",
  daily: "Day rate",
  equity: "Equity only",
  mixed: "Pay and equity",
};

export const ipTermsLabels: Record<IpTerms, string> = {
  client_owns_on_payment: "Client owns the work on full payment",
  creator_licence: "Creator keeps it, client gets a licence",
  joint: "Owned jointly",
  other: "Other (see notes)",
};

export const paymentOutcomeLabels: Record<PaymentOutcome, string> = {
  on_time: "Paid on time",
  late: "Paid late",
  unpaid: "Not paid yet",
};

const symbols: Record<DealCurrency, string> = { GBP: "£", EUR: "€", USD: "$" };

export function formatMoney(value: number, currency: DealCurrency): string {
  return `${symbols[currency]}${value.toLocaleString("en-GB", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
