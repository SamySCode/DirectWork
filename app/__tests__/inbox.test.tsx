import { render, screen } from "@testing-library/react-native";
import InboxScreen from "../inbox";
import { useActivity, useMarkRead } from "../../features/activity/hooks";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("../../features/auth/SessionProvider", () => ({
  useAuth: () => ({ session: { user: { id: "u1" } } }),
}));
jest.mock("../../features/activity/hooks", () => ({
  useActivity: jest.fn(),
  useMarkRead: jest.fn(),
}));

const markRead = jest.fn();
const item = (id: string, read: boolean) => ({
  id,
  kind: "application_accepted",
  created_at: "2026-11-05T10:00:00Z",
  read_at: read ? "2026-11-05T11:00:00Z" : null,
  project_id: "p1",
  application_id: "a1",
  actor: { id: "o1", full_name: "Tom Ellery", avatar_url: null },
  project: { id: "p1", title: "React Native developer", owner_id: "o1" },
});
const query = (overrides: object) => ({
  data: [item("n1", false), item("n2", true)],
  isPending: false,
  isError: false,
  isFetching: false,
  isFetchedAfterMount: true,
  isRefetching: false,
  refetch: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  (useMarkRead as jest.Mock).mockReturnValue({ mutate: markRead });
});

describe("Inbox", () => {
  it("marks only the unread rows it is showing, after a fresh fetch", () => {
    (useActivity as jest.Mock).mockReturnValue(query({}));
    render(<InboxScreen />);
    expect(markRead).toHaveBeenCalledWith(["n1"]);
  });

  it("doesn't mark a cached list that is still being refreshed", () => {
    (useActivity as jest.Mock).mockReturnValue(
      query({ isFetchedAfterMount: false, isFetching: true }),
    );
    render(<InboxScreen />);
    expect(markRead).not.toHaveBeenCalled();
  });

  it("keeps the list on screen when a refresh fails", () => {
    (useActivity as jest.Mock).mockReturnValue(query({ isError: true }));
    render(<InboxScreen />);
    expect(screen.queryByText("Couldn't load activity")).toBeNull();
    expect(screen.getAllByText(/accepted/i).length).toBeGreaterThan(0);
  });
});
