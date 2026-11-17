// Payload shapes for the actions function and their mapping onto the
// service-only SQL wrappers. Kept apart from index.ts so it can be tested
// without starting a server. Zod checks the shape; the private.* functions
// re-check every rule (they're the authority).

import { z } from "npm:zod@4.6.7";

const note = z.string().max(1000).optional();

// Deal Sheet values may arrive as null or be left out when not used.
const money = z.number().finite().min(0).max(100_000_000);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalText = (max: number) => z.string().max(max).nullish();

const dealSheet = z.object({
  scope: z.string().min(20).max(2000),
  payBasis: z.enum(["fixed", "hourly", "daily", "equity", "mixed"]),
  amount: money.nullish(),
  currency: z.enum(["GBP", "EUR", "USD"]),
  paymentTermsDays: z.number().int().min(0).max(120).default(14),
  milestones: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        dueDate: isoDate,
        amount: money.nullish(),
      }),
    )
    .max(12)
    .default([]),
  ipTerms: z.enum(["client_owns_on_payment", "creator_licence", "joint", "other"]),
  ipNotes: optionalText(500),
  equityPercent: z.number().finite().gt(0).max(100).nullish(),
  vestingMonths: z.number().int().min(0).max(120).nullish(),
  cliffMonths: z.number().int().min(0).max(120).nullish(),
  decisionRights: optionalText(500),
});

export const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit_listing"), projectId: z.uuid() }),
  z.object({
    action: z.literal("review_listing"),
    projectId: z.uuid(),
    approve: z.boolean(),
    note,
  }),
  z.object({
    action: z.literal("set_listing_status"),
    projectId: z.uuid(),
    status: z.enum(["draft", "published", "paused", "completed", "abandoned"]),
  }),
  z.object({
    action: z.literal("decide_application"),
    applicationId: z.uuid(),
    accept: z.boolean(),
    note,
  }),
  z.object({ action: z.literal("withdraw_application"), applicationId: z.uuid() }),
  z.object({
    action: z.literal("record_outcome"),
    membershipId: z.uuid(),
    outcome: z.enum(["completed", "abandoned"]),
    summary: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("write_reference"),
    membershipId: z.uuid(),
    body: z.string().min(20).max(300),
  }),
  z.object({
    action: z.literal("ask_question"),
    applicationId: z.uuid(),
    question: z.string().min(5).max(500),
  }),
  z.object({
    action: z.literal("answer_question"),
    questionId: z.uuid(),
    answer: z.string().min(1).max(1000),
  }),
  z.object({
    action: z.literal("resolve_report"),
    reportId: z.uuid(),
    takeAction: z.boolean(),
    note,
  }),
  z.object({
    action: z.literal("propose_deal"),
    membershipId: z.uuid(),
    business: z.boolean(),
    sheet: dealSheet,
  }),
  z.object({
    action: z.literal("confirm_deal"),
    dealId: z.uuid(),
    version: z.number().int().min(1),
    business: z.boolean(),
  }),
  z.object({
    action: z.literal("report_payment"),
    dealId: z.uuid(),
    milestoneIndex: z.number().int().min(0).max(11).nullish(),
    outcome: z.enum(["on_time", "late", "unpaid"]),
    paidOn: isoDate.nullish(),
  }),
  z.object({
    action: z.literal("dispute_payment"),
    reportId: z.uuid(),
    reason: z.string().min(20).max(500),
  }),
  z.object({
    action: z.literal("resolve_payment_dispute"),
    reportId: z.uuid(),
    uphold: z.boolean(),
    note,
  }),
]);

export type Action = z.infer<typeof actionSchema>;

type DealSheet = z.infer<typeof dealSheet>;

/** The snake_case jsonb private.propose_deal reads. */
function dealSheetJson(sheet: DealSheet): Record<string, unknown> {
  return {
    scope: sheet.scope,
    pay_basis: sheet.payBasis,
    amount: sheet.amount ?? null,
    currency: sheet.currency,
    payment_terms_days: sheet.paymentTermsDays,
    milestones: sheet.milestones.map((m) => ({
      title: m.title,
      due_date: m.dueDate,
      amount: m.amount ?? null,
    })),
    ip_terms: sheet.ipTerms,
    ip_notes: sheet.ipNotes ?? null,
    equity_percent: sheet.equityPercent ?? null,
    vesting_months: sheet.vestingMonths ?? null,
    cliff_months: sheet.cliffMonths ?? null,
    decision_rights: sheet.decisionRights ?? null,
  };
}

export function toRpc(actor: string, input: Action): [string, Record<string, unknown>] {
  switch (input.action) {
    case "submit_listing":
      return ["svc_submit_listing", { p_actor: actor, p_project: input.projectId }];
    case "review_listing":
      return [
        "svc_review_listing",
        {
          p_actor: actor,
          p_project: input.projectId,
          p_approve: input.approve,
          p_note: input.note ?? null,
        },
      ];
    case "set_listing_status":
      return [
        "svc_set_listing_status",
        { p_actor: actor, p_project: input.projectId, p_to: input.status },
      ];
    case "decide_application":
      return [
        "svc_decide_application",
        {
          p_actor: actor,
          p_application: input.applicationId,
          p_accept: input.accept,
          p_note: input.note ?? null,
        },
      ];
    case "withdraw_application":
      return ["svc_withdraw_application", { p_actor: actor, p_application: input.applicationId }];
    case "record_outcome":
      return [
        "svc_record_outcome",
        {
          p_actor: actor,
          p_membership: input.membershipId,
          p_outcome: input.outcome,
          p_summary: input.summary ?? null,
        },
      ];
    case "write_reference":
      return [
        "svc_write_reference",
        { p_actor: actor, p_membership: input.membershipId, p_body: input.body },
      ];
    case "ask_question":
      return [
        "svc_ask_question",
        { p_actor: actor, p_application: input.applicationId, p_question: input.question },
      ];
    case "answer_question":
      return [
        "svc_answer_question",
        { p_actor: actor, p_question: input.questionId, p_answer: input.answer },
      ];
    case "resolve_report":
      return [
        "svc_resolve_report",
        {
          p_actor: actor,
          p_report: input.reportId,
          p_action: input.takeAction,
          p_note: input.note ?? null,
        },
      ];
    case "propose_deal":
      return [
        "svc_propose_deal",
        {
          p_actor: actor,
          p_membership: input.membershipId,
          p_business: input.business,
          p_sheet: dealSheetJson(input.sheet),
        },
      ];
    case "confirm_deal":
      return [
        "svc_confirm_deal",
        {
          p_actor: actor,
          p_deal: input.dealId,
          p_version: input.version,
          p_business: input.business,
        },
      ];
    case "report_payment":
      return [
        "svc_report_payment",
        {
          p_actor: actor,
          p_deal: input.dealId,
          p_milestone: input.milestoneIndex ?? null,
          p_outcome: input.outcome,
          p_paid_on: input.paidOn ?? null,
        },
      ];
    case "dispute_payment":
      return [
        "svc_dispute_payment",
        { p_actor: actor, p_report: input.reportId, p_reason: input.reason },
      ];
    case "resolve_payment_dispute":
      return [
        "svc_resolve_payment_dispute",
        {
          p_actor: actor,
          p_report: input.reportId,
          p_uphold: input.uphold,
          p_note: input.note ?? null,
        },
      ];
  }
}
