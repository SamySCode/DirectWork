import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { getApplication } from "../applications/api";
import { applicationKeys, useApplication } from "../applications/hooks";
import { getListing } from "../listings/api";
import { listingKeys, useListing } from "../listings/hooks";
import { makeApplication, makeListing } from "../../test/fixtures";

jest.mock("../../lib/supabase", () => ({ supabase: {} }));
jest.mock("../../lib/functions", () => ({ runAction: jest.fn(), errorMessage: jest.fn() }));
jest.mock("../auth/SessionProvider", () => ({ useAuth: () => ({ session: null }) }));
jest.mock("../listings/api", () => ({
  ...jest.requireActual("../listings/api"),
  getListing: jest.fn(),
}));
jest.mock("../applications/api", () => ({
  ...jest.requireActual("../applications/api"),
  getApplication: jest.fn(),
}));

const fetchListing = getListing as jest.Mock;
const fetchApplication = getApplication as jest.Mock;

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 30_000 } },
  });
});
afterEach(() => client.clear());

describe("a listing opened from a list", () => {
  // What Discover holds: the card's fields, without the admission criteria.
  const card = makeListing({ id: "l-1", title: "From the card", admission: null });
  const full = { ...card, title: "From the server", admission: { first_milestone: "Ship v1" } };
  const discoverKey = listingKeys.discover({ query: "", remoteOnly: false });

  it("shows the card's data at once, then the full listing when it arrives", async () => {
    client.setQueryData(discoverKey, { pages: [[card]], pageParams: [0] });
    fetchListing.mockResolvedValue(full);

    const { result } = renderHook(() => useListing("l-1", { instant: true }), { wrapper });
    // No loading state: the screen can draw on the very first render.
    expect(result.current.isPending).toBe(false);
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.title).toBe("From the card");

    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    expect(result.current.data?.title).toBe("From the server");
    expect(result.current.data?.admission).toEqual({ first_milestone: "Ship v1" });
  });

  it("finds the row in My listings too", () => {
    client.setQueryData(listingKeys.mine("user-1"), [card]);
    fetchListing.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useListing("l-1", { instant: true }), { wrapper });
    expect(result.current.data?.title).toBe("From the card");
  });

  it("never hands partial data to a caller that didn't ask for it (edit form, Deal Sheet)", () => {
    client.setQueryData(discoverKey, { pages: [[card]], pageParams: [0] });
    fetchListing.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useListing("l-1"), { wrapper });
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("loads normally when no list has it (a link opened directly)", () => {
    fetchListing.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useListing("l-1", { instant: true }), { wrapper });
    expect(result.current.isPending).toBe(true);
  });
});

describe("an application opened from a list", () => {
  const row = makeApplication({ id: "a-1", status: "submitted" });

  it("starts from the list's row and makes no request while that list is fresh", async () => {
    client.setQueryData(applicationKeys.mine("user-1"), [row]);
    const { result } = renderHook(() => useApplication("a-1"), { wrapper });
    expect(result.current.isPending).toBe(false);
    expect(result.current.data?.id).toBe("a-1");
    await Promise.resolve();
    expect(fetchApplication).not.toHaveBeenCalled();
  });

  it("refreshes behind the scenes when the list it came from is old", async () => {
    client.setQueryData(applicationKeys.mine("user-1"), [row], {
      updatedAt: Date.now() - 5 * 60_000,
    });
    fetchApplication.mockResolvedValue({ ...row, status: "accepted" });
    const { result } = renderHook(() => useApplication("a-1"), { wrapper });
    // Shown straight away from the old row...
    expect(result.current.data?.status).toBe("submitted");
    // ...and corrected as soon as the fresh one is back.
    await waitFor(() => expect(result.current.data?.status).toBe("accepted"));
  });

  it("uses the freshest list when two hold the row", () => {
    client.setQueryData(applicationKeys.mine("user-1"), [{ ...row, status: "submitted" }], {
      updatedAt: Date.now() - 20_000,
    });
    client.setQueryData(applicationKeys.forListing("p-1"), [{ ...row, status: "accepted" }], {
      updatedAt: Date.now() - 1_000,
    });
    const { result } = renderHook(() => useApplication("a-1"), { wrapper });
    expect(result.current.data?.status).toBe("accepted");
  });

  it("loads normally when no list has it", () => {
    fetchApplication.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useApplication("a-1"), { wrapper });
    expect(result.current.isPending).toBe(true);
  });
});
