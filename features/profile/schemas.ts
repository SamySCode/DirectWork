import { z } from "zod";
import { CONTACT_DETAILS_MESSAGE, hasContactDetails, plainText } from "../../lib/validation";

export const remotePrefOptions = ["remote", "hybrid", "onsite", "flexible"] as const;

// http(s)-only: url() validates format but not scheme, and would accept
// something like "javascript:..." - reject anything else at the input
// boundary rather than relying on every future renderer to sanitize it.
const httpUrlPattern = /^https?:\/\/[^\s]+$/i;

export const profileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Enter your name")
      .max(200, "Keep this under 200 characters")
      .refine((value) => !hasContactDetails(value), CONTACT_DETAILS_MESSAGE),
    headline: z
      .string()
      .trim()
      .min(1, "Enter a short professional headline")
      .max(200, "Keep this under 200 characters")
      .refine((value) => !hasContactDetails(value), CONTACT_DETAILS_MESSAGE),
    bio: z
      .string()
      .trim()
      .max(1000, "Keep your bio under 1000 characters")
      .refine((value) => !hasContactDetails(value), CONTACT_DETAILS_MESSAGE)
      .optional(),
    location: plainText(200).optional(),
    remotePref: z.enum(remotePrefOptions).optional(),
    availability: plainText(200).optional(),
    currentRole: plainText(200).optional(),
    experienceLevel: plainText(200).optional(),
    seekingPaid: z.boolean(),
    seekingPartner: z.boolean(),
    wantsToHire: z.boolean(),
    portfolioUrl: z
      .string()
      .trim()
      .max(500, "Keep this under 500 characters")
      .refine((value) => value === "" || httpUrlPattern.test(value), {
        message: "Enter a valid http:// or https:// URL",
      })
      .transform((value) => (value === "" ? undefined : value)),
    skills: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(100, "Keep skill names under 100 characters")
          .refine((value) => !hasContactDetails(value), CONTACT_DETAILS_MESSAGE),
      )
      .min(1, "Add at least one skill"),
  })
  .refine((data) => data.seekingPaid || data.seekingPartner || data.wantsToHire, {
    message: "Pick at least one reason you're here",
    path: ["seekingPaid"],
  });

export type ProfileInput = z.infer<typeof profileSchema>;
