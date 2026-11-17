import { documentTitle } from "../documentTitle";

describe("documentTitle", () => {
  it("names the screen, then the app", () => {
    expect(documentTitle(["(tabs)", "discover"])).toBe("Discover · DirectWork");
    expect(documentTitle(["(auth)", "sign-in"])).toBe("Sign in · DirectWork");
    expect(documentTitle(["account", "edit"])).toBe("Edit profile · DirectWork");
  });

  it("picks the most specific route", () => {
    expect(documentTitle(["listing", "new"])).toBe("New listing · DirectWork");
    expect(documentTitle(["listing", "[id]", "edit"])).toBe("Edit listing · DirectWork");
    expect(documentTitle(["listing", "[id]"])).toBe("Listing · DirectWork");
    expect(documentTitle(["legal", "accept"])).toBe("Updated terms · DirectWork");
    expect(documentTitle(["legal", "[doc]"])).toBe("Legal · DirectWork");
  });

  it("uses the thing's own name when there is one", () => {
    expect(documentTitle(["listing", "[id]"], "React Native developer for a 6-week MVP")).toBe(
      "React Native developer for a 6-week MVP · DirectWork",
    );
    expect(documentTitle(["listing", "[id]"], "   ")).toBe("Listing · DirectWork");
  });

  it("is just the app name on the welcome page and anywhere unrecognised", () => {
    expect(documentTitle(["(auth)", "welcome"])).toBe("DirectWork");
    expect(documentTitle([])).toBe("DirectWork");
    expect(documentTitle(["something-new"])).toBe("DirectWork");
  });
});
