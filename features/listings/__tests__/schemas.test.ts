import { CONTACT_DETAILS_MESSAGE, fieldErrors } from "../../../lib/validation";
import { applicationSchema, listingSchema } from "../schemas";

const paid = {
  title: "React Native developer for a 6-week MVP",
  publicSummary: "We need a field-survey app built for iOS and Android with offline sync.",
  opportunityType: "paid" as const,
  compensationType: "daily" as const,
  compensationMin: "450",
  compensationMax: "550",
  currency: "GBP" as const,
  skills: ["React Native"],
};

const admission = {
  whatExistsAlready: "Working prototype with 14 paying pilot clinics",
  weeklyCommitmentHours: "15",
  firstMilestone: "Native app live with 3 clinics",
  proposedTerms: "12% equity, 4-year vest",
  ownerContribution: "Full-time founder, funded runway",
};

const errorsFor = (input: unknown) => {
  const result = listingSchema.safeParse(input);
  return result.success ? {} : fieldErrors(result.error);
};

describe("listingSchema", () => {
  it("accepts a complete paid listing and converts amounts to numbers", () => {
    const result = listingSchema.parse(paid);
    expect(result.compensationMin).toBe(450);
    expect(result.compensationMax).toBe(550);
  });

  it("requires a pay type for paid listings", () => {
    expect(errorsFor({ ...paid, compensationType: undefined })).toHaveProperty("compensationType");
  });

  it("rejects a range where min is above max", () => {
    expect(errorsFor({ ...paid, compensationMin: "600" })).toEqual({
      compensationMax: "Max must be at least the min",
    });
  });

  it("rejects non-integer amounts", () => {
    expect(errorsFor({ ...paid, compensationMin: "4.5k" })).toHaveProperty("compensationMin");
  });

  it("requires admission criteria for partner listings", () => {
    const partner = { ...paid, opportunityType: "partner" as const, compensationType: undefined };
    expect(errorsFor(partner)).toHaveProperty("admission");
    expect(listingSchema.safeParse({ ...partner, admission }).success).toBe(true);
  });

  it("maps nested admission errors to the individual field", () => {
    const partner = {
      ...paid,
      opportunityType: "partner" as const,
      admission: { ...admission, weeklyCommitmentHours: "80", firstMilestone: "soon" },
    };
    const errors = errorsFor(partner);
    expect(errors.weeklyCommitmentHours).toMatch(/between 1 and 60/);
    expect(errors.firstMilestone).toMatch(/at least 10 characters/);
  });

  it("needs at least one skill and at most 15", () => {
    expect(errorsFor({ ...paid, skills: [] })).toHaveProperty("skills");
    const many = Array.from({ length: 16 }, (_, i) => `Skill ${i}`);
    expect(errorsFor({ ...paid, skills: many })).toHaveProperty("skills");
  });

  it.each([
    ["title", "Contact jo@example.com now"],
    ["publicSummary", "Long description, but call 07700 900123 for the details"],
  ])("blocks contact details in %s", (field, value) => {
    expect(errorsFor({ ...paid, [field]: value })[field]).toBe(CONTACT_DETAILS_MESSAGE);
  });

  it("blocks contact details inside admission criteria", () => {
    const partner = {
      ...paid,
      opportunityType: "partner" as const,
      admission: { ...admission, proposedTerms: "Let's discuss: www.mysite.com" },
    };
    expect(errorsFor(partner).proposedTerms).toBe(CONTACT_DETAILS_MESSAGE);
  });

  it("trims and drops empty optional text", () => {
    const result = listingSchema.parse({ ...paid, location: "   ", duration: "" });
    expect(result.location).toBeUndefined();
    expect(result.duration).toBeUndefined();
  });
});

describe("applicationSchema", () => {
  it("requires a meaningful note", () => {
    expect(applicationSchema.safeParse({ coverNote: "Hire me" }).success).toBe(false);
  });

  it("caps notes at 1500 characters", () => {
    expect(applicationSchema.safeParse({ coverNote: "a".repeat(1501) }).success).toBe(false);
  });

  it("blocks contact details", () => {
    const result = applicationSchema.safeParse({
      coverNote: "I'm a great fit, email me at me@example.com to chat",
    });
    expect(result.success).toBe(false);
  });
});
