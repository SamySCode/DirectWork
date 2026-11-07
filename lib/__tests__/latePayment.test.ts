import {
  BASE_RATE_REFERENCES,
  BASE_RATE_SOURCE,
  calculateLatePayment,
  fixedCompensation,
  GOV_UK_LATE_PAYMENT,
  lateLetter,
  NOT_LEGAL_ADVICE,
  referenceDate,
  type LatePaymentClaim,
} from "../latePayment";

const b2b = { ownerBusiness: true, memberBusiness: true };

describe("fixed compensation bands", () => {
  it.each([
    [0.01, 40],
    [999.99, 40],
    [1000, 70],
    [9999.99, 70],
    [10000, 100],
    [250000, 100],
  ])("£%p -> £%p", (debt, expected) => {
    expect(fixedCompensation(debt)).toBe(expected);
  });
});

describe("reference dates", () => {
  it.each([
    // Interest starts the day after the due date.
    ["2026-03-15", "2025-12-31"],
    ["2026-06-29", "2025-12-31"],
    ["2026-06-30", "2026-06-30"], // starts 1 July
    ["2025-07-15", "2025-06-30"],
    ["2025-12-30", "2025-06-30"],
    ["2025-12-31", "2025-12-31"], // starts 1 January
  ])("due %s uses the rate on %s", (due, reference) => {
    expect(referenceDate(due)).toBe(reference);
  });

  it("keeps a dated, sourced table of 30 June / 31 December rates", () => {
    expect(BASE_RATE_SOURCE).toMatch(/^https:\/\/www\.bankofengland\.co\.uk\//);
    for (const date of Object.keys(BASE_RATE_REFERENCES)) {
      expect(date).toMatch(/-(06-30|12-31)$/);
    }
  });
});

describe("calculateLatePayment", () => {
  it("works out simple daily interest at 8% plus base rate", () => {
    const result = calculateLatePayment({
      debt: 1000,
      dueDate: "2026-03-15",
      asOf: "2026-04-14",
      ...b2b,
    });
    expect(result).toEqual({
      ok: true,
      referenceDate: "2025-12-31",
      baseRate: 3.75,
      annualRate: 11.75,
      daysLate: 30,
      dailyInterest: 0.32,
      interest: 9.66, // 1000 × 11.75% × 30 / 365
      compensation: 70,
      total: 1079.66,
    });
  });

  it("is simple, not compound: twice the days, twice the interest", () => {
    const at = (asOf: string) =>
      calculateLatePayment({ debt: 5000, dueDate: "2025-08-01", asOf, ...b2b }) as LatePaymentClaim;
    expect(at("2025-08-21").interest * 2).toBeCloseTo(at("2025-09-10").interest, 2);
    expect(at("2025-08-21").baseRate).toBe(4.25);
  });

  it("is only for business-to-business deals", () => {
    const base = { debt: 1000, dueDate: "2026-03-15", asOf: "2026-04-14" };
    expect(calculateLatePayment({ ...base, ownerBusiness: true, memberBusiness: false })).toEqual({
      ok: false,
      reason: "not_b2b",
    });
    expect(calculateLatePayment({ ...base, ownerBusiness: false, memberBusiness: true })).toEqual({
      ok: false,
      reason: "not_b2b",
    });
  });

  it("refuses bad input, debts not yet late, and rates we don't have", () => {
    expect(
      calculateLatePayment({ debt: 0, dueDate: "2026-03-15", asOf: "2026-04-14", ...b2b }),
    ).toMatchObject({ reason: "invalid" });
    expect(
      calculateLatePayment({ debt: 10, dueDate: "2026-02-30", asOf: "2026-04-14", ...b2b }),
    ).toMatchObject({ reason: "invalid" });
    expect(
      calculateLatePayment({ debt: 10, dueDate: "2026-04-14", asOf: "2026-04-14", ...b2b }),
    ).toMatchObject({ reason: "not_late" });
    expect(
      calculateLatePayment({ debt: 10, dueDate: "2099-07-15", asOf: "2099-08-14", ...b2b }),
    ).toMatchObject({ reason: "missing_rate" });
  });
});

describe("lateLetter", () => {
  it("cites the Act, the figures, the disclaimer and gov.uk", () => {
    const claim = calculateLatePayment({
      debt: 1000,
      dueDate: "2026-03-15",
      asOf: "2026-04-14",
      ...b2b,
    }) as LatePaymentClaim;
    const letter = lateLetter(
      {
        to: "Tom Ellery",
        from: "Lena Fischer",
        projectTitle: "Booking app",
        debt: 1000,
        dueDate: "2026-03-15",
        asOf: "2026-04-14",
        paymentFor: "Milestone 1: Beta",
        agreedAt: "2026-02-01T10:00:00Z",
      },
      claim,
    );
    expect(letter).toContain(NOT_LEGAL_ADVICE);
    expect(letter).toContain(GOV_UK_LATE_PAYMENT);
    expect(letter).toContain("Late Payment of Commercial Debts (Interest) Act 1998");
    expect(letter).toContain("11.75%");
    expect(letter).toContain("£9.66");
    expect(letter).toContain("£70.00");
    expect(letter).toContain("£1,079.66");
    expect(letter).toContain("15 March 2026");
    expect(letter).toMatch(/Dear Tom Ellery/);
  });
});
