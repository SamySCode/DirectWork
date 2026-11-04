import { CONTACT_DETAILS_MESSAGE, fieldErrors } from "../../../lib/validation";
import { profileSchema } from "../schemas";

const valid = {
  fullName: "Sam Saib",
  headline: "React Native engineer",
  seekingPaid: true,
  seekingPartner: false,
  wantsToHire: false,
  portfolioUrl: "",
  skills: ["React Native"],
};

const errorsFor = (input: unknown) => {
  const result = profileSchema.safeParse(input);
  return result.success ? {} : fieldErrors(result.error);
};

describe("profileSchema", () => {
  it("accepts a minimal valid profile and normalises an empty portfolio link", () => {
    expect(profileSchema.parse(valid).portfolioUrl).toBeUndefined();
  });

  it("requires at least one reason to be here", () => {
    expect(errorsFor({ ...valid, seekingPaid: false })).toEqual({
      seekingPaid: "Pick at least one reason you're here",
    });
  });

  it("accepts hiring as the only intent", () => {
    expect(
      profileSchema.safeParse({ ...valid, seekingPaid: false, wantsToHire: true }).success,
    ).toBe(true);
  });

  it.each(["javascript:alert(1)", "ftp://files.example", "example.com", "data:text/html,hi"])(
    "rejects non-http(s) portfolio link %p",
    (url) => {
      expect(errorsFor({ ...valid, portfolioUrl: url })).toHaveProperty("portfolioUrl");
    },
  );

  it("accepts an https portfolio link", () => {
    expect(profileSchema.parse({ ...valid, portfolioUrl: "https://sam.dev" }).portfolioUrl).toBe(
      "https://sam.dev",
    );
  });

  it("blocks contact details in headline and bio, but not in the portfolio link", () => {
    expect(errorsFor({ ...valid, headline: "Dev - call 07700900123" }).headline).toBe(
      CONTACT_DETAILS_MESSAGE,
    );
    expect(errorsFor({ ...valid, bio: "Reach me at sam@example.com" }).bio).toBe(
      CONTACT_DETAILS_MESSAGE,
    );
  });

  it("requires name, headline and a skill", () => {
    const errors = errorsFor({ ...valid, fullName: "  ", headline: "", skills: [] });
    expect(Object.keys(errors).sort()).toEqual(["fullName", "headline", "skills"]);
  });
});
