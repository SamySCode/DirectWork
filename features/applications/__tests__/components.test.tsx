import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { makeApplication, T } from "../../../test/fixtures";
import { confirm } from "../../../lib/confirm";
import { ApplicantCard } from "../components/ApplicantCard";
import { ApplyPanel } from "../components/ApplyPanel";
import { CollaborationPanel } from "../components/CollaborationPanel";
import { ProgressRail } from "../components/ProgressRail";
import {
  useApply,
  useAttachmentUrls,
  useContact,
  useDecideApplication,
  useMyApplications,
  useRecordOutcome,
} from "../hooks";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../../../lib/supabase", () => ({
  supabase: { storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "" } }) }) } },
}));
jest.mock("../../../lib/confirm", () => ({ confirm: jest.fn() }));
jest.mock("../../../lib/images", () => ({
  ...jest.requireActual("../../../lib/images"),
  pickImages: jest.fn().mockResolvedValue([{ uri: "file://sample.jpg", width: 10, height: 10 }]),
}));
jest.mock("../hooks", () => ({
  useApply: jest.fn(),
  useMyApplications: jest.fn(),
  useDecideApplication: jest.fn(),
  useContact: jest.fn(),
  useRecordOutcome: jest.fn(),
  useAttachmentUrls: jest.fn(),
  useAskQuestion: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useAnswerQuestion: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useHasWrittenReference: jest.fn(() => ({ data: false, isPending: false })),
  useWriteReference: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
}));

const mutate = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (useApply as jest.Mock).mockReturnValue({ mutate, isPending: false });
  (useMyApplications as jest.Mock).mockReturnValue({ data: [] });
  (useDecideApplication as jest.Mock).mockReturnValue({ mutate, isPending: false });
  (useRecordOutcome as jest.Mock).mockReturnValue({ mutate, isPending: false });
  (useContact as jest.Mock).mockReturnValue({ data: null, isPending: false });
  (useAttachmentUrls as jest.Mock).mockReturnValue({ data: undefined });
});

describe("ApplyPanel", () => {
  const open = () => {
    render(<ApplyPanel projectId="listing-1" ownerFirstName="Tom" />);
    fireEvent.press(screen.getByRole("button", { name: "Apply" }));
  };

  it("starts collapsed and opens a note addressed to the owner", () => {
    open();
    expect(screen.getByText("Tell Tom why you're a fit")).toBeTruthy();
  });

  it("validates the note when you leave it", () => {
    open();
    const note = screen.getByLabelText("Your note");
    fireEvent.changeText(note, "Hire me");
    fireEvent(note, "blur");
    expect(screen.getByText(/Write at least 20 characters/)).toBeTruthy();
  });

  it("refuses contact details before acceptance", () => {
    open();
    fireEvent.changeText(
      screen.getByLabelText("Your note"),
      "Very keen on this - call me on 07700 900123 to chat",
    );
    fireEvent.press(screen.getByRole("button", { name: "Send application" }));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText(/Leave out emails, phone numbers and links/)).toBeTruthy();
  });

  it("sends the note with attached work samples", async () => {
    open();
    fireEvent.changeText(
      screen.getByLabelText("Your note"),
      "I shipped two offline-first React Native apps last year.",
    );
    fireEvent.press(screen.getByRole("button", { name: "Add image to Work samples (optional)" }));
    await waitFor(() => expect(screen.getByText("1 / 3")).toBeTruthy());
    fireEvent.press(screen.getByRole("button", { name: "Send application" }));
    expect(mutate).toHaveBeenCalledWith(
      {
        projectId: "listing-1",
        coverNote: "I shipped two offline-first React Native apps last year.",
        images: [expect.objectContaining({ uri: "file://sample.jpg" })],
      },
      expect.any(Object),
    );
  });

  it("shows the server's error, e.g. the daily limit", () => {
    (useApply as jest.Mock).mockReturnValue({
      isPending: false,
      mutate: (_: unknown, opts: { onError: (e: Error) => void }) =>
        opts.onError(new Error("Daily application limit reached - try again tomorrow")),
    });
    open();
    fireEvent.changeText(screen.getByLabelText("Your note"), "A genuinely relevant note here.");
    fireEvent.press(screen.getByRole("button", { name: "Send application" }));
    expect(screen.getByText("Daily application limit reached - try again tomorrow")).toBeTruthy();
  });

  it("replaces the form with status once you've applied", () => {
    (useMyApplications as jest.Mock).mockReturnValue({ data: [makeApplication()] });
    render(<ApplyPanel projectId="listing-1" ownerFirstName="Tom" />);
    expect(screen.getByText("You've applied")).toBeTruthy();
    expect(screen.getByText("Waiting for reply")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "View your application" }));
    expect(mockPush).toHaveBeenCalledWith("/application/app-1");
  });

  it("lets you apply again after a rejection", () => {
    (useMyApplications as jest.Mock).mockReturnValue({
      data: [makeApplication({ status: "rejected" })],
    });
    render(<ApplyPanel projectId="listing-1" ownerFirstName="Tom" />);
    expect(screen.getByRole("button", { name: "Apply" })).toBeTruthy();
  });
});

describe("ApplicantCard", () => {
  it("accepts only after confirmation", async () => {
    (confirm as jest.Mock).mockResolvedValue(true);
    render(<ApplicantCard application={makeApplication()} />);
    fireEvent.press(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        { applicationId: "app-1", accept: true },
        expect.any(Object),
      ),
    );
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Accept Lena Fischer?" }),
    );
  });

  it("does nothing when the decline is cancelled", async () => {
    (confirm as jest.Mock).mockResolvedValue(false);
    render(<ApplicantCard application={makeApplication()} />);
    fireEvent.press(screen.getByRole("button", { name: "Decline" }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows attachments through signed URLs", () => {
    (useAttachmentUrls as jest.Mock).mockReturnValue({
      data: { "user-1/a.jpg": "https://signed/a" },
    });
    render(
      <ApplicantCard
        application={makeApplication({
          attachments: [{ id: "att", storage_path: "user-1/a.jpg" }],
        })}
      />,
    );
    expect(screen.getByRole("imagebutton")).toBeTruthy();
  });

  it("opens the applicant's profile", () => {
    render(<ApplicantCard application={makeApplication()} />);
    fireEvent.press(screen.getByRole("link"));
    expect(mockPush).toHaveBeenCalledWith("/people/user-1");
  });

  it("shows the status instead of buttons once decided", () => {
    render(<ApplicantCard application={makeApplication({ status: "withdrawn" })} />);
    expect(screen.getByText("Withdrawn")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
  });
});

describe("CollaborationPanel", () => {
  it("renders nothing until accepted", () => {
    const { toJSON } = render(
      <CollaborationPanel application={makeApplication()} viewerIsOwner={false} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("reveals contact details and opens email", () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    (useContact as jest.Mock).mockReturnValue({
      data: { full_name: "Tom Ellery", email: "tom@fieldnote.io" },
      isPending: false,
    });
    render(
      <CollaborationPanel
        application={makeApplication({ status: "accepted" })}
        viewerIsOwner={false}
      />,
    );
    expect(screen.getByText("Contact details unlocked")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Email Tom" }));
    expect(openURL).toHaveBeenCalledWith("mailto:tom@fieldnote.io");
  });

  it("records an outcome after confirmation", async () => {
    (confirm as jest.Mock).mockResolvedValue(true);
    render(
      <CollaborationPanel application={makeApplication({ status: "accepted" })} viewerIsOwner />,
    );
    fireEvent.press(screen.getByRole("button", { name: "Mark completed" }));
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        { membershipId: "membership-1", outcome: "completed" },
        expect.any(Object),
      ),
    );
  });

  it("asks the other side to confirm what was proposed", () => {
    const outcome = {
      outcome: "completed" as const,
      summary: null,
      confirmed_by_owner_at: T,
      confirmed_by_member_at: null,
    };
    render(
      <CollaborationPanel
        application={makeApplication({ status: "accepted" }, outcome)}
        viewerIsOwner={false}
      />,
    );
    expect(screen.getByText("They marked this completed - confirm?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm completed" })).toBeTruthy();
  });

  it("shows no actions once both sides agree", () => {
    const outcome = {
      outcome: "completed" as const,
      summary: null,
      confirmed_by_owner_at: T,
      confirmed_by_member_at: T,
    };
    render(
      <CollaborationPanel
        application={makeApplication({ status: "accepted" }, outcome)}
        viewerIsOwner
      />,
    );
    expect(screen.getByText("Completed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Mark|Confirm|Ended/ })).toBeNull();
  });
});

describe("ProgressRail", () => {
  it.each([
    [makeApplication(), "Progress: Applied"],
    [makeApplication({ status: "accepted" }), "Progress: Working together"],
    [
      makeApplication(
        { status: "accepted" },
        {
          outcome: "completed",
          summary: null,
          confirmed_by_owner_at: T,
          confirmed_by_member_at: T,
        },
      ),
      "Progress: Confirmed",
    ],
    [makeApplication({ status: "rejected" }), "Application closed"],
  ])("describes the state for screen readers", (application, label) => {
    render(<ProgressRail application={application} />);
    expect(screen.getByLabelText(label)).toBeTruthy();
  });
});
