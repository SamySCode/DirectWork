// The single gate for every sensitive state transition (CLAUDE.md,
// docs/ACCESS_CONTROL.md). Authenticates the caller from their JWT, validates
// the payload shape, and hands off to a private.* SQL function that does the
// authorization and the transition atomically. One function rather than one
// per action keeps cold starts and deploy surface down.

import { z } from "npm:zod@4.4.3";
import { fromDbError, handle, HttpError, serviceClient } from "../_shared/http.ts";

const note = z.string().max(1000).optional();

const actionSchema = z.discriminatedUnion("action", [
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
]);

type Action = z.infer<typeof actionSchema>;

function toRpc(actor: string, input: Action): [string, Record<string, unknown>] {
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
  }
}

// 60 actions a minute per user is far above human pace; it only bites scripts.
handle("actions", { rateLimit: { max: 60, windowSeconds: 60 } }, async ({ user, body }) => {
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "Invalid request");
  const [fn, args] = toRpc(user.id, parsed.data);
  const { error } = await serviceClient().rpc(fn, args);
  if (error) throw fromDbError(error);
  return { ok: true };
});
