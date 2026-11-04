import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import ApplicationsScreen from "../(tabs)/applications/index";
import DiscoverScreen from "../(tabs)/discover/index";
import HomeScreen from "../(tabs)/home";
import ListingsScreen from "../(tabs)/listings/index";
import ProfileScreen from "../(tabs)/profile/index";
import { useIsAdmin } from "../../features/admin/hooks";
import { useIncomingPending, useMyApplications } from "../../features/applications/hooks";
import { deleteAccount } from "../../features/auth/api";
import { useDiscover, useListingQuota, useMyListings } from "../../features/listings/hooks";
import { useMyProfile, usePortfolio, useTrackRecord } from "../../features/profile/hooks";
import { makeApplication, makeListing, makeProfile, T } from "../../test/fixtures";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../../lib/supabase", () => ({
  supabase: {
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: p } }) }) },
  },
}));
jest.mock("../../lib/confirm", () => ({ confirm: jest.fn() }));
jest.mock("../../features/billing/availability", () => ({ billingAvailable: true }));
jest.mock("../../features/auth/api", () => ({ signOut: jest.fn(), deleteAccount: jest.fn() }));
jest.mock("../../features/auth/SessionProvider", () => ({
  useAuth: () => ({ session: { user: { id: "user-1", email: "sam@example.com" } } }),
}));
jest.mock("../../features/admin/hooks", () => ({ useIsAdmin: jest.fn() }));
jest.mock("../../features/insights/hooks", () => ({
  usePlatformPulse: jest.fn(() => ({
    data: { open_to_paid: 40, open_to_partner: 25, live_listings: 12, completed: 7 },
  })),
}));
jest.mock("../../features/applications/hooks", () => ({
  useMyApplications: jest.fn(),
  useIncomingPending: jest.fn(),
}));
jest.mock("../../features/listings/hooks", () => ({
  useDiscover: jest.fn(),
  useMyListings: jest.fn(),
  useListingQuota: jest.fn(),
}));
jest.mock("../../features/profile/hooks", () => ({
  useMyProfile: jest.fn(),
  useTrackRecord: jest.fn(),
  usePortfolio: jest.fn(),
  useReferences: jest.fn(() => ({ data: [] })),
  useConfirmAvailability: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
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

const query = <D,>(data: D, extra: object = {}) => ({
  data,
  isSuccess: true,
  isPending: false,
  isError: false,
  isRefetching: false,
  refetch: jest.fn(),
  ...extra,
});

const me = makeProfile({ seeking_paid: true, wants_to_hire: true });

beforeEach(() => {
  jest.clearAllMocks();
  (useMyProfile as jest.Mock).mockReturnValue({
    userId: "user-1",
    profile: me,
    skills: ["React Native", "TypeScript"],
    loading: false,
    error: null,
    refetch: jest.fn(),
  });
  (useMyApplications as jest.Mock).mockReturnValue(query([]));
  (useIncomingPending as jest.Mock).mockReturnValue(query([]));
  (useMyListings as jest.Mock).mockReturnValue(query([]));
  (useListingQuota as jest.Mock).mockReturnValue(query({ live: 0, max_live: 1 }));
  (useDiscover as jest.Mock).mockReturnValue(
    query(
      { pages: [[]] },
      { hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() },
    ),
  );
  (useTrackRecord as jest.Mock).mockReturnValue(query({ completed: 1, total: 1 }));
  (usePortfolio as jest.Mock).mockReturnValue(query([]));
  (useIsAdmin as jest.Mock).mockReturnValue(query(false));
});

describe("Home", () => {
  it("greets by first name and leads a brand-new user with first steps, not an empty list", () => {
    render(<HomeScreen />);
    expect(screen.getByRole("header", { name: /, Sam$/ })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Your first steps" })).toBeTruthy();
    expect(screen.queryByText("You're all caught up")).toBeNull();
    expect(screen.getByText("Right now on DirectWork")).toBeTruthy();
  });

  it("first steps go to the right place for someone looking for work", () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByRole("button", { name: /Apply to a listing that fits/ }));
    expect(mockPush).toHaveBeenCalledWith("/discover");
  });

  it("someone only hiring is pointed at posting a listing", () => {
    (useMyProfile as jest.Mock).mockReturnValue({
      userId: "user-1",
      profile: makeProfile({ seeking_paid: false, wants_to_hire: true }),
      skills: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<HomeScreen />);
    fireEvent.press(screen.getByRole("button", { name: /Post your first listing/ }));
    expect(mockPush).toHaveBeenCalledWith("/listing/new");
  });

  it("shows 'all caught up' once someone is active", () => {
    (useMyApplications as jest.Mock).mockReturnValue(
      query([makeApplication({ status: "rejected" })]),
    );
    render(<HomeScreen />);
    expect(screen.queryByRole("header", { name: "Your first steps" })).toBeNull();
    expect(screen.getByText("You're all caught up")).toBeTruthy();
  });

  it("builds 'Needs you' from applicants, review notes, acceptances and confirmations", () => {
    (useIncomingPending as jest.Mock).mockReturnValue(
      query([
        makeApplication({
          id: "a",
          project_id: "mine-1",
          project: { id: "mine-1", title: "My listing", status: "published", owner_id: "user-1" },
        }),
        makeApplication({
          id: "b",
          project_id: "mine-1",
          project: { id: "mine-1", title: "My listing", status: "published", owner_id: "user-1" },
        }),
      ]),
    );
    (useMyListings as jest.Mock).mockReturnValue(
      query([makeListing({ id: "mine-2", title: "Needs work", status: "changes_requested" })]),
    );
    (useMyApplications as jest.Mock).mockReturnValue(
      query([
        makeApplication({
          id: "acc",
          status: "accepted",
          project: { id: "p", title: "Accepted gig", status: "published", owner_id: "o" },
        }),
        makeApplication(
          {
            id: "conf",
            status: "accepted",
            project: { id: "q", title: "Wrapping up", status: "published", owner_id: "o" },
          },
          {
            outcome: "completed",
            summary: null,
            confirmed_by_owner_at: T,
            confirmed_by_member_at: null,
          },
        ),
      ]),
    );
    render(<HomeScreen />);
    expect(screen.getByText("2 people want to join")).toBeTruthy();
    expect(screen.getByText("A reviewer asked for changes")).toBeTruthy();
    expect(screen.getByText("You're in - contact details unlocked")).toBeTruthy();
    expect(screen.getByText("They marked this completed - confirm?")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "2 people want to join: My listing" }));
    expect(mockPush).toHaveBeenCalledWith("/listing/mine-1");
  });

  it("picks listings matching your skills, never your own", () => {
    (useDiscover as jest.Mock).mockReturnValue(
      query({
        pages: [
          [
            makeListing({ id: "match", title: "Matching gig" }),
            makeListing({ id: "own", owner_id: "user-1", title: "My own gig" }),
            makeListing({ id: "nomatch", title: "Design job", skills: ["Figma"] }),
          ],
        ],
      }),
    );
    render(<HomeScreen />);
    expect(screen.getByText("Matching gig")).toBeTruthy();
    expect(screen.queryByText("My own gig")).toBeNull();
    expect(screen.queryByText("Design job")).toBeNull();
  });
});

describe("Discover", () => {
  it("shows a clear-filters empty state when filters exclude everything", () => {
    render(<DiscoverScreen />);
    fireEvent.press(screen.getByRole("tab", { name: "Partnerships" }));
    expect(screen.getByText("Nothing matches those filters")).toBeTruthy();
    expect(useDiscover).toHaveBeenLastCalledWith(expect.objectContaining({ type: "partner" }));
    fireEvent.press(screen.getByRole("button", { name: "Clear filters" }));
    expect(useDiscover).toHaveBeenLastCalledWith(expect.objectContaining({ type: undefined }));
  });

  it("debounces search into the query", async () => {
    render(<DiscoverScreen />);
    fireEvent.changeText(screen.getByLabelText("Search listings"), "booking");
    await waitFor(() =>
      expect(useDiscover).toHaveBeenLastCalledWith(expect.objectContaining({ query: "booking" })),
    );
  });

  it("lists other people's listings with a skill-match summary", () => {
    (useDiscover as jest.Mock).mockReturnValue(
      query(
        {
          pages: [
            [
              makeListing({ title: "Match" }),
              makeListing({ id: "x", owner_id: "user-1", title: "Mine" }),
            ],
          ],
        },
        {
          hasNextPage: false,
          isFetchingNextPage: false,
          fetchNextPage: jest.fn(),
        },
      ),
    );
    render(<DiscoverScreen />);
    expect(screen.getByText("Match")).toBeTruthy();
    expect(screen.queryByText("Mine")).toBeNull();
    expect(screen.getByText("1 of 1 shown match your skills")).toBeTruthy();
  });

  it("narrows the list to an in-demand skill", () => {
    (useDiscover as jest.Mock).mockReturnValue(
      query(
        {
          pages: [
            [
              makeListing({ id: "1", title: "Go job A", skills: ["Go", "Postgres"] }),
              makeListing({ id: "2", title: "Go job B", skills: ["Go"] }),
              makeListing({ id: "3", title: "Design job", skills: ["Figma", "Postgres"] }),
            ],
          ],
        },
        { hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() },
      ),
    );
    render(<DiscoverScreen />);
    expect(screen.getByText("In demand right now")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Show listings asking for Go" }));
    expect(screen.getByText("Go job A")).toBeTruthy();
    expect(screen.queryByText("Design job")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Show listings asking for Go" }));
    expect(screen.getByText("Design job")).toBeTruthy();
  });

  it("sends commitment, pay type and minimum pay to the query, as removable chips", async () => {
    render(<DiscoverScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    fireEvent.press(screen.getByRole("button", { name: "Part-time" }));
    fireEvent.press(screen.getByRole("button", { name: "Day rate" }));
    fireEvent.changeText(screen.getByLabelText("Minimum pay in pounds"), "4x00");
    await waitFor(() =>
      expect(useDiscover).toHaveBeenLastCalledWith(
        expect.objectContaining({
          commitment: "part_time",
          compensationType: "daily",
          minPay: 400,
        }),
      ),
    );
    fireEvent.press(screen.getByRole("button", { name: "Done" }));
    fireEvent.press(screen.getByRole("button", { name: "Remove filter: Day rate" }));
    expect(useDiscover).toHaveBeenLastCalledWith(
      expect.objectContaining({ compensationType: undefined, commitment: "part_time" }),
    );
  });

  it("drops pay filters on the Partnerships tab", () => {
    render(<DiscoverScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    fireEvent.press(screen.getByRole("button", { name: "Hourly" }));
    fireEvent.press(screen.getByRole("tab", { name: "Partnerships" }));
    expect(screen.queryByLabelText("Minimum pay in pounds")).toBeNull();
    expect(useDiscover).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "partner", compensationType: undefined }),
    );
  });

  it("sorts by pay on the server and by best match locally", () => {
    (useDiscover as jest.Mock).mockReturnValue(
      query(
        {
          pages: [
            [
              makeListing({ id: "1", title: "Weak match", skills: ["Figma"] }),
              makeListing({
                id: "2",
                title: "Strong match",
                skills: ["React Native", "TypeScript"],
              }),
            ],
          ],
        },
        { hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() },
      ),
    );
    render(<DiscoverScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Highest pay" }));
    expect(useDiscover).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "pay" }));
    fireEvent.press(screen.getByRole("button", { name: "Best match" }));
    expect(useDiscover).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "newest" }));
    const titles = screen
      .getAllByRole("button", { name: /^(Strong|Weak) match$/ })
      .map((node) => node.props.accessibilityLabel);
    expect(titles[0]).toBe("Strong match");
  });

  it("can show only listings that need my skills", () => {
    (useDiscover as jest.Mock).mockReturnValue(
      query(
        {
          pages: [
            [
              makeListing({ id: "1", title: "Design job", skills: ["Figma"] }),
              makeListing({ id: "2", title: "RN job", skills: ["React Native"] }),
            ],
          ],
        },
        { hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() },
      ),
    );
    render(<DiscoverScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    fireEvent.press(screen.getByRole("button", { name: "Needs my skills" }));
    expect(screen.queryByText("Design job")).toBeNull();
    expect(screen.getByText("RN job")).toBeTruthy();
  });

  it("offers retry on error", () => {
    const refetch = jest.fn();
    (useDiscover as jest.Mock).mockReturnValue({ isPending: false, isError: true, refetch });
    render(<DiscoverScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe("Applications tab", () => {
  it("nudges to Discover when empty", () => {
    render(<ApplicationsScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Browse listings" }));
    expect(mockPush).toHaveBeenCalledWith("/discover");
  });

  it("splits in-progress from past and counts them in the header", () => {
    (useMyApplications as jest.Mock).mockReturnValue(
      query([
        makeApplication({
          id: "1",
          project: { id: "p1", title: "Waiting one", status: "published", owner_id: "o" },
        }),
        makeApplication({
          id: "2",
          status: "rejected",
          project: { id: "p2", title: "Old one", status: "published", owner_id: "o" },
        }),
      ]),
    );
    render(<ApplicationsScreen />);
    expect(screen.getByText("In progress")).toBeTruthy();
    expect(screen.getByText("Past")).toBeTruthy();
    expect(screen.getByText("waiting for reply")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Waiting one" }));
    expect(mockPush).toHaveBeenCalledWith("/application/1");
  });
});

describe("Listings tab", () => {
  it("invites you to post the first listing, with live talent and a sourced fact", () => {
    render(<ListingsScreen />);
    expect(screen.getByText("Right now on DirectWork")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Source: CB Insights/ })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Create a listing" }));
    expect(mockPush).toHaveBeenCalledWith("/listing/new");
  });

  it("shows quota and offers more slots at the limit (web billing)", () => {
    (useMyListings as jest.Mock).mockReturnValue(query([makeListing({ owner_id: "user-1" })]));
    (useListingQuota as jest.Mock).mockReturnValue(query({ live: 1, max_live: 1 }));
    render(<ListingsScreen />);
    expect(screen.getByLabelText("1 of 1 live slots used")).toBeTruthy();
    fireEvent.press(screen.getByText("Get more"));
    expect(mockPush).toHaveBeenCalledWith("/billing");
  });
});

describe("Profile tab", () => {
  it("shows the reviewer entry only for admins", () => {
    const { rerender } = render(<ProfileScreen />);
    expect(screen.queryByRole("button", { name: "Review queue" })).toBeNull();
    (useIsAdmin as jest.Mock).mockReturnValue(query(true));
    rerender(<ProfileScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Review queue" }));
    expect(mockPush).toHaveBeenCalledWith("/review");
  });

  it("sends account deletion to its own confirm screen", () => {
    render(<ProfileScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
    expect(mockPush).toHaveBeenCalledWith("/account/delete");
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("nudges toward a stronger profile and opens the editor", () => {
    render(<ProfileScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Add a profile photo" }));
    expect(mockPush).toHaveBeenCalledWith("/account/edit");
  });

  it("puts your name and headline in the header", () => {
    render(<ProfileScreen />);
    expect(screen.getByRole("header", { name: "Sam Saib" })).toBeTruthy();
    expect(screen.getByText("Signed in as sam@example.com")).toBeTruthy();
  });
});
