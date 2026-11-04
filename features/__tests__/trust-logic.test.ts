import type { ActivityItem } from "../activity/api";
import { describeActivity } from "../activity/describe";
import { availabilityFreshness, freshnessLabel } from "../profile/freshness";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 4);
const confirmedDaysAgo = (days: number) => new Date(now - days * DAY).toISOString();

describe("availabilityFreshness", () => {
  const seeker = { seeking_paid: true, seeking_partner: false };

  it("is fresh, then nudges, then goes stale", () => {
    const at = (days: number) =>
      availabilityFreshness({ ...seeker, availability_confirmed_at: confirmedDaysAgo(days) }, now);
    expect(at(2)).toMatchObject({ daysAgo: 2, nudge: false, stale: false });
    expect(at(25)).toMatchObject({ nudge: true, stale: false });
    expect(at(31)).toMatchObject({ nudge: true, stale: true });
  });

  it("never applies to people who aren't looking", () => {
    const f = availabilityFreshness(
      {
        seeking_paid: false,
        seeking_partner: false,
        availability_confirmed_at: confirmedDaysAgo(90),
      },
      now,
    );
    expect(f).toMatchObject({ stale: false, nudge: false });
    expect(freshnessLabel(f)).toBeNull();
  });

  it("labels recency for readers", () => {
    const label = (days: number) =>
      freshnessLabel(
        availabilityFreshness(
          { ...seeker, availability_confirmed_at: confirmedDaysAgo(days) },
          now,
        ),
      );
    expect(label(0)).toBe("Availability confirmed today");
    expect(label(1)).toBe("Availability confirmed 1 day ago");
    expect(label(40)).toMatch(/over a month/);
  });
});

describe("describeActivity", () => {
  const item = (overrides: Partial<ActivityItem>): ActivityItem => ({
    id: "a-1",
    kind: "application_received",
    created_at: new Date(now).toISOString(),
    read_at: null,
    project_id: "p-1",
    application_id: "app-1",
    actor: { id: "u-2", full_name: "Priya Shah", avatar_url: null },
    project: { id: "p-1", title: "Booking app", owner_id: "owner-1" },
    ...overrides,
  });

  it("reads naturally and links to the right place", () => {
    expect(describeActivity(item({}), "owner-1")).toMatchObject({
      text: "Priya applied to Booking app",
      href: "/listing/p-1",
    });
    expect(describeActivity(item({ kind: "application_accepted" }), "u-1")).toMatchObject({
      href: "/application/app-1",
    });
  });

  it("sends outcome prompts to whichever side the viewer is on", () => {
    const outcome = item({ kind: "outcome_to_confirm" });
    expect(describeActivity(outcome, "owner-1").href).toBe("/listing/p-1");
    expect(describeActivity(outcome, "member-1").href).toBe("/application/app-1");
  });

  it("tells applicants a closed listing apart from a decline", () => {
    expect(describeActivity(item({ kind: "application_closed" }), "u-1").text).toMatch(/closed/);
    expect(describeActivity(item({ kind: "application_declined" }), "u-1").text).toMatch(
      /wasn't a fit/,
    );
  });

  it("copes with a deleted actor or listing", () => {
    const view = describeActivity(item({ actor: null, project: null }), "owner-1");
    expect(view.text).toBe("Someone applied to a listing");
  });
});
