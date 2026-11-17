import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { DISCOVER_PAGE_SIZE, discoverListings } from "../api";
import { DISCOVER_MAX_PAGES, listingKeys, useDiscover } from "../hooks";

jest.mock("../../../lib/supabase", () => ({ supabase: {} }));
jest.mock("../../../lib/functions", () => ({ runAction: jest.fn() }));
jest.mock("../../auth/SessionProvider", () => ({ useAuth: () => ({ session: null }) }));
jest.mock("../api", () => ({
  ...jest.requireActual("../api"),
  discoverListings: jest.fn(),
}));

const fetchPage = discoverListings as jest.Mock;
/** A full page of fake rows, tagged with its page number. */
const page = (n: number) =>
  Array.from({ length: DISCOVER_PAGE_SIZE }, (_, i) => ({ id: `${n}-${i}`, page: n }));

let client: QueryClient;

function setup() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  // Read what the Discover screen reads while rendering: the query only
  // re-renders for result fields that have been read (tracked props).
  return renderHook(
    () => {
      const query = useDiscover({ query: "", remoteOnly: false });
      void [query.data, query.hasNextPage, query.hasPreviousPage, query.isFetchingNextPage];
      return query;
    },
    { wrapper },
  );
}

afterEach(() => client?.clear());

describe("discover cache key", () => {
  const home = { query: "", remoteOnly: false };

  it("Home and Discover's default view share one cache entry (one request, not two)", () => {
    const discoverTab = {
      query: "",
      type: undefined,
      remoteOnly: false,
      commitment: undefined,
      compensationType: undefined,
      minPay: undefined,
      sort: "newest" as const,
    };
    const hash = (filters: Parameters<typeof listingKeys.discover>[0]) =>
      JSON.stringify(listingKeys.discover(filters));
    expect(hash(discoverTab)).toBe(hash(home));
    // "match" is sorted on the device from the same rows.
    expect(hash({ ...discoverTab, sort: "match" })).toBe(hash(home));
    expect(hash({ ...home, excludeOwners: [] })).toBe(hash(home));
  });

  it("anything that changes the server's answer still gets its own entry", () => {
    const key = (filters: Parameters<typeof listingKeys.discover>[0]) =>
      JSON.stringify(listingKeys.discover(filters));
    for (const other of [
      { ...home, sort: "pay" as const },
      { ...home, type: "paid" as const },
      { ...home, remoteOnly: true },
      { ...home, query: "react" },
      { ...home, minPay: 400 },
      { ...home, excludeOwners: ["b", "a"] },
    ]) {
      expect(key(other)).not.toBe(key(home));
    }
    expect(key({ ...home, excludeOwners: ["b", "a"] })).toBe(
      key({ ...home, excludeOwners: ["a", "b"] }),
    );
  });
});

/** Fetch the next page n times in a row, as scrolling to the end would. */
async function scrollOn(result: { current: ReturnType<typeof useDiscover> }, n: number) {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
  }
}

beforeEach(() => {
  fetchPage.mockReset();
  fetchPage.mockImplementation(async (_filters, n: number) => page(n));
});

describe("useDiscover", () => {
  it("keeps paging past the cap, dropping the oldest page off the top", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasPreviousPage).toBe(false);

    await scrollOn(result, DISCOVER_MAX_PAGES + 1);
    // Pages 0..6 fetched in order (no page fetched twice), only the last 5 kept.
    expect(fetchPage.mock.calls.map(([, n]) => n)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    await waitFor(() => expect(result.current.data?.pageParams).toEqual([2, 3, 4, 5, 6]));
    expect(result.current.data?.pages).toHaveLength(DISCOVER_MAX_PAGES);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.hasPreviousPage).toBe(true);

    // Scrolling back up brings the dropped page back and drops the newest one.
    await act(async () => {
      await result.current.fetchPreviousPage();
    });
    await waitFor(() => expect(result.current.data?.pageParams).toEqual([1, 2, 3, 4, 5]));
    expect(result.current.data?.pages[0]?.[0]).toMatchObject({ page: 1 });
  });

  it("refetches at most the capped number of pages", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await scrollOn(result, DISCOVER_MAX_PAGES + 3);
    fetchPage.mockClear();
    await act(async () => {
      await result.current.refetch();
    });
    expect(fetchPage.mock.calls.map(([, n]) => n)).toEqual([4, 5, 6, 7, 8]);
  });

  it("stops when a page comes back short", async () => {
    fetchPage.mockImplementation(async (_filters, n: number) => (n === 0 ? page(0) : [page(1)[0]]));
    const { result } = setup();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await scrollOn(result, 1);
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(result.current.data?.pageParams).toEqual([0, 1]);
  });
});
