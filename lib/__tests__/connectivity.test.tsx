import { onlineManager, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { OfflineBanner } from "../../components/OfflineBanner";
import { RouteErrorBoundary } from "../../components/RouteErrorBoundary";
import { checkConnection, isNetworkError, queryClient, reportFailure } from "../query";

const offline = { message: "TypeError: Network request failed", details: "", hint: "", code: "" };
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
const fetchMock = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  onlineManager.setOnline(true);
  queryClient.clear();
});
afterEach(() => {
  onlineManager.setOnline(true);
  jest.useRealTimers();
});

describe("isNetworkError", () => {
  it.each([
    offline,
    new TypeError("Failed to fetch"),
    new TypeError("Load failed"),
    { message: "fetch failed" },
  ])("recognises %p", (error) => expect(isNetworkError(error)).toBe(true));

  it.each([{ code: "42501", message: "permission denied" }, new Error("Not allowed"), null])(
    "ignores %p",
    (error) => expect(isNetworkError(error)).toBe(false),
  );
});

describe("going offline", () => {
  it("a server refusal doesn't count as offline", () => {
    reportFailure({ code: "42501", message: "permission denied" });
    expect(onlineManager.isOnline()).toBe(true);
  });

  it("keeps cached data, pauses instead of erroring, and refetches when back", async () => {
    const load = jest.fn().mockResolvedValueOnce(["cached"]);
    const { result } = renderHook(
      () => {
        const query = useQuery({ queryKey: ["things"], queryFn: load, staleTime: 0, retry: false });
        // Read what a screen reads, so the hook re-renders for it (tracked props).
        void [query.data, query.fetchStatus];
        return query;
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toEqual(["cached"]));

    // The connection drops: this refetch fails...
    load.mockRejectedValueOnce(offline);
    await act(async () => void (await result.current.refetch()));
    expect(result.current.data).toEqual(["cached"]);
    expect(onlineManager.isOnline()).toBe(false);

    // ...and later ones wait rather than fail or hit the network.
    load.mockResolvedValue(["fresh"]);
    act(() => void result.current.refetch());
    await waitFor(() => expect(result.current.fetchStatus).toBe("paused"));
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(["cached"]);

    // The probe fails once (still offline), then succeeds: paused work resumes.
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
    await act(async () => void (await jest.advanceTimersByTimeAsync(5_000)));
    expect(onlineManager.isOnline()).toBe(false);
    fetchMock.mockResolvedValueOnce({ status: 401 });
    await act(async () => void (await jest.advanceTimersByTimeAsync(10_000)));
    expect(onlineManager.isOnline()).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual(["fresh"]));
  });

  it("a mutation attempted offline fails straight away with its error", async () => {
    onlineManager.setOnline(false);
    const save = jest.fn().mockRejectedValue(offline);
    const { result } = renderHook(() => useMutation({ mutationFn: save }), { wrapper });
    act(() => result.current.mutate());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isPaused).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("the banner appears while offline and can check again on demand", async () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole("alert")).toBeNull();
    act(() => reportFailure(offline));
    expect(screen.getByText(/Can't connect right now/)).toBeTruthy();

    fetchMock.mockResolvedValueOnce({ status: 200 });
    fireEvent.press(screen.getByRole("button", { name: "Try connecting now" }));
    await waitFor(() => expect(screen.queryByText(/Can't connect right now/)).toBeNull());
    expect(fetchMock).toHaveBeenCalledWith(
      "https://test-project.supabase.co/auth/v1/health",
      expect.objectContaining({ method: "HEAD" }),
    );
  });

  it("checkConnection makes no request while online", async () => {
    await expect(checkConnection()).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("RouteErrorBoundary", () => {
  it("replaces a crashed screen with a friendly message and a retry", () => {
    const retry = jest.fn().mockResolvedValue(undefined);
    render(<RouteErrorBoundary error={new TypeError("Network request failed")} retry={retry} />);
    expect(screen.getByText("Something broke on this screen")).toBeTruthy();
    expect(screen.queryByText(/TypeError/)).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalled();
  });
});
