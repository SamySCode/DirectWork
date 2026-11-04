import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import DeleteAccountScreen from "../account/delete";
import EditProfileScreen from "../account/edit";
import { deleteAccount } from "../../features/auth/api";
import ApplicationScreen from "../application/[id]";
import BillingScreen from "../billing";
import EditListingScreen from "../listing/[id]/edit";
import ListingScreen from "../listing/[id]/index";
import PersonScreen from "../people/[id]";
import ReviewScreen from "../review";
import { useIsAdmin } from "../../features/admin/hooks";
import {
  useApplication,
  useListingApplications,
  useWithdrawApplication,
} from "../../features/applications/hooks";
import { useBillingRedirect, useSubscription } from "../../features/billing/hooks";
import { useListing, useReviewListing, useReviewQueue } from "../../features/listings/hooks";
import {
  useMyProfile,
  usePortfolio,
  useProfile,
  useProfileSkills,
  useSaveProfile,
  useTrackRecord,
} from "../../features/profile/hooks";
import { confirm } from "../../lib/confirm";
import { makeApplication, makeListing, makeProfile } from "../../test/fixtures";

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: jest.fn(),
  Stack: { Screen: () => null },
}));
jest.mock("../../lib/supabase", () => ({
  supabase: {
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: p } }) }) },
  },
}));
jest.mock("../../lib/confirm", () => ({ confirm: jest.fn() }));
jest.mock("../../features/billing/availability", () => ({ billingAvailable: true }));
jest.mock("../../features/auth/SessionProvider", () => ({
  useAuth: () => ({ session: { user: { id: "user-1", email: "sam@example.com" } } }),
}));
jest.mock("../../features/auth/api", () => ({ deleteAccount: jest.fn() }));
jest.mock("../../features/admin/hooks", () => ({ useIsAdmin: jest.fn() }));
jest.mock("../../features/billing/hooks", () => ({
  useSubscription: jest.fn(),
  useBillingRedirect: jest.fn(),
}));
jest.mock("../../features/listings/hooks", () => ({
  useListing: jest.fn(),
  useReviewQueue: jest.fn(),
  useReviewListing: jest.fn(),
  useSaveListing: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useSubmitListing: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useSetListingStatus: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useDeleteDraft: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
}));
jest.mock("../../features/applications/hooks", () => ({
  useApplication: jest.fn(),
  useListingApplications: jest.fn(),
  useWithdrawApplication: jest.fn(),
  useMyApplications: jest.fn(() => ({ data: [] })),
  useApply: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useDecideApplication: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useContact: jest.fn(() => ({ data: null, isPending: false })),
  useRecordOutcome: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useAttachmentUrls: jest.fn(() => ({ data: undefined })),
  useAskQuestion: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useAnswerQuestion: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useHasWrittenReference: jest.fn(() => ({ data: false, isPending: false })),
  useWriteReference: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
}));
jest.mock("../../features/safety/hooks", () => ({
  useBlockedIds: jest.fn(() => ({ data: [] })),
  useBlock: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useUnblock: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useReport: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
}));
jest.mock("../../features/activity/hooks", () => ({
  useUnreadCount: jest.fn(() => ({ data: 0 })),
}));
jest.mock("../../features/profile/hooks", () => ({
  useMyProfile: jest.fn(),
  useProfile: jest.fn(),
  useProfileSkills: jest.fn(),
  useTrackRecord: jest.fn(),
  usePortfolio: jest.fn(),
  useSaveProfile: jest.fn(),
  useSetAvatar: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useClearAvatar: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useAddPortfolioImages: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useRemovePortfolioImage: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useReplyRecord: jest.fn(() => ({ data: { received: 1, replied: 1, median_hours: 2 } })),
  useReferences: jest.fn(() => ({ data: [] })),
}));
jest.mock("../../features/profile/components/SkillsField", () => ({ SkillsField: () => null }));

const query = <D,>(data: D, extra: object = {}) => ({
  data,
  isPending: false,
  isError: false,
  isRefetching: false,
  refetch: jest.fn(),
  ...extra,
});
const params = (p: object) => (useLocalSearchParams as jest.Mock).mockReturnValue(p);

beforeEach(() => {
  jest.clearAllMocks();
  (useMyProfile as jest.Mock).mockReturnValue({
    userId: "user-1",
    profile: makeProfile(),
    skills: ["React Native"],
    loading: false,
  });
  (useListingApplications as jest.Mock).mockReturnValue(query([]));
  (usePortfolio as jest.Mock).mockReturnValue(query([]));
});

describe("Listing page", () => {
  it("lets a visitor apply to a live listing", () => {
    params({ id: "listing-1" });
    (useListing as jest.Mock).mockReturnValue(query(makeListing()));
    render(<ListingScreen />);
    expect(screen.getByRole("button", { name: "Apply" })).toBeTruthy();
    expect(screen.queryByText("How it looks to others")).toBeNull();
    expect(screen.getByText("How you fit")).toBeTruthy();
    expect(screen.getByText("1 of 3 skills")).toBeTruthy();
    expect(screen.queryByText("Applicants so far")).toBeNull();
    expect(useListingApplications).toHaveBeenCalledWith(undefined);
  });

  it("doesn't offer apply on a paused listing", () => {
    params({ id: "listing-1" });
    (useListing as jest.Mock).mockReturnValue(query(makeListing({ status: "paused" })));
    render(<ListingScreen />);
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    expect(screen.getByText("Not accepting applications")).toBeTruthy();
  });

  it("gives the owner controls and applicants, not an apply button", () => {
    params({ id: "listing-1" });
    (useListing as jest.Mock).mockReturnValue(query(makeListing({ owner_id: "user-1" })));
    (useListingApplications as jest.Mock).mockReturnValue(query([makeApplication()]));
    render(<ListingScreen />);
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    expect(screen.getByText("Waiting for you (1)")).toBeTruthy();
    expect(screen.getByText("Applicants so far")).toBeTruthy();
    expect(screen.queryByText("How you fit")).toBeNull();
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    expect(useListingApplications).toHaveBeenCalledWith("listing-1");
  });

  it("explains a missing listing", () => {
    params({ id: "gone" });
    (useListing as jest.Mock).mockReturnValue(query(null));
    render(<ListingScreen />);
    expect(screen.getByText("This listing isn't available")).toBeTruthy();
  });
});

describe("Edit listing", () => {
  it("refuses to edit a live listing in place", () => {
    params({ id: "listing-1" });
    (useListing as jest.Mock).mockReturnValue(query(makeListing({ status: "published" })));
    render(<EditListingScreen />);
    expect(screen.getByText("This listing can't be edited right now")).toBeTruthy();
  });
});

describe("Application page", () => {
  it("withdraws a pending application after confirmation", async () => {
    params({ id: "app-1" });
    const mutate = jest.fn();
    (useApplication as jest.Mock).mockReturnValue(query(makeApplication()));
    (useWithdrawApplication as jest.Mock).mockReturnValue({ mutate, isPending: false });
    (confirm as jest.Mock).mockResolvedValue(true);
    render(<ApplicationScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Withdraw application" }));
    await waitFor(() => expect(mutate).toHaveBeenCalledWith("app-1", expect.any(Object)));
  });

  it("shows the owner's decision note and no withdraw once decided", () => {
    params({ id: "app-1" });
    (useApplication as jest.Mock).mockReturnValue(
      query(makeApplication({ status: "rejected", decision_note: "Went with someone local" })),
    );
    (useWithdrawApplication as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
    render(<ApplicationScreen />);
    expect(screen.getByText("Went with someone local")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Withdraw application" })).toBeNull();
  });
});

describe("Public profile", () => {
  it("handles deleted accounts", () => {
    params({ id: "ghost" });
    (useProfile as jest.Mock).mockReturnValue(query(null));
    (useProfileSkills as jest.Mock).mockReturnValue(query([]));
    (useTrackRecord as jest.Mock).mockReturnValue(query(undefined));
    render(<PersonScreen />);
    expect(screen.getByText("This profile doesn't exist")).toBeTruthy();
  });
});

describe("Edit profile", () => {
  it("prefills, validates live, and saves then goes back", () => {
    const mutate = jest.fn((_: unknown, opts: { onSuccess: () => void }) => opts.onSuccess());
    (useSaveProfile as jest.Mock).mockReturnValue({ mutate, isPending: false, isError: false });
    render(<EditProfileScreen />);
    const headline = screen.getByLabelText("Headline");
    expect(headline.props.value).toBe("React Native engineer");
    fireEvent.changeText(headline, "");
    fireEvent(headline, "blur");
    expect(screen.getByText("Enter a short professional headline")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Save profile" }));
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.changeText(headline, "Mobile lead");
    fireEvent.press(screen.getByRole("button", { name: "Save profile" }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ headline: "Mobile lead", skills: ["React Native"] }),
      expect.any(Object),
    );
    expect(mockBack).toHaveBeenCalled();
  });

  it("keeps unsaved edits when the profile refetches (e.g. after a photo change)", () => {
    (useSaveProfile as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
    const { rerender } = render(<EditProfileScreen />);
    fireEvent.changeText(screen.getByLabelText("Headline"), "Typed but not saved");
    (useMyProfile as jest.Mock).mockReturnValue({
      userId: "user-1",
      profile: makeProfile({ avatar_url: "user-1/new.jpg" }),
      skills: ["React Native"],
      loading: false,
    });
    rerender(<EditProfileScreen />);
    expect(screen.getByLabelText("Headline").props.value).toBe("Typed but not saved");
  });
});

describe("Billing", () => {
  it("offers upgrade on Free and portal on Pro", () => {
    params({});
    const mutate = jest.fn();
    (useBillingRedirect as jest.Mock).mockReturnValue({ mutate, isPending: false, isError: false });
    (useSubscription as jest.Mock).mockReturnValue(query(null));
    const { rerender } = render(<BillingScreen />);
    fireEvent.press(screen.getByRole("button", { name: /Upgrade to Pro/ }));
    expect(mutate).toHaveBeenCalledWith("checkout");

    (useSubscription as jest.Mock).mockReturnValue(
      query({ plan: "pro", status: "active", current_period_end: "2999-01-01T00:00:00Z" }),
    );
    rerender(<BillingScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Manage subscription" }));
    expect(mutate).toHaveBeenCalledWith("portal");
  });
});

describe("Review queue", () => {
  it("is reviewers-only", () => {
    (useIsAdmin as jest.Mock).mockReturnValue(query(false));
    (useReviewQueue as jest.Mock).mockReturnValue(query([]));
    render(<ReviewScreen />);
    expect(screen.getByText("Reviewers only")).toBeTruthy();
    expect(useReviewQueue).toHaveBeenCalledWith(false);
  });

  it("requires a note to request changes, and approves", () => {
    const mutate = jest.fn();
    (useIsAdmin as jest.Mock).mockReturnValue(query(true));
    (useReviewQueue as jest.Mock).mockReturnValue(query([makeListing({ status: "in_review" })]));
    (useReviewListing as jest.Mock).mockReturnValue({ mutate, isPending: false });
    render(<ReviewScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Request changes" }));
    expect(screen.getByText("Tell the owner what to change.")).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole("button", { name: "Approve" }));
    expect(mutate).toHaveBeenCalledWith(
      { projectId: "listing-1", approve: true, note: undefined },
      expect.any(Object),
    );
  });
});

describe("Delete account", () => {
  it("lists what will be lost and requires the password", () => {
    render(<DeleteAccountScreen />);
    expect(screen.getByText(/Any Pro subscription/)).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Delete my account permanently" }));
    expect(screen.getByText("Enter your password to confirm.")).toBeTruthy();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("re-checks the password, then deletes", async () => {
    (deleteAccount as jest.Mock).mockResolvedValue(undefined);
    render(<DeleteAccountScreen />);
    fireEvent.changeText(screen.getByLabelText("Your password"), "secret-password");
    fireEvent.press(screen.getByRole("button", { name: "Delete my account permanently" }));
    await waitFor(() =>
      expect(deleteAccount).toHaveBeenCalledWith("sam@example.com", "secret-password"),
    );
  });

  it("shows a wrong password without deleting", async () => {
    (deleteAccount as jest.Mock).mockRejectedValue(new Error("That password isn't right."));
    render(<DeleteAccountScreen />);
    fireEvent.changeText(screen.getByLabelText("Your password"), "nope");
    fireEvent.press(screen.getByRole("button", { name: "Delete my account permanently" }));
    expect(await screen.findByText("That password isn't right.")).toBeTruthy();
  });
});
