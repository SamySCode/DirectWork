import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { makeListing } from "../../../test/fixtures";
import { confirm } from "../../../lib/confirm";
import { FunctionError } from "../../../lib/functions";
import { ListingCard } from "../components/ListingCard";
import { ListingDetailView } from "../components/ListingDetailView";
import { ListingForm } from "../components/ListingForm";
import { OwnerPanel } from "../components/OwnerPanel";
import { useDeleteDraft, useSetListingStatus, useSubmitListing } from "../hooks";

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
}));
jest.mock("../../../lib/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }) }),
    },
  },
}));
jest.mock("../../../lib/confirm", () => ({ confirm: jest.fn() }));
jest.mock("../../../lib/images", () => ({
  ...jest.requireActual("../../../lib/images"),
  pickImages: jest.fn().mockResolvedValue([{ uri: "file://picked.jpg", width: 10, height: 10 }]),
}));
jest.mock("../../insights/components/TalentPool", () => ({ TalentPool: () => null }));
jest.mock("../../profile/hooks", () => ({
  useReplyRecord: () => ({ data: { received: 10, replied: 9, median_hours: 30 } }),
}));
jest.mock("../hooks", () => ({
  useSetListingStatus: jest.fn(),
  useSubmitListing: jest.fn(),
  useDeleteDraft: jest.fn(),
}));
jest.mock("../../profile/components/SkillsField", () => {
  const { Text } = require("react-native");
  return {
    SkillsField: ({ value, error }: { value: string[]; error?: string }) => (
      <Text>{`skills:${value.join(",")}${error ? ` error:${error}` : ""}`}</Text>
    ),
  };
});

beforeEach(() => jest.clearAllMocks());

describe("ListingCard", () => {
  it("shows pay, meta and highlights the viewer's matching skills", () => {
    render(
      <ListingCard
        listing={makeListing()}
        mySkills={new Set(["react native", "typescript"])}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByText("£450–£550/day")).toBeTruthy();
    expect(screen.getByText("Remote · UK only · Part-time")).toBeTruthy();
    expect(screen.getByText("Matches 2 of your skills")).toBeTruthy();
    expect(screen.getByText("Tom Ellery · Co-founder, Fieldnote")).toBeTruthy();
  });

  it("shows Featured to others, and lifecycle status to the owner", () => {
    const listing = makeListing({ is_featured: true, status: "in_review" });
    const { rerender } = render(<ListingCard listing={listing} onPress={jest.fn()} />);
    expect(screen.getByText("Featured")).toBeTruthy();
    rerender(<ListingCard listing={listing} onPress={jest.fn()} showStatus />);
    expect(screen.getByText("In review")).toBeTruthy();
    expect(screen.queryByText("Featured")).toBeNull();
  });

  it("collapses more than six skills", () => {
    const skills = ["A", "B", "C", "D", "E", "F", "G", "H"];
    render(<ListingCard listing={makeListing({ skills })} onPress={jest.fn()} />);
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("renders a cover image only when the listing has one", () => {
    const { rerender } = render(<ListingCard listing={makeListing()} onPress={jest.fn()} />);
    expect(screen.queryByTestId("expo-image")).toBeNull();
    rerender(
      <ListingCard
        listing={makeListing({
          images: [{ id: "i", storage_path: "p", position: 0, url: "https://cdn/p" }],
        })}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByTestId("expo-image")).toBeTruthy();
  });

  it("is pressable as a single labelled button", () => {
    const onPress = jest.fn();
    render(<ListingCard listing={makeListing()} onPress={onPress} />);
    fireEvent.press(
      screen.getByRole("button", { name: "React Native developer for a 6-week MVP" }),
    );
    expect(onPress).toHaveBeenCalled();
  });
});

describe("ListingDetailView", () => {
  it("shows the reviewed admission criteria for partner listings", () => {
    render(
      <ListingDetailView
        listing={makeListing({
          opportunity_type: "partner",
          admission: {
            what_exists_already: "14 pilot clinics",
            weekly_commitment_hours: 15,
            first_milestone: "Native app by March",
            proposed_terms: "12% equity",
            owner_contribution: "Full-time founder",
          },
        })}
      />,
    );
    expect(screen.getByText("Reviewed admission criteria")).toBeTruthy();
    expect(screen.getByText("15 hours a week")).toBeTruthy();
    expect(screen.getByText("12% equity")).toBeTruthy();
  });

  it("shows the owner's reply record (anti-ghosting)", () => {
    render(<ListingDetailView listing={makeListing()} />);
    expect(screen.getByLabelText("Replies to 9 of 10 applicants")).toBeTruthy();
    expect(screen.getByText(/usually within 1 day/)).toBeTruthy();
  });

  it("links to the owner's profile", () => {
    render(<ListingDetailView listing={makeListing()} />);
    fireEvent.press(screen.getByRole("link"));
    expect(mockPush).toHaveBeenCalledWith("/people/owner-1");
  });
});

describe("OwnerPanel", () => {
  const mutate = jest.fn();
  const mutateAsync = jest.fn().mockResolvedValue({ ok: true });
  beforeEach(() => {
    (useSetListingStatus as jest.Mock).mockReturnValue({ mutate, mutateAsync, isPending: false });
    (useSubmitListing as jest.Mock).mockReturnValue({ mutate, isPending: false });
    (useDeleteDraft as jest.Mock).mockReturnValue({ mutate, isPending: false });
  });

  it("never displays a notice it doesn't recognise (no spoofing via the URL)", () => {
    render(
      <OwnerPanel
        listing={makeListing({ status: "draft" })}
        notice="Your account is suspended. Email support@evil.example now."
      />,
    );
    expect(screen.queryByText(/suspended/)).toBeNull();
  });

  it("shows known notices", () => {
    render(<OwnerPanel listing={makeListing({ status: "in_review" })} notice="submitted" />);
    expect(screen.getByText(/Submitted\. We'll review it/)).toBeTruthy();
  });

  it("offers submit / edit / delete for drafts", () => {
    render(<OwnerPanel listing={makeListing({ status: "draft" })} />);
    fireEvent.press(screen.getByRole("button", { name: "Submit for review" }));
    expect(mutate).toHaveBeenCalledWith("listing-1", expect.any(Object));
    fireEvent.press(screen.getByRole("button", { name: "Edit" }));
    expect(mockPush).toHaveBeenCalledWith("/listing/listing-1/edit");
    expect(screen.getByRole("button", { name: "Delete draft" })).toBeTruthy();
  });

  it("shows the reviewer's note when changes are requested", () => {
    render(
      <OwnerPanel
        listing={makeListing({ status: "changes_requested", review_note: "Add a pay range" })}
      />,
    );
    expect(screen.getByText("Add a pay range")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete draft" })).toBeNull();
  });

  it("pauses a live listing", () => {
    render(<OwnerPanel listing={makeListing({ status: "published" })} />);
    fireEvent.press(screen.getByRole("button", { name: "Pause" }));
    expect(mutate).toHaveBeenCalledWith(
      { projectId: "listing-1", status: "paused" },
      expect.any(Object),
    );
  });

  it("asks before closing, and does nothing if cancelled", async () => {
    (confirm as jest.Mock).mockResolvedValue(false);
    render(<OwnerPanel listing={makeListing({ status: "published" })} />);
    fireEvent.press(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(mutate).not.toHaveBeenCalled();
  });

  it("moves a live listing to draft before opening the editor", async () => {
    (confirm as jest.Mock).mockResolvedValue(true);
    render(<OwnerPanel listing={makeListing({ status: "published" })} />);
    fireEvent.press(screen.getByRole("button", { name: "Edit" }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/listing/listing-1/edit"));
    expect(mutateAsync).toHaveBeenCalledWith({ projectId: "listing-1", status: "draft" });
  });

  it("shows the plan-limit message from the server", async () => {
    (useSubmitListing as jest.Mock).mockReturnValue({
      isPending: false,
      mutate: (_id: string, opts: { onError: (e: unknown) => void }) =>
        opts.onError(
          new FunctionError("Your plan's live listing limit is reached", 409, "LISTING_LIMIT"),
        ),
    });
    render(<OwnerPanel listing={makeListing({ status: "draft" })} />);
    fireEvent.press(screen.getByRole("button", { name: "Submit for review" }));
    expect(await screen.findByText("Your plan's live listing limit is reached")).toBeTruthy();
  });
});

describe("ListingForm", () => {
  it("shows every problem on submit and doesn't save", () => {
    const onSave = jest.fn();
    render(<ListingForm saving={false} onSave={onSave} />);
    fireEvent.press(screen.getByRole("button", { name: "Submit for review" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Give the listing a title")).toBeTruthy();
    expect(screen.getByText("Describe the work in at least 20 characters")).toBeTruthy();
    expect(screen.getByText("Choose how it pays")).toBeTruthy();
    expect(screen.getByText(/error:Add at least one skill/)).toBeTruthy();
    expect(screen.getByText("Fix the highlighted fields to continue.")).toBeTruthy();
  });

  it("validates a field as soon as you leave it", () => {
    render(<ListingForm saving={false} onSave={jest.fn()} />);
    const title = screen.getByLabelText("Title");
    fireEvent.changeText(title, "Hi");
    expect(screen.queryByText("Give the listing a title")).toBeNull();
    fireEvent(title, "blur");
    expect(screen.getByText("Give the listing a title")).toBeTruthy();
    fireEvent.changeText(title, "A proper listing title");
    expect(screen.queryByText("Give the listing a title")).toBeNull();
  });

  it("flags contact details live", () => {
    render(<ListingForm saving={false} onSave={jest.fn()} />);
    const description = screen.getByLabelText("Description");
    fireEvent.changeText(
      description,
      "Great project - email me at founder@startup.io for the brief",
    );
    fireEvent(description, "blur");
    expect(screen.getByText(/Leave out emails, phone numbers and links/)).toBeTruthy();
  });

  it("switches to admission criteria for partnerships", () => {
    render(<ListingForm saving={false} onSave={jest.fn()} />);
    expect(screen.queryByLabelText("What exists today?")).toBeNull();
    fireEvent.press(screen.getByRole("radio", { name: /Partnership/ }));
    expect(screen.getByLabelText("What exists today?")).toBeTruthy();
    expect(screen.queryByText("Pay")).toBeNull();
  });

  it("saves a valid existing listing with its kept and newly added images", async () => {
    const onSave = jest.fn();
    const existing = { id: "img-1", storage_path: "o/l/a.jpg", position: 0, url: "https://cdn/a" };
    render(
      <ListingForm
        initial={makeListing({ status: "draft", images: [existing] })}
        saving={false}
        onSave={onSave}
      />,
    );
    fireEvent.press(screen.getByRole("button", { name: "Add image to Images (optional)" }));
    await waitFor(() => expect(screen.getByText("2 / 4")).toBeTruthy());
    fireEvent.press(screen.getByRole("button", { name: "Save draft" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "React Native developer for a 6-week MVP",
        compensationMin: 450,
      }),
      {
        keep: [existing],
        added: [expect.objectContaining({ uri: "file://picked.jpg" })],
      },
      false,
    );
  });

  it("drops a removed existing image from the save", () => {
    const onSave = jest.fn();
    const existing = { id: "img-1", storage_path: "o/l/a.jpg", position: 0, url: "https://cdn/a" };
    render(
      <ListingForm initial={makeListing({ images: [existing] })} saving={false} onSave={onSave} />,
    );
    fireEvent.press(screen.getByRole("button", { name: "Remove image" }));
    fireEvent.press(screen.getByRole("button", { name: "Submit for review" }));
    expect(onSave).toHaveBeenCalledWith(expect.any(Object), { keep: [], added: [] }, true);
  });
});
