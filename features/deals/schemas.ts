import { z } from "zod";
import { CONTACT_DETAILS_MESSAGE, hasContactDetails } from "../../lib/validation";
import { parseDate } from "../../lib/latePayment";
import { dealCurrencies, ipTermsOptions, payBases, type DealTerms } from "./api";

export const MAX_MILESTONES = 12;
export const MAX_AMOUNT = 100_000_000;

const noContact = (value: string) => !hasContactDetails(value);

const optionalNumber = (label: string, min: number, max: number, integer = false) =>
  z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => {
        if (!value) return true;
        if (!/^\d+(\.\d{1,2})?$/.test(value)) return false;
        const n = Number(value);
        return n >= min && n <= max && (!integer || Number.isInteger(n));
      },
      {
        message: `${label} must be ${integer ? "a whole number " : ""}between ${min} and ${max.toLocaleString("en-GB")}`,
      },
    )
    .transform((value) => (value ? Number(value) : undefined));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .refine(noContact, CONTACT_DETAILS_MESSAGE)
    .optional()
    .transform((value) => (value ? value : undefined));

const milestoneSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the milestone a title")
    .max(120, "Keep the title under 120 characters")
    .refine(noContact, CONTACT_DETAILS_MESSAGE),
  dueDate: z
    .string()
    .trim()
    .refine((value) => parseDate(value) !== null, { message: "Use a date like 2026-12-31" }),
  amount: optionalNumber("Amount", 0, MAX_AMOUNT),
});

// Mirrors the server's checks (private.propose_deal) for inline feedback;
// the database is the real enforcement.
export const dealSheetSchema = z
  .object({
    partner: z.boolean(),
    scope: z
      .string()
      .trim()
      .min(20, "Describe the scope in at least 20 characters")
      .max(2000, "Keep the scope under 2,000 characters")
      .refine(noContact, CONTACT_DETAILS_MESSAGE),
    payBasis: z.enum(payBases),
    amount: optionalNumber("Amount", 0, MAX_AMOUNT),
    currency: z.enum(dealCurrencies),
    paymentTermsDays: z
      .string()
      .trim()
      .refine((value) => /^\d{1,3}$/.test(value) && Number(value) <= 120, {
        message: "Payment terms must be 0 to 120 days",
      })
      .transform(Number),
    milestones: z.array(milestoneSchema).max(MAX_MILESTONES, "Up to 12 milestones"),
    ipTerms: z.enum(ipTermsOptions),
    ipNotes: optionalText(500),
    equityPercent: optionalNumber("Equity", 0, 100),
    vestingMonths: optionalNumber("Vesting", 0, 120, true),
    cliffMonths: optionalNumber("Cliff", 0, 120, true),
    decisionRights: optionalText(500),
    business: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const paid = ["fixed", "hourly", "daily"].includes(value.payBasis);
    if (paid && value.amount === undefined) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter the amount" });
    }
    if (!value.partner && (value.payBasis === "equity" || value.payBasis === "mixed")) {
      ctx.addIssue({
        code: "custom",
        path: ["payBasis"],
        message: "Equity terms are for partnership collaborations",
      });
    }
    const equity = value.payBasis === "equity" || value.payBasis === "mixed";
    if (value.partner && equity && value.equityPercent === undefined) {
      ctx.addIssue({ code: "custom", path: ["equityPercent"], message: "Enter the equity %" });
    }
    if (
      value.cliffMonths !== undefined &&
      value.vestingMonths !== undefined &&
      value.cliffMonths > value.vestingMonths
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["cliffMonths"],
        message: "The cliff can't be longer than the vesting period",
      });
    }
    if (value.ipTerms === "other" && !value.ipNotes) {
      ctx.addIssue({ code: "custom", path: ["ipNotes"], message: "Say how IP is handled" });
    }
  });

export type DealSheetForm = z.input<typeof dealSheetSchema>;
export type DealSheetValues = z.output<typeof dealSheetSchema>;

/** The `sheet` payload of propose_deal. Equity fields only travel on the partner route. */
export function toDealTerms(values: DealSheetValues): DealTerms {
  const equity = values.partner && (values.payBasis === "equity" || values.payBasis === "mixed");
  return {
    scope: values.scope,
    payBasis: values.payBasis,
    amount: values.payBasis === "equity" ? undefined : values.amount,
    currency: values.currency,
    paymentTermsDays: values.paymentTermsDays,
    milestones: values.milestones,
    ipTerms: values.ipTerms,
    ipNotes: values.ipNotes,
    ...(equity
      ? {
          equityPercent: values.equityPercent,
          vestingMonths: values.vestingMonths,
          cliffMonths: values.cliffMonths,
        }
      : {}),
    ...(values.partner ? { decisionRights: values.decisionRights } : {}),
  };
}

export const disputeReasonSchema = z
  .string()
  .trim()
  .min(20, "Explain in at least 20 characters")
  .max(500, "Keep this under 500 characters")
  .refine(noContact, CONTACT_DETAILS_MESSAGE);

/** The first message per field, for inline errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
