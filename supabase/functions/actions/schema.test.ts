// Run: npm run test:functions. Payload shapes for the Deal Sheet actions and
// how they map onto the SQL wrappers. The SQL re-checks every rule
// (supabase/tests/db); these keep junk from reaching it.
import { assertEquals } from "jsr:@std/assert@1";
import { actionSchema, toRpc } from "./schema.ts";

const ACTOR = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";

const sheet = {
  scope: "Build the booking flow screens and the payment step.",
  payBasis: "fixed",
  amount: 2400,
  currency: "GBP",
  paymentTermsDays: 14,
  milestones: [{ title: "Design", dueDate: "2026-12-01", amount: 800 }],
  ipTerms: "client_owns_on_payment",
};

function ok(body: unknown): boolean {
  return actionSchema.safeParse(body).success;
}

function rpc(body: unknown) {
  return toRpc(ACTOR, actionSchema.parse(body));
}

Deno.test("propose_deal: maps to svc_propose_deal with a snake_case sheet", () => {
  assertEquals(
    rpc({
      action: "propose_deal",
      membershipId: ID,
      business: true,
      sheet: { ...sheet, ipNotes: null },
    }),
    [
      "svc_propose_deal",
      {
        p_actor: ACTOR,
        p_membership: ID,
        p_business: true,
        p_sheet: {
          scope: sheet.scope,
          pay_basis: "fixed",
          amount: 2400,
          currency: "GBP",
          payment_terms_days: 14,
          milestones: [{ title: "Design", due_date: "2026-12-01", amount: 800 }],
          ip_terms: "client_owns_on_payment",
          ip_notes: null,
          equity_percent: null,
          vesting_months: null,
          cliff_months: null,
          decision_rights: null,
        },
      },
    ],
  );
});

Deno.test("propose_deal: optional fields can be left out; terms default to 14 days", () => {
  const { paymentTermsDays: _terms, milestones: _milestones, amount: _amount, ...minimal } = sheet;
  const [, args] = rpc({
    action: "propose_deal",
    membershipId: ID,
    business: false,
    sheet: minimal,
  });
  const json = args.p_sheet as Record<string, unknown>;
  assertEquals(json.payment_terms_days, 14);
  assertEquals(json.milestones, []);
  assertEquals(json.amount, null);
});

Deno.test("propose_deal: rejects out-of-range or malformed sheets", () => {
  const base = { action: "propose_deal", membershipId: ID, business: false };
  const milestone = { title: "Design", dueDate: "2026-12-01" };
  const bad: Record<string, unknown>[] = [
    { scope: "Too short" },
    { scope: "x".repeat(2001) },
    { payBasis: "barter" },
    { currency: "JPY" },
    { amount: -1 },
    { amount: Number.POSITIVE_INFINITY },
    { paymentTermsDays: 121 },
    { paymentTermsDays: 1.5 },
    { milestones: Array.from({ length: 13 }, () => milestone) },
    { milestones: [{ ...milestone, dueDate: "1 Dec 2026" }] },
    { milestones: [{ ...milestone, title: "" }] },
    { milestones: [{ ...milestone, title: "t".repeat(121) }] },
    { ipTerms: "mine" },
    { ipNotes: "n".repeat(501) },
    { equityPercent: 0 },
    { equityPercent: 101 },
    { vestingMonths: 121 },
    { cliffMonths: -1 },
    { decisionRights: "d".repeat(501) },
  ];
  for (const change of bad) {
    assertEquals(ok({ ...base, sheet: { ...sheet, ...change } }), false, JSON.stringify(change));
  }
  assertEquals(ok({ ...base, sheet }), true);
  assertEquals(ok({ ...base, membershipId: "nope", sheet }), false);
  assertEquals(ok({ action: "propose_deal", membershipId: ID, sheet }), false, "business required");
});

Deno.test("confirm_deal: needs a positive integer version and the business flag", () => {
  assertEquals(rpc({ action: "confirm_deal", dealId: ID, version: 2, business: false }), [
    "svc_confirm_deal",
    { p_actor: ACTOR, p_deal: ID, p_version: 2, p_business: false },
  ]);
  for (const version of [0, -1, 1.5, "2"]) {
    assertEquals(ok({ action: "confirm_deal", dealId: ID, version, business: false }), false);
  }
  assertEquals(ok({ action: "confirm_deal", dealId: ID, version: 1 }), false);
});

Deno.test("report_payment: milestone index or null, known outcome, ISO paid date", () => {
  assertEquals(
    rpc({ action: "report_payment", dealId: ID, milestoneIndex: null, outcome: "unpaid" }),
    [
      "svc_report_payment",
      { p_actor: ACTOR, p_deal: ID, p_milestone: null, p_outcome: "unpaid", p_paid_on: null },
    ],
  );
  assertEquals(
    rpc({
      action: "report_payment",
      dealId: ID,
      milestoneIndex: 3,
      outcome: "late",
      paidOn: "2026-12-20",
    })[1],
    { p_actor: ACTOR, p_deal: ID, p_milestone: 3, p_outcome: "late", p_paid_on: "2026-12-20" },
  );
  const base = { action: "report_payment", dealId: ID, milestoneIndex: 0, outcome: "on_time" };
  assertEquals(ok({ ...base, outcome: "partial" }), false);
  assertEquals(ok({ ...base, milestoneIndex: 12 }), false);
  assertEquals(ok({ ...base, milestoneIndex: -1 }), false);
  assertEquals(ok({ ...base, milestoneIndex: 0.5 }), false);
  assertEquals(ok({ ...base, paidOn: "20/12/2026" }), false);
});

Deno.test("dispute_payment: reason of 20 to 500 characters", () => {
  const base = { action: "dispute_payment", reportId: ID };
  assertEquals(rpc({ ...base, reason: "We paid this on the due date by transfer." }), [
    "svc_dispute_payment",
    { p_actor: ACTOR, p_report: ID, p_reason: "We paid this on the due date by transfer." },
  ]);
  assertEquals(ok({ ...base, reason: "Not true" }), false);
  assertEquals(ok({ ...base, reason: "r".repeat(501) }), false);
  assertEquals(ok(base), false);
});

Deno.test("resolve_payment_dispute: uphold flag and an optional note", () => {
  assertEquals(rpc({ action: "resolve_payment_dispute", reportId: ID, uphold: true }), [
    "svc_resolve_payment_dispute",
    { p_actor: ACTOR, p_report: ID, p_uphold: true, p_note: null },
  ]);
  assertEquals(
    ok({ action: "resolve_payment_dispute", reportId: ID, uphold: false, note: "n".repeat(1001) }),
    false,
  );
  assertEquals(ok({ action: "resolve_payment_dispute", reportId: ID }), false);
});

Deno.test("existing actions still map as before", () => {
  assertEquals(rpc({ action: "withdraw_application", applicationId: ID }), [
    "svc_withdraw_application",
    { p_actor: ACTOR, p_application: ID },
  ]);
  assertEquals(ok({ action: "unknown_action" }), false);
});
