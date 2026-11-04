import { profileStrength } from "../strength";

const empty = { avatar_url: null, bio: null, availability: null, portfolio_url: null };

describe("profileStrength", () => {
  it("lists every item undone for an empty profile, photo first", () => {
    const items = profileStrength(empty, 0, 0);
    expect(items.every((item) => !item.done)).toBe(true);
    expect(items[0]?.key).toBe("photo");
  });

  it("marks items done from the profile, skills and portfolio", () => {
    const items = profileStrength(
      {
        avatar_url: "u/a.jpg",
        bio: "Seven years building payments products for UK fintechs.",
        availability: "15 hrs/week",
        portfolio_url: null,
      },
      3,
      1,
    );
    expect(items.every((item) => item.done)).toBe(true);
  });

  it("needs three skills and a real bio, not a placeholder", () => {
    const items = profileStrength({ ...empty, bio: "Hi" }, 2, 0);
    expect(items.find((i) => i.key === "skills")?.done).toBe(false);
    expect(items.find((i) => i.key === "bio")?.done).toBe(false);
  });

  it("counts a portfolio link as showing work", () => {
    const items = profileStrength({ ...empty, portfolio_url: "https://sam.dev" }, 0, 0);
    expect(items.find((i) => i.key === "work")?.done).toBe(true);
  });
});
