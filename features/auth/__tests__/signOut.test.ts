import { act, renderHook } from "@testing-library/react-native";
import { supabase } from "../../../lib/supabase";
import { signOut } from "../api";
import { endSigningOut, useSigningOut } from "../signingOut";

jest.mock("../../../lib/supabase", () => ({
  supabase: { auth: { getSession: jest.fn(), signOut: jest.fn() } },
}));
jest.mock("../../../lib/functions", () => ({ invokeFunction: jest.fn() }));

const getSession = supabase.auth.getSession as jest.Mock;
const authSignOut = supabase.auth.signOut as jest.Mock;
const signedIn = { data: { session: { user: { id: "user-1" } } } };
const signedOut = { data: { session: null } };

beforeEach(() => {
  jest.clearAllMocks();
  act(() => endSigningOut());
});

describe("signOut", () => {
  it("covers the app from the press, and leaves the cover up for the redirect to lift", async () => {
    getSession.mockResolvedValue(signedIn);
    let finishServerCall: (value: { error: null }) => void = () => {};
    authSignOut.mockReturnValue(new Promise((resolve) => (finishServerCall = resolve)));
    const cover = renderHook(() => useSigningOut());

    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = signOut();
    });
    // Up straight away, before anything has come back.
    expect(cover.result.current).toBe(true);

    await act(async () => {
      finishServerCall({ error: null });
      await done;
    });
    // Still up: the route guard takes it down once it has left the screen.
    expect(cover.result.current).toBe(true);
  });

  it("counts as signed out when the server was unreachable but this device's session is gone", async () => {
    getSession.mockResolvedValueOnce(signedIn).mockResolvedValueOnce(signedOut);
    authSignOut.mockResolvedValue({ error: new Error("Network request failed") });
    await expect(signOut()).resolves.toBeUndefined();
  });

  it("lifts the cover and reports the failure when the person is still signed in", async () => {
    getSession.mockResolvedValue(signedIn);
    authSignOut.mockResolvedValue({ error: new Error("storage unavailable") });
    const cover = renderHook(() => useSigningOut());
    await act(async () => {
      await expect(signOut()).rejects.toThrow("storage unavailable");
    });
    expect(cover.result.current).toBe(false);
  });

  it("doesn't leave the cover up when there was nobody to sign out", async () => {
    getSession.mockResolvedValue(signedOut);
    const cover = renderHook(() => useSigningOut());
    await act(async () => {
      await signOut();
    });
    expect(authSignOut).not.toHaveBeenCalled();
    expect(cover.result.current).toBe(false);
  });
});
