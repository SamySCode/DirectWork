import { renderHook } from "@testing-library/react-native";
import type { Session } from "@supabase/supabase-js";
import { useRouter, useSegments } from "expo-router";
import { useProtectedRoute } from "../hooks";

jest.mock("expo-router", () => ({ useRouter: jest.fn(), useSegments: jest.fn() }));
jest.mock("../../../lib/supabase", () => ({ supabase: {} }));

const replace = jest.fn();
const session = { user: { id: "u1" } } as Session;

function run(segment: string, s: Session | null, hasProfile: boolean | undefined, loading = false) {
  (useSegments as jest.Mock).mockReturnValue([segment]);
  (useRouter as jest.Mock).mockReturnValue({ replace });
  renderHook(() => useProtectedRoute(s, loading, hasProfile));
}

beforeEach(() => replace.mockReset());

describe("useProtectedRoute", () => {
  it("does nothing while the session is loading", () => {
    run("(tabs)", null, undefined, true);
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends signed-out users to the welcome screen", () => {
    run("(tabs)", null, false);
    expect(replace).toHaveBeenCalledWith("/welcome");
  });

  it("lets signed-out users stay on auth screens", () => {
    run("(auth)", null, false);
    expect(replace).not.toHaveBeenCalled();
  });

  it("waits for the profile before deciding", () => {
    run("(tabs)", session, undefined);
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends signed-in users without a profile to onboarding", () => {
    run("(tabs)", session, false);
    expect(replace).toHaveBeenCalledWith("/onboarding");
  });

  it("keeps users on onboarding until they have a profile", () => {
    run("onboarding", session, false);
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(["(auth)", "onboarding"])("moves set-up users from %s to home", (segment) => {
    run(segment, session, true);
    expect(replace).toHaveBeenCalledWith("/home");
  });

  it("never redirects away from the password reset screen", () => {
    run("update-password", null, false);
    run("update-password", session, true);
    expect(replace).not.toHaveBeenCalled();
  });
});
