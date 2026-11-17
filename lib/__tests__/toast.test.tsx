import { act, render, screen } from "@testing-library/react-native";
import { ToastHost } from "../../components/Toast";
import { accountChanged, onAccountChange } from "../accountScope";
import { dismissToast, showToast } from "../toast";

type Node = { props: Record<string, unknown>; parent: Node | null } | null;

/** The nearest element at or above `node` whose props match. */
function closest(node: Node, match: (props: Record<string, unknown>) => boolean): Node {
  let current = node;
  while (current && !match(current.props)) current = current.parent;
  return current;
}

describe("toast", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it("shows a confirmation, announces it politely, and takes itself down", async () => {
    await render(<ToastHost />);
    expect(screen.queryByText("Profile saved")).toBeNull();

    await act(() => showToast("Profile saved"));
    const message = screen.getByText("Profile saved");
    expect(message).toBeTruthy();
    // On the bubble that wraps it, so a screen reader hears it without focus moving.
    expect(closest(message, (p) => p.accessibilityLiveRegion === "polite")).toBeTruthy();

    await act(() => jest.advanceTimersByTime(4000));
    expect(screen.queryByText("Profile saved")).toBeNull();
  });

  it("replaces the current message with a newer one", async () => {
    await render(<ToastHost />);
    await act(() => showToast("Application sent"));
    await act(() => showToast("Draft deleted"));
    expect(screen.queryByText("Application sent")).toBeNull();
    expect(screen.getByText("Draft deleted")).toBeTruthy();
  });

  it("never blocks a press on what is underneath", async () => {
    await render(<ToastHost />);
    await act(() => showToast("Profile saved"));
    expect(
      closest(screen.getByText("Profile saved"), (p) => p.pointerEvents === "none"),
    ).toBeTruthy();
  });

  it("an old dismissal doesn't take down a newer message", async () => {
    await render(<ToastHost />);
    await act(() => showToast("First"));
    await act(() => showToast("Second"));
    await act(() => dismissToast(-1));
    expect(screen.getByText("Second")).toBeTruthy();
  });
});

describe("account scope", () => {
  it("runs every registered clean-up when the signed-in person changes", () => {
    const clean = jest.fn();
    onAccountChange(clean);
    accountChanged();
    expect(clean).toHaveBeenCalledTimes(1);
  });
});
