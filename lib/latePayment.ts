/*
 * Late Payment of Commercial Debts (Interest) Act 1998 - England & Wales.
 *
 * Works out statutory interest and fixed compensation for a late
 * business-to-business payment, and drafts a letter claiming them. The
 * letter is a template, not legal advice (docs/specs/deal-sheet.md).
 *
 * Rules (gov.uk/late-commercial-payments-interest-debt-recovery):
 * - B2B only: both parties must have confirmed they act in the course of
 *   business. Otherwise there is no letter.
 * - Interest = 8% + the Bank of England base rate in force on the reference
 *   date, as simple interest per day. The reference date is 31 December for
 *   interest that starts running between 1 January and 30 June, and 30 June
 *   for interest that starts running between 1 July and 31 December.
 * - Fixed compensation by size of debt: £40 under £1,000; £70 from £1,000 to
 *   £9,999.99; £100 from £10,000.
 */

/**
 * Bank of England base rate (% a year) in force on each reference date.
 *
 * Source: https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp
 * Last checked: 2026-11-07, entries up to 30 June 2026. The 30 June 2026
 * figure (3.75%, unchanged since 18 Dec 2025) is from news reports of the
 * 2026 MPC holds - confirm it against the source above before launch.
 *
 * MUST BE UPDATED TWICE A YEAR (runbook step), on 1 July and 1 January:
 * add the rate in force on the 30 June / 31 December just passed, checked
 * against the source above. Until the entry exists, debts whose interest
 * starts in that half-year get no letter (see `missing_rate`) rather than a
 * guessed figure.
 */
export const BASE_RATE_REFERENCES: Readonly<Record<string, number>> = {
  "2019-12-31": 0.75,
  "2020-06-30": 0.1,
  "2020-12-31": 0.1,
  "2021-06-30": 0.1,
  "2021-12-31": 0.25,
  "2022-06-30": 1.25,
  "2022-12-31": 3.5,
  "2023-06-30": 5.0,
  "2023-12-31": 5.25,
  "2024-06-30": 5.25,
  "2024-12-31": 4.75,
  "2025-06-30": 4.25,
  "2025-12-31": 3.75,
  "2026-06-30": 3.75,
};

export const BASE_RATE_SOURCE = "https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp";
export const GOV_UK_LATE_PAYMENT =
  "https://www.gov.uk/late-commercial-payments-interest-debt-recovery";
export const STATUTORY_UPLIFT = 8;
export const NOT_LEGAL_ADVICE = "This is a template, not legal advice.";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" -> UTC midnight, or null if it isn't a real date. */
export function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value ? date : null;
}

/** The reference date for a debt due on `dueDate`: interest starts the day after. */
export function referenceDate(dueDate: string): string {
  const due = parseDate(dueDate);
  if (!due) throw new Error(`Not a date: ${dueDate}`);
  const start = new Date(due.getTime() + DAY_MS);
  const year = start.getUTCFullYear();
  return start.getUTCMonth() < 6 ? `${year - 1}-12-31` : `${year}-06-30`;
}

/** £40 / £70 / £100 by the size of the debt (in pounds). */
export function fixedCompensation(debt: number): 40 | 70 | 100 {
  if (debt < 1000) return 40;
  if (debt < 10000) return 70;
  return 100;
}

const pence = (value: number) => Math.round(value * 100) / 100;

export type LatePaymentInput = {
  /** The unpaid amount in pounds. */
  debt: number;
  /** When payment was due (YYYY-MM-DD). */
  dueDate: string;
  /** The date interest is worked out to (YYYY-MM-DD), usually today. */
  asOf: string;
  ownerBusiness: boolean;
  memberBusiness: boolean;
};

export type LatePaymentClaim = {
  ok: true;
  referenceDate: string;
  baseRate: number;
  /** 8 + base rate, % a year. */
  annualRate: number;
  daysLate: number;
  dailyInterest: number;
  interest: number;
  compensation: 40 | 70 | 100;
  total: number;
};

export type LatePaymentResult =
  LatePaymentClaim | { ok: false; reason: "not_b2b" | "invalid" | "not_late" | "missing_rate" };

export function calculateLatePayment(input: LatePaymentInput): LatePaymentResult {
  // The 1998 Act covers business-to-business contracts only.
  if (!input.ownerBusiness || !input.memberBusiness) return { ok: false, reason: "not_b2b" };
  const due = parseDate(input.dueDate);
  const asOf = parseDate(input.asOf);
  if (!due || !asOf || !Number.isFinite(input.debt) || input.debt <= 0) {
    return { ok: false, reason: "invalid" };
  }
  const daysLate = Math.round((asOf.getTime() - due.getTime()) / DAY_MS);
  if (daysLate <= 0) return { ok: false, reason: "not_late" };
  const reference = referenceDate(input.dueDate);
  const baseRate = BASE_RATE_REFERENCES[reference];
  if (baseRate === undefined) return { ok: false, reason: "missing_rate" };

  const annualRate = STATUTORY_UPLIFT + baseRate;
  const exactDaily = (input.debt * annualRate) / 100 / 365;
  const interest = pence(exactDaily * daysLate);
  const compensation = fixedCompensation(input.debt);
  return {
    ok: true,
    referenceDate: reference,
    baseRate,
    annualRate,
    daysLate,
    dailyInterest: pence(exactDaily),
    interest,
    compensation,
    total: pence(input.debt + interest + compensation),
  };
}

const money = (value: number) =>
  `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const longDate = (value: string) =>
  parseDate(value)!.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export type LetterDetails = {
  to: string;
  from: string;
  projectTitle: string;
  debt: number;
  dueDate: string;
  asOf: string;
  /** e.g. "Milestone 2: Beta release" - what the payment was for. */
  paymentFor: string;
  /** When the Deal Sheet was agreed (ISO timestamp or date). */
  agreedAt: string;
};

/** The letter text, ready to copy or share. */
export function lateLetter(details: LetterDetails, claim: LatePaymentClaim): string {
  return [
    NOT_LEGAL_ADVICE,
    `Guidance on claiming interest and compensation: ${GOV_UK_LATE_PAYMENT}`,
    "",
    longDate(details.asOf),
    "",
    `Dear ${details.to},`,
    "",
    `Late payment: ${details.projectTitle}`,
    "",
    `Under the Deal Sheet we agreed on ${longDate(details.agreedAt.slice(0, 10))}, payment of ${money(details.debt)} for ${details.paymentFor} was due on ${longDate(details.dueDate)}. I have not received it.`,
    "",
    "We both confirmed that we were acting in the course of business, so the Late Payment of Commercial Debts (Interest) Act 1998 applies. Under the Act I am entitled to claim:",
    "",
    `- statutory interest at ${claim.annualRate.toFixed(2)}% a year (8% plus the Bank of England base rate of ${claim.baseRate.toFixed(2)}% on ${longDate(claim.referenceDate)}), which is ${money(claim.dailyInterest)} a day. For the ${claim.daysLate} ${claim.daysLate === 1 ? "day" : "days"} since the due date this comes to ${money(claim.interest)};`,
    `- fixed compensation of ${money(claim.compensation)} for a debt of this size.`,
    "",
    `The total now due is ${money(claim.total)}. Interest continues at ${money(claim.dailyInterest)} a day until payment is made.`,
    "",
    "Please pay the full amount within 7 days of this letter, or contact me if there is a problem with the payment.",
    "",
    "Yours sincerely,",
    details.from,
  ].join("\n");
}
