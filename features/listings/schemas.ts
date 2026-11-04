import { z } from "zod";
import { CONTACT_DETAILS_MESSAGE, hasContactDetails } from "../../lib/validation";
import { remotePrefOptions } from "../profile/schemas";

export const opportunityTypes = ["paid", "partner"] as const;
export const commitmentOptions = ["few_hours", "part_time", "full_time"] as const;
export const compensationTypes = ["fixed", "hourly", "daily"] as const;
export const currencies = ["GBP", "EUR", "USD"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .refine((value) => !hasContactDetails(value), CONTACT_DETAILS_MESSAGE)
    .optional()
    .transform((value) => (value ? value : undefined));

const optionalAmount = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || /^\d{1,7}$/.test(value), { message: "Whole numbers only" })
  .transform((value) => (value ? Number(value) : undefined));

// Mirrors the CHECK constraints on public.project_admission - the database
// is the real enforcement, these are for inline feedback.
export const admissionSchema = z.object({
  whatExistsAlready: z
    .string()
    .trim()
    .min(20, "Describe what exists today in at least 20 characters")
    .max(1000, "Keep this under 1000 characters")
    .refine((value) => !hasContactDetails(value), CONTACT_DETAILS_MESSAGE),
  weeklyCommitmentHours: z
    .string()
    .trim()
    .refine((value) => /^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 60, {
      message: "Enter hours per week between 1 and 60",
    })
    .transform(Number),
  firstMilestone: z
    .string()
    .trim()
    .min(10, "Describe the first milestone in at least 10 characters")
    .max(500, "Keep this under 500 characters")
    .refine((value) => !hasContactDetails(value), CONTACT_DETAILS_MESSAGE),
  proposedTerms: z
    .string()
    .trim()
    .min(5, "State the terms you're offering")
    .max(500, "Keep this under 500 characters")
    .refine((value) => !hasContactDetails(value), CONTACT_DETAILS_MESSAGE),
  ownerContribution: z
    .string()
    .trim()
    .min(10, "Say what you're putting in beyond the idea")
    .max(500, "Keep this under 500 characters")
    .refine((value) => !hasContactDetails(value), CONTACT_DETAILS_MESSAGE),
});

export const listingSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Give the listing a title")
      .max(120, "Keep the title under 120 characters")
      .refine((value) => !hasContactDetails(value), CONTACT_DETAILS_MESSAGE),
    publicSummary: z
      .string()
      .trim()
      .min(20, "Describe the work in at least 20 characters")
      .max(2000, "Keep this under 2000 characters")
      .refine((value) => !hasContactDetails(value), CONTACT_DETAILS_MESSAGE),
    opportunityType: z.enum(opportunityTypes),
    location: optionalText(200),
    remotePref: z.enum(remotePrefOptions).optional(),
    commitment: z.enum(commitmentOptions).optional(),
    duration: optionalText(100),
    compensationType: z.enum(compensationTypes).optional(),
    compensationMin: optionalAmount,
    compensationMax: optionalAmount,
    currency: z.enum(currencies),
    skills: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(100)
          .refine((value) => !hasContactDetails(value), CONTACT_DETAILS_MESSAGE),
      )
      .min(1, "Add at least one skill you need")
      .max(15, "Pick up to 15 skills"),
    admission: admissionSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.opportunityType === "paid" && !data.compensationType) {
      ctx.addIssue({ code: "custom", path: ["compensationType"], message: "Choose how it pays" });
    }
    if (
      data.compensationMin !== undefined &&
      data.compensationMax !== undefined &&
      data.compensationMin > data.compensationMax
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["compensationMax"],
        message: "Max must be at least the min",
      });
    }
    if (data.opportunityType === "partner" && !data.admission) {
      ctx.addIssue({
        code: "custom",
        path: ["admission"],
        message: "Partner listings need admission criteria",
      });
    }
  });

export type ListingInput = z.infer<typeof listingSchema>;

export const applicationSchema = z.object({
  coverNote: z
    .string()
    .trim()
    .min(20, "Write at least 20 characters - say why you're a fit")
    .max(1500, "Keep this under 1500 characters")
    .refine((value) => !hasContactDetails(value), CONTACT_DETAILS_MESSAGE),
});
