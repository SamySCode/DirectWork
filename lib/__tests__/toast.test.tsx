import { act, render, screen } from "@testing-library/react-native";
import { ToastHost } from "../../components/Toast";
import { accountChanged, onAccountChange } from "../accountScope";
import { dismissToast, showToast } from "../toast";

describe("toast", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it("shows a confirmation, announces it politely, and takes itself down", () => {
    render(<ToastHost />);
    expect(screen.queryByText("Profile saved")).toBeNull();

    act(() => showToast("Profile saved"));
    const message = screen.getByText("Profile saved");
    expect(message).toBeTruthy();
    // On the bubble that wraps it, so a screen reader hears it without focus moving.
    expect(screen.UNSAFE_getByProps({ accessibilityLiveRegion: "polite" })).toBeTruthy();

    act(() => jest.advanceTimersByTime(4000));
    expect(screen.queryByText("Profile saved")).toBeNull();
  });

  it("replaces the current message with a newer one", () => {
    render(<ToastHost />);
    act(() => showToast("Application sent"));
    act(() => showToast("Draft deleted"));
    expect(screen.queryByText("Application sent")).toBeNull();
    expect(screen.getByText("Draft deleted")).toBeTruthy();
  });

  it("never blocks a press on what is underneath", () => {
    render(<ToastHost />);
    act(() => showToast("Profile saved"));
    expect(screen.UNSAFE_getByProps({ pointerEvents: "none" })).toBeTruthy();
  });

  it("an old dismissal doesn't take down a newer message", () => {
    render(<ToastHost />);
    act(() => showToast("First"));
    act(() => showToast("Second"));
    act(() => dismissToast(-1));
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
