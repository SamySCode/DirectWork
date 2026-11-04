import { fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import { describeCount } from "../insights/api";
import { FactCard } from "../insights/components/FactCard";
import { PulseCard } from "../insights/components/PulseCard";
import { fearOfFailure, ghosting, wrongTeam } from "../insights/facts";
import { TipsCard } from "../guide/components/TipsCard";
import { guide } from "../guide/tips";
import { FirstSteps } from "../profile/components/FirstSteps";

const mockGuidePush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockGuidePush }) }));
import { NodeMeter } from "../../components/NodeMeter";
import { makeApplication, T } from "../../test/fixtures";
import { ApplicantFunnel, funnelCounts } from "../applications/components/ApplicantFunnel";
import { FitPanel } from "../listings/components/FitPanel";
import { topSkills } from "../listings/demand";
import { OutcomeChain } from "../profile/components/OutcomeChain";
import { ProfileStrengthCard } from "../profile/components/ProfileStrengthCard";
import { ReplyRecord, replyTime } from "../profile/components/ReplyRecord";

describe("NodeMeter", () => {
  it("exposes progress to screen readers", () => {
    render(<NodeMeter total={4} lit={3} accessibilityLabel="3 of 4 skills match" />);
    const meter = screen.getByRole("progressbar", { name: "3 of 4 skills match" });
    expect(meter.props.accessibilityValue).toEqual({ min: 0, max: 4, now: 3 });
  });

  it("collapses long lists into +N", () => {
    render(<NodeMeter total={15} lit={2} max={10} accessibilityLabel="x" />);
    expect(screen.getByText("+5", { includeHiddenElements: true })).toBeTruthy();
  });

  it("renders nothing for an empty meter", () => {
    const { toJSON } = render(<NodeMeter total={0} lit={0} accessibilityLabel="x" />);
    expect(toJSON()).toBeNull();
  });

  it("never reports more lit than total", () => {
    render(<NodeMeter total={2} lit={5} accessibilityLabel="m" />);
    expect(screen.getByRole("progressbar").props.accessibilityValue.now).toBe(2);
  });
});

describe("FitPanel", () => {
  it("shows matched skills, names the missing ones, and lists signals", () => {
    render(
      <FitPanel
        fit={{
          matchedSkills: ["React Native", "TypeScript"],
          missingSkills: ["Offline sync"],
          signals: [
            { key: "type", label: "You're open to paid work", ok: true },
            { key: "remote", label: "Different working setup to yours", ok: false },
          ],
        }}
      />,
    );
    expect(screen.getByText("2 of 3 skills")).toBeTruthy();
    expect(screen.getByText("Not on your profile: Offline sync")).toBeTruthy();
    expect(screen.getByText("Different working setup to yours")).toBeTruthy();
  });

  it("renders nothing when there is nothing to compare", () => {
    const { toJSON } = render(
      <FitPanel fit={{ matchedSkills: [], missingSkills: [], signals: [] }} />,
    );
    expect(toJSON()).toBeNull();
  });
});

describe("ApplicantFunnel", () => {
  const completed = {
    outcome: "completed" as const,
    summary: null,
    confirmed_by_owner_at: T,
    confirmed_by_member_at: T,
  };

  it("counts each stage from the loaded applications", () => {
    const counts = funnelCounts([
      makeApplication({ id: "1" }),
      makeApplication({ id: "2", status: "rejected" }),
      makeApplication({ id: "3", status: "accepted" }),
      makeApplication(
        {
          id: "4",
          status: "accepted",
          membership: { id: "m", role: "contractor", left_at: T, outcome: completed },
        },
        completed,
      ),
    ]);
    expect(counts).toEqual({ applied: 4, accepted: 2, working: 1, completed: 1 });
  });

  it("only counts an outcome both sides confirmed", () => {
    const counts = funnelCounts([
      makeApplication({ status: "accepted" }, { ...completed, confirmed_by_member_at: null }),
    ]);
    expect(counts.completed).toBe(0);
  });

  it("labels each bar for screen readers and hides when empty", () => {
    const { rerender, toJSON } = render(
      <ApplicantFunnel counts={{ applied: 5, accepted: 2, working: 2, completed: 1 }} />,
    );
    expect(screen.getByLabelText("Accepted: 2")).toBeTruthy();
    rerender(<ApplicantFunnel counts={{ applied: 0, accepted: 0, working: 0, completed: 0 }} />);
    expect(toJSON()).toBeNull();
  });
});

describe("OutcomeChain", () => {
  it("describes completed and ended collaborations", () => {
    render(<OutcomeChain record={{ completed: 3, total: 4 }} />);
    expect(screen.getByText("3 completed collaborations")).toBeTruthy();
    expect(screen.getByText(/1 more ended early/)).toBeTruthy();
    expect(
      screen.getByRole("progressbar", { name: "3 of 4 collaborations completed" }),
    ).toBeTruthy();
  });

  it("explains how a record is built when there isn't one", () => {
    render(<OutcomeChain record={{ completed: 0, total: 0 }} />);
    expect(screen.getByText(/Confirmed by both sides once a project wraps up/)).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

describe("ProfileStrengthCard", () => {
  const items = [
    { key: "photo", label: "Add a profile photo", done: false },
    { key: "skills", label: "List at least 3 skills", done: true },
    { key: "bio", label: "Write a short bio", done: false },
  ];

  it("shows the next steps and opens the editor", () => {
    const onFix = jest.fn();
    render(<ProfileStrengthCard items={items} tint="#0E7F92" onFix={onFix} />);
    expect(screen.getByRole("progressbar", { name: "1 of 3 profile steps done" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Add a profile photo" }));
    expect(onFix).toHaveBeenCalled();
    expect(screen.queryByText("List at least 3 skills")).toBeNull();
  });

  it("disappears once everything is done", () => {
    const { toJSON } = render(
      <ProfileStrengthCard
        items={items.map((item) => ({ ...item, done: true }))}
        tint="#0E7F92"
        onFix={jest.fn()}
      />,
    );
    expect(toJSON()).toBeNull();
  });
});

describe("topSkills", () => {
  const listing = (...skills: string[]) => ({ skills });

  it("ranks skills asked for by more than one listing, case-insensitively", () => {
    expect(
      topSkills([
        listing("React Native", "TypeScript"),
        listing("react native", "Figma"),
        listing("React Native", "Figma", "Go"),
      ]),
    ).toEqual(["React Native", "Figma"]);
  });

  it("counts a skill once per listing and respects the limit", () => {
    const many = Array.from({ length: 3 }, () => listing("A", "B", "C", "a"));
    expect(topSkills(many, 2)).toEqual(["A", "B"]);
  });

  it("returns nothing when no skill repeats", () => {
    expect(topSkills([listing("A"), listing("B")])).toEqual([]);
  });
});

describe("ReplyRecord", () => {
  it.each([
    [0, "within an hour"],
    [1, "within 1 hour"],
    [5, "within 5 hours"],
    [30, "within 1 day"],
    [60, "within 3 days"],
  ])("replyTime(%p) = %p", (hours, text) => {
    expect(replyTime(hours)).toBe(text);
  });

  it("doesn't judge an owner on too few applications", () => {
    render(<ReplyRecord record={{ received: 2, replied: 0, median_hours: null }} />);
    expect(screen.getByText(/no reply record yet/)).toBeTruthy();
  });

  it("states the record plainly, without a median when nobody got a reply", () => {
    render(<ReplyRecord record={{ received: 5, replied: 0, median_hours: null }} />);
    expect(screen.getByText("Replies to 0 of 5 applicants")).toBeTruthy();
  });
});

describe("insights", () => {
  it.each([
    [0, "No one yet"],
    [3, "A few"],
    [5, "5"],
    [1234, "1,234"],
  ])("describeCount(%p) = %p", (n, text) => {
    expect(describeCount(n)).toBe(text);
  });

  it("FactCard shows a dot grid, the takeaway and a tappable source", () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<FactCard fact={fearOfFailure} />);
    expect(screen.getByRole("image", { name: "58 out of 100" })).toBeTruthy();
    expect(screen.getByText(/fear of failure would stop them/)).toBeTruthy();
    fireEvent.press(screen.getByRole("link", { name: /Global Entrepreneurship Monitor/ }));
    expect(openURL).toHaveBeenCalledWith(fearOfFailure.source.url);
  });

  it("FactCard shows a ranking without inventing percentages", () => {
    render(<FactCard fact={wrongTeam} />);
    expect(screen.getByText("#3")).toBeTruthy();
    expect(screen.getByText("Not the right team")).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("every fact cites an https source", () => {
    for (const fact of [fearOfFailure, wrongTeam, ghosting]) {
      expect(fact.source.url).toMatch(/^https:\/\//);
      expect(fact.source.label.length).toBeGreaterThan(5);
    }
  });

  it("PulseCard stays hidden until the numbers mean something", () => {
    const { toJSON } = render(
      <PulseCard
        pulse={{ open_to_paid: 3, open_to_partner: 2, live_listings: 1, completed: 0 }}
        audience="owner"
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it("PulseCard shows talent to owners and work to professionals", () => {
    const pulse = { open_to_paid: 40, open_to_partner: 25, live_listings: 12, completed: 7 };
    const { rerender } = render(<PulseCard pulse={pulse} audience="owner" />);
    expect(screen.getByLabelText("40 open to paid work")).toBeTruthy();
    rerender(<PulseCard pulse={pulse} audience="professional" />);
    expect(screen.getByLabelText("12 live listings")).toBeTruthy();
  });

  it("FirstSteps highlights the next step and only links undone ones", () => {
    const onPress = jest.fn();
    render(
      <FirstSteps
        steps={[
          { key: "a", label: "Finish your profile", detail: "d", done: true, onPress },
          { key: "b", label: "Apply to a listing", detail: "d", done: false, onPress },
          { key: "c", label: "Hear back", detail: "d", done: false },
        ]}
      />,
    );
    expect(screen.getByRole("progressbar", { name: "1 of 3 first steps done" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Finish your profile/ })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: /Apply to a listing/ }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("guide", () => {
  it("every tip has a title and a substantive body, and no unsourced percentages", () => {
    for (const section of guide) {
      expect(section.tips.length).toBeGreaterThan(0);
      for (const tip of section.tips) {
        expect(tip.title.length).toBeGreaterThan(5);
        expect(tip.body.length).toBeGreaterThan(30);
        expect(tip.body).not.toMatch(/\d+%/);
      }
    }
  });

  it("TipsCard opens on demand and links to the full guide", () => {
    render(<TipsCard section="listing" />);
    expect(screen.queryByText("State the pay or terms up front")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: /Tips: A listing people apply to/ }));
    expect(screen.getByText("State the pay or terms up front")).toBeTruthy();
    fireEvent.press(screen.getByRole("link", { name: "Read the full guide" }));
    expect(mockGuidePush).toHaveBeenCalledWith("/guide");
  });
});
