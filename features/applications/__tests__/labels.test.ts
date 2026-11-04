import type { Application, Outcome } from "../api";
import { applicationStatusMeta, collaborationState } from "../labels";

const T = "2026-11-01T00:00:00Z";

function app(overrides: Partial<Application> = {}, outcome: Outcome | null = null): Application {
  return {
    id: "a1",
    project_id: "p1",
    applicant_id: "u1",
    application_type: "paid",
    status: "accepted",
    cover_note: "note",
    decision_note: null,
    decided_at: T,
    created_at: T,
    project: null,
    applicant: null,
    attachments: [],
    questions: [],
    membership: { id: "m1", role: "contractor", left_at: null, outcome },
    ...overrides,
  };
}

const outcome = (o: Partial<Outcome>): Outcome => ({
  outcome: "completed",
  summary: null,
  confirmed_by_owner_at: null,
  confirmed_by_member_at: null,
  ...o,
});

describe("collaborationState", () => {
  it("is null until an application is accepted", () => {
    expect(collaborationState(app({ status: "submitted", membership: null }), false)).toBeNull();
    expect(collaborationState(app({ status: "rejected", membership: null }), true)).toBeNull();
  });

  it("shows 'Working together' with no outcome yet", () => {
    expect(collaborationState(app(), false)).toEqual({
      label: "Working together",
      tone: "accent",
      needsYou: false,
    });
  });

  it("asks the other side to confirm, from each point of view", () => {
    const ownerMarked = app({}, outcome({ confirmed_by_owner_at: T }));
    expect(collaborationState(ownerMarked, true)).toMatchObject({
      needsYou: false,
      tone: "warning",
    });
    expect(collaborationState(ownerMarked, false)).toMatchObject({
      needsYou: true,
      label: "They marked this completed - confirm?",
    });
  });

  it("uses 'ended' wording for abandoned outcomes", () => {
    const memberMarked = app({}, outcome({ outcome: "abandoned", confirmed_by_member_at: T }));
    expect(collaborationState(memberMarked, false)?.label).toBe(
      "Waiting for them to confirm ended",
    );
  });

  it("settles once both sides confirm", () => {
    const both = { confirmed_by_owner_at: T, confirmed_by_member_at: T };
    expect(collaborationState(app({}, outcome(both)), true)).toEqual({
      label: "Completed",
      tone: "mint",
      needsYou: false,
    });
    expect(collaborationState(app({}, outcome({ ...both, outcome: "abandoned" })), false)).toEqual({
      label: "Ended",
      tone: "neutral",
      needsYou: false,
    });
  });
});

describe("applicationStatusMeta", () => {
  it("covers every status", () => {
    expect(Object.keys(applicationStatusMeta).sort()).toEqual([
      "accepted",
      "rejected",
      "submitted",
      "withdrawn",
    ]);
  });
});
