import { computeFit } from "../fit";

const listing = {
  opportunity_type: "paid" as const,
  remote_pref: "remote" as const,
  location: null,
  skills: ["React Native", "TypeScript", "Offline sync"],
};
const profile = {
  seeking_paid: true,
  seeking_partner: false,
  remote_pref: "remote" as const,
  location: null,
};
const mySkills = new Set(["react native", "typescript"]);

describe("computeFit", () => {
  it("splits required skills into matched and missing, case-insensitively", () => {
    const fit = computeFit(listing, profile, mySkills);
    expect(fit.matchedSkills).toEqual(["React Native", "TypeScript"]);
    expect(fit.missingSkills).toEqual(["Offline sync"]);
  });

  it("checks the opportunity type against what the viewer is open to", () => {
    expect(computeFit(listing, profile, mySkills).signals[0]).toEqual({
      key: "type",
      label: "You're open to paid work",
      ok: true,
    });
    const partner = computeFit({ ...listing, opportunity_type: "partner" }, profile, mySkills);
    expect(partner.signals[0]).toMatchObject({ label: "You're open to partnerships", ok: false });
  });

  it("treats flexible on either side as compatible", () => {
    const remote = (a: "remote" | "onsite" | "flexible", b: "remote" | "onsite" | "flexible") =>
      computeFit(
        { ...listing, remote_pref: a },
        { ...profile, remote_pref: b },
        mySkills,
      ).signals.find((s) => s.key === "remote")?.ok;
    expect(remote("remote", "remote")).toBe(true);
    expect(remote("onsite", "remote")).toBe(false);
    expect(remote("flexible", "onsite")).toBe(true);
    expect(remote("onsite", "flexible")).toBe(true);
  });

  it("skips the setup signal when either side hasn't said", () => {
    const fit = computeFit({ ...listing, remote_pref: null }, profile, mySkills);
    expect(fit.signals.map((s) => s.key)).toEqual(["type"]);
  });

  it("still reports skills for a viewer without a profile", () => {
    const fit = computeFit(listing, null, new Set());
    expect(fit.missingSkills).toHaveLength(3);
    expect(fit.signals).toEqual([]);
  });
});
