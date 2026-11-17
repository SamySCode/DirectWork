import { fireEvent, render, screen } from "@testing-library/react-native";
import { describeActivity } from "../../activity/describe";
import type { ActivityItem } from "../../activity/api";
import { makeListing } from "../../../test/fixtures";
import type { DealSheet, PaymentReport } from "../api";
import { DealSheetEntry } from "../components/DealSheetEntry";
import { DEAL_CONSENT, DealSheetView } from "../components/DealSheetView";
import { PayRecordLine } from "../components/PayRecordLine";
import { useDealSheet, usePayRecord } from "../hooks";
import {
  canCorrect,
  canDispute,
  canRepropose,
  changedTerms,
  dealEntryState,
  paidOnProblem,
  payRecordLine,
  paymentDueDate,
  prefillFromListing,
  reportablePayments,
  snapshotTerms,
} from "../logic";
import { dealSheetSchema, toDealTerms, type DealSheetForm } from "../schemas";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../../../lib/supabase", () => ({ supabase: {} }));
jest.mock("expo-print", () => ({}));
jest.mock("expo-sharing", () => ({}));
jest.mock("../hooks", () => ({ useDealSheet: jest.fn(), usePayRecord: jest.fn() }));

function makeSheet(overrides: Partial<DealSheet> = {}): DealSheet {
  return {
    id: "deal-1",
    membership_id: "membership-1",
    version: 2,
    proposed_by: "owner-1",
    scope: "Build the booking flow and the admin dashboard.",
    pay_basis: "fixed",
    amount: 3000,
    currency: "GBP",
    payment_terms_days: 14,
    milestones: [],
    ip_terms: "client_owns_on_payment",
    ip_notes: null,
    equity_percent: null,
    vesting_months: null,
    cliff_months: null,
    decision_rights: null,
    owner_business: true,
    member_business: true,
    owner_confirmed_version: 2,
    member_confirmed_version: 1,
    agreed_at: null,
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-02T10:00:00Z",
    payment_reports: [],
    ...overrides,
  };
}

function makeReport(overrides: Partial<PaymentReport> = {}): PaymentReport {
  return {
    id: "r-1",
    deal_sheet_id: "deal-1",
    milestone_index: 0,
    outcome: "unpaid",
    paid_on: null,
    reported_by: "user-1",
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
    dispute_status: "none",
    dispute_reason: null,
    disputed_at: null,
    resolved_at: null,
    ...overrides,
  };
}

const validForm = (overrides: Partial<DealSheetForm> = {}): DealSheetForm => ({
  partner: false,
  scope: "Build the booking flow and the admin dashboard.",
  payBasis: "fixed",
  amount: "3000",
  currency: "GBP",
  paymentTermsDays: "14",
  milestones: [],
  ipTerms: "client_owns_on_payment",
  ipNotes: "",
  equityPercent: "",
  vestingMonths: "",
  cliffMonths: "",
  decisionRights: "",
  business: true,
  ...overrides,
});

const issues = (form: DealSheetForm) => {
  const result = dealSheetSchema.safeParse(form);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
};

describe("Deal Sheet form validation", () => {
  it("accepts a complete paid deal and builds the propose_deal payload", () => {
    const parsed = dealSheetSchema.parse(
      validForm({ milestones: [{ title: "Beta", dueDate: "2026-12-01", amount: "1500" }] }),
    );
    expect(toDealTerms(parsed)).toEqual({
      scope: "Build the booking flow and the admin dashboard.",
      payBasis: "fixed",
      amount: 3000,
      currency: "GBP",
      paymentTermsDays: 14,
      milestones: [{ title: "Beta", dueDate: "2026-12-01", amount: 1500 }],
      ipTerms: "client_owns_on_payment",
      ipNotes: undefined,
    });
  });

  it("checks scope length, terms days, amount and milestone dates", () => {
    expect(issues(validForm({ scope: "Too short" }))).toContain("scope");
    expect(issues(validForm({ paymentTermsDays: "121" }))).toContain("paymentTermsDays");
    expect(issues(validForm({ amount: "" }))).toContain("amount");
    expect(issues(validForm({ amount: "100000001" }))).toContain("amount");
    expect(
      issues(validForm({ milestones: [{ title: "", dueDate: "2026-02-30", amount: "" }] })),
    ).toEqual(expect.arrayContaining(["milestones.0.title", "milestones.0.dueDate"]));
    const thirteen = Array.from({ length: 13 }, () => ({
      title: "M",
      dueDate: "2026-12-01",
      amount: "",
    }));
    expect(issues(validForm({ milestones: thirteen }))).toContain("milestones");
  });

  it("needs notes for 'other' IP and rejects contact details", () => {
    expect(issues(validForm({ ipTerms: "other" }))).toContain("ipNotes");
    expect(issues(validForm({ ipNotes: "email me at sam@example.com" }))).toContain("ipNotes");
  });

  it("keeps equity terms to partnerships, with the cliff inside vesting", () => {
    expect(issues(validForm({ payBasis: "equity" }))).toContain("payBasis");
    const partner = validForm({ partner: true, payBasis: "equity", amount: "" });
    expect(issues(partner)).toContain("equityPercent");
    expect(
      issues({ ...partner, equityPercent: "10", vestingMonths: "12", cliffMonths: "24" }),
    ).toContain("cliffMonths");
    const parsed = dealSheetSchema.parse({
      ...partner,
      equityPercent: "10",
      vestingMonths: "48",
      cliffMonths: "12",
      decisionRights: "Product calls are joint.",
    });
    expect(toDealTerms(parsed)).toMatchObject({
      payBasis: "equity",
      amount: undefined,
      equityPercent: 10,
      vestingMonths: 48,
      cliffMonths: 12,
      decisionRights: "Product calls are joint.",
    });
    // Paid deals never send partner-only fields.
    const paid = toDealTerms(dealSheetSchema.parse(validForm({ equityPercent: "10" })));
    expect(paid).not.toHaveProperty("equityPercent");
    expect(paid).not.toHaveProperty("decisionRights");
  });
});

describe("prefillFromListing", () => {
  it("takes pay and currency from a paid listing", () => {
    const listing = makeListing({
      compensation_type: "daily",
      compensation_min: 400,
      compensation_max: 400,
      currency: "EUR",
    });
    expect(prefillFromListing(listing, false)).toMatchObject({
      payBasis: "daily",
      amount: "400",
      currency: "EUR",
    });
  });

  it("doesn't guess a price from a range, and reads partnership terms", () => {
    expect(
      prefillFromListing(makeListing({ compensation_min: 300, compensation_max: 500 }), false)
        .amount,
    ).toBe("");
    const listing = makeListing({
      opportunity_type: "partner",
      admission: {
        what_exists_already: "x",
        weekly_commitment_hours: 10,
        first_milestone: "x",
        proposed_terms: "15% equity, 4 year vesting, 12 month cliff",
        owner_contribution: "x",
      },
    });
    expect(prefillFromListing(listing, true)).toMatchObject({
      payBasis: "equity",
      equityPercent: "15",
      vestingMonths: "48",
      cliffMonths: "12",
    });
  });
});

describe("dealEntryState", () => {
  it("offers to propose when there's no sheet", () => {
    expect(dealEntryState(null, "owner")).toEqual({ kind: "none", action: "Propose terms" });
  });
  it("asks the side that hasn't confirmed this version to review", () => {
    expect(dealEntryState(makeSheet(), "member")).toMatchObject({
      kind: "review",
      action: "Review and confirm",
      version: 2,
    });
    expect(dealEntryState(makeSheet(), "owner").kind).toBe("waiting");
  });
  it("is agreed when both confirmed the current version", () => {
    const sheet = makeSheet({ member_confirmed_version: 2, agreed_at: "2026-10-03T09:00:00Z" });
    expect(dealEntryState(sheet, "member")).toMatchObject({ kind: "agreed", version: 2 });
  });
});

describe("DealSheetEntry", () => {
  const entry = async (sheet: DealSheet | null, side: "owner" | "member") => {
    (useDealSheet as jest.Mock).mockReturnValue({ data: sheet, isPending: false });
    await render(<DealSheetEntry applicationId="app-1" membershipId="membership-1" side={side} />);
  };

  it("proposes terms and opens the Deal Sheet", async () => {
    await entry(null, "owner");
    await fireEvent.press(screen.getByRole("button", { name: "Propose terms" }));
    expect(mockPush).toHaveBeenCalledWith("/deal/app-1");
  });

  it("flags a changed version for review", async () => {
    await entry(makeSheet(), "member");
    expect(screen.getByRole("button", { name: "Review and confirm" })).toBeTruthy();
    expect(screen.getByText("Version 2 changed since you last confirmed.")).toBeTruthy();
  });

  it("shows the agreed version and date", async () => {
    await entry(
      makeSheet({ member_confirmed_version: 2, agreed_at: "2026-10-03T09:00:00Z" }),
      "owner",
    );
    expect(screen.getByText("Agreed")).toBeTruthy();
    expect(screen.getByText("Version 2 · agreed 3 Oct 2026")).toBeTruthy();
  });
});

describe("DealSheetView", () => {
  const view = async (sheet: DealSheet, seen: Parameters<typeof DealSheetView>[0]["seen"]) =>
    await render(
      <DealSheetView
        sheet={sheet}
        side="member"
        canPropose
        canConfirm
        otherName="Tom"
        seen={seen}
        confirming={false}
        error={null}
        onConfirm={jest.fn()}
        onEdit={jest.fn()}
        onPdf={jest.fn()}
        pdfBusy={false}
      />,
    );

  it("shows what changed since your confirmation, and the consent before confirming", async () => {
    const before = makeSheet({ version: 1, amount: 2500 });
    await view(makeSheet(), { version: 1, terms: snapshotTerms(before) });
    expect(screen.getByText("Changed since you confirmed version 1")).toBeTruthy();
    expect(screen.getByText("Amount · changed")).toBeTruthy();
    expect(screen.getByText(DEAL_CONSENT)).toBeTruthy();
    expect(DEAL_CONSENT).toMatch(
      /Payment outcomes reported on agreed Deal Sheets are shown to signed-in users.*with dispute rights/,
    );
    expect(screen.getByRole("button", { name: "Confirm version 2" })).toBeTruthy();
  });

  it("asks for a full re-read when this device has no copy", async () => {
    await view(makeSheet(), null);
    expect(screen.getByText(/Read the whole sheet again/)).toBeTruthy();
  });

  it("lists only the terms that changed", () => {
    const a = snapshotTerms(makeSheet());
    const b = snapshotTerms(makeSheet({ payment_terms_days: 30, scope: makeSheet().scope }));
    expect(changedTerms(a, b)).toEqual(["Payment terms"]);
  });
});

describe("payments", () => {
  const agreed = makeSheet({
    member_confirmed_version: 2,
    agreed_at: "2026-10-03T09:00:00Z",
    milestones: [
      { title: "Beta", due_date: "2026-11-01", amount: 1500 },
      { title: "Launch", due_date: "2026-12-01", amount: 1500 },
    ],
  });

  it("can be reported only from the day after a due date", () => {
    expect(reportablePayments(agreed, "2026-11-01")).toHaveLength(0);
    const due = reportablePayments(agreed, "2026-11-02");
    expect(due.map((p) => p.label)).toEqual(["Milestone 1: Beta"]);
  });

  it("uses the agreed date plus payment terms when there are no milestones", () => {
    const sheet = { ...agreed, milestones: [] };
    expect(paymentDueDate(sheet, null)).toBe("2026-10-17");
    expect(reportablePayments(sheet, "2026-10-18")[0]).toMatchObject({ index: null });
  });

  it("has nothing to report on equity-only deals", () => {
    expect(reportablePayments({ ...agreed, pay_basis: "equity" }, "2027-01-01")).toEqual([]);
  });

  it("checks paid-on dates like the server", () => {
    expect(paidOnProblem("late", "2026-11-01", "2026-11-01", "2026-11-07")).toMatch(/on time/);
    expect(paidOnProblem("late", "2026-11-09", "2026-11-01", "2026-11-07")).toMatch(/future/);
    expect(paidOnProblem("late", "2026-11-05", "2026-11-01", "2026-11-07")).toBeNull();
  });

  it("opens disputes for 14 days from the last correction, and corrections from creation", () => {
    const report = makeReport({ updated_at: "2026-11-05T10:00:00Z" });
    expect(canDispute(report, new Date("2026-11-19T09:00:00Z"))).toBe(true);
    expect(canDispute(report, new Date("2026-11-20T11:00:00Z"))).toBe(false);
    expect(canCorrect(report, new Date("2026-11-16T11:00:00Z"))).toBe(false);
    expect(canDispute(makeReport({ dispute_status: "disputed" }), new Date("2026-11-02"))).toBe(
      false,
    );
    expect(canCorrect(makeReport({ dispute_status: "disputed" }), new Date("2026-11-02"))).toBe(
      false,
    );
  });

  it("fixes the terms once a payment is reported", () => {
    expect(canRepropose(agreed)).toBe(true);
    expect(canRepropose({ ...agreed, payment_reports: [makeReport()] })).toBe(false);
  });
});

describe("pay record", () => {
  it("is a fact-only line, hidden without a row", () => {
    expect(payRecordLine(null)).toBeNull();
    expect(payRecordLine({ counted: 0, on_time: 0, late: 0, unpaid: 0 })).toBeNull();
    expect(payRecordLine({ counted: 5, on_time: 4, late: 1, unpaid: 0 })).toBe(
      "Paid on time on 4 of 5 reported payments · reported by professionals",
    );
  });

  it("renders nothing below the threshold (no row) and the count above it", async () => {
    (usePayRecord as jest.Mock).mockReturnValue({ data: null });
    const { toJSON } = await render(<PayRecordLine ownerId="owner-1" />);
    expect(toJSON()).toBeNull();

    (usePayRecord as jest.Mock).mockReturnValue({
      data: { counted: 3, on_time: 2, late: 0, unpaid: 1 },
    });
    await render(<PayRecordLine ownerId="owner-1" />);
    const line = screen.getByText(
      "Paid on time on 2 of 3 reported payments · reported by professionals",
    );
    expect(line).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/bad|unreliable|good|score|%/i);
  });
});

describe("Deal Sheet activity", () => {
  const item = (kind: ActivityItem["kind"]): ActivityItem => ({
    id: "a-1",
    kind,
    created_at: "2026-11-07T10:00:00Z",
    read_at: null,
    project_id: "p-1",
    application_id: "app-1",
    actor: { id: "u-2", full_name: "Priya Shah", avatar_url: null },
    project: { id: "p-1", title: "Booking app", owner_id: "owner-1" },
  });

  it.each([
    "deal_proposed",
    "deal_agreed",
    "payment_due",
    "payment_reported",
    "payment_disputed",
    "payment_dispute_resolved",
  ] as const)("%s reads and opens the Deal Sheet", (kind) => {
    const view = describeActivity(item(kind), "owner-1");
    expect(view.text).toContain("Booking app");
    expect(view.href).toBe("/deal/app-1");
  });
});

describe("Deal Sheet print view is injection-safe", () => {
  it("escapes everything users wrote and forbids scripts in the page", () => {
    const { dealSheetHtml } = require("../pdf");
    const evil = `<script>alert(1)</script><img src=x onerror="alert(2)">'`;
    const html: string = dealSheetHtml(
      {
        id: "d1",
        membership_id: "m1",
        version: 1,
        proposed_by: "u1",
        scope: evil,
        pay_basis: "fixed",
        amount: 100,
        currency: "GBP",
        payment_terms_days: 14,
        milestones: [{ title: evil, due_date: "2026-12-01", amount: 50 }],
        ip_terms: "other",
        ip_notes: evil,
        equity_percent: null,
        vesting_months: null,
        cliff_months: null,
        decision_rights: null,
        owner_business: true,
        member_business: true,
        owner_confirmed_version: 1,
        member_confirmed_version: 1,
        agreed_at: "2026-11-07T10:00:00Z",
        created_at: "2026-11-07T10:00:00Z",
        updated_at: "2026-11-07T10:00:00Z",
      },
      { projectTitle: evil, ownerName: evil, memberName: evil },
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("default-src 'none'");
  });
});
