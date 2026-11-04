import { formatCompensation, listingStatusMeta, timeAgo } from "../labels";

const base = {
  opportunity_type: "paid" as const,
  compensation_type: "fixed" as const,
  compensation_min: null,
  compensation_max: null,
  currency: "GBP" as const,
};

describe("formatCompensation", () => {
  it("formats a range with the right symbol and suffix", () => {
    expect(
      formatCompensation({
        ...base,
        compensation_type: "daily",
        compensation_min: 450,
        compensation_max: 550,
      }),
    ).toBe("£450–£550/day");
  });

  it("uses thousands separators and currency symbols", () => {
    expect(
      formatCompensation({
        ...base,
        currency: "EUR",
        compensation_min: 6000,
        compensation_max: 8000,
      }),
    ).toBe("€6,000–€8,000");
  });

  it("shows a single amount when only one bound is set, or both are equal", () => {
    expect(formatCompensation({ ...base, compensation_type: "hourly", compensation_max: 90 })).toBe(
      "£90/hr",
    );
    expect(formatCompensation({ ...base, compensation_min: 500, compensation_max: 500 })).toBe(
      "£500",
    );
  });

  it("falls back to the pay type when no amount is given", () => {
    expect(formatCompensation(base)).toBe("Fixed price");
  });

  it("returns nothing for partner listings or missing pay type", () => {
    expect(formatCompensation({ ...base, opportunity_type: "partner" })).toBeNull();
    expect(formatCompensation({ ...base, compensation_type: null })).toBeNull();
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-11-04T12:00:00Z").getTime();
  beforeEach(() => jest.spyOn(Date, "now").mockReturnValue(now));
  afterEach(() => jest.restoreAllMocks());

  it.each([
    [30 * 1000, "1m ago"],
    [45 * 60 * 1000, "45m ago"],
    [5 * 3600 * 1000, "5h ago"],
    [3 * 86400 * 1000, "3d ago"],
  ])("formats %pms ago as %p", (offset, expected) => {
    expect(timeAgo(new Date(now - offset).toISOString())).toBe(expected);
  });

  it("falls back to a date after a month", () => {
    expect(timeAgo("2026-08-01T00:00:00Z")).toMatch(/1 Aug/);
  });

  it("never shows negative times for clock skew", () => {
    expect(timeAgo(new Date(now + 60_000).toISOString())).toBe("1m ago");
  });
});

describe("listingStatusMeta", () => {
  it("has a label, tone and hint for every status", () => {
    for (const meta of Object.values(listingStatusMeta)) {
      expect(meta.label).toBeTruthy();
      expect(meta.tone).toBeTruthy();
      expect(meta.hint).toBeTruthy();
    }
  });
});
