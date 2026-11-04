import { z } from "zod";
import { CONTACT_DETAILS_MESSAGE, hasContactDetails } from "../../lib/validation";

const text = (min: number, max: number, tooShort: string) =>
  z
    .string()
    .trim()
    .min(min, tooShort)
    .max(max, `Keep this under ${max} characters`)
    .refine((value) => !hasContactDetails(value), CONTACT_DETAILS_MESSAGE);

export const questionSchema = z.object({
  question: text(5, 500, "Ask a full question"),
});

export const answerSchema = z.object({
  answer: text(1, 1000, "Write an answer"),
});

export const referenceSchema = z.object({
  body: text(20, 300, "Write at least 20 characters - say what they delivered"),
});
