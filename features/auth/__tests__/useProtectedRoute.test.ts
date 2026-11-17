import { renderHook } from "@testing-library/react-native";
import type { Session } from "@supabase/supabase-js";
import { useRouter, useSegments } from "expo-router";
import { useProtectedRoute } from "../hooks";

jest.mock("expo-router", () => ({ useRouter: jest.fn(), useSegments: jest.fn() }));
jest.mock("../../../lib/supabase", () => ({ supabase: {} }));

const replace = jest.fn();
const session = { user: { id: "u1" } } as Session;

function run(
  segment: string | string[],
  s: Session | null,
  hasProfile: boolean | undefined,
  loading = false,
  needsAcceptance?: boolean,
) {
  (useSegments as jest.Mock).mockReturnValue(Array.isArray(segment) ? segment : [segment]);
  (useRouter as jest.Mock).mockReturnValue({ replace });
  renderHook(() => useProtectedRoute(s, loading, hasProfile, needsAcceptance));
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

  it.each([["legal"], ["legal", "[doc]"], ["help"]])(
    "lets anyone read the legal pages and help (%s)",
    (...segments) => {
      run(segments, null, false);
      run(segments, session, false);
      run(segments, session, true, false, true);
      expect(replace).not.toHaveBeenCalled();
    },
  );

  it("sends people with outdated Terms/Privacy acceptance to the accept screen", () => {
    run("(tabs)", session, true, false, true);
    expect(replace).toHaveBeenCalledWith("/legal/accept");
    replace.mockReset();
    run("onboarding", session, false, false, true);
    expect(replace).toHaveBeenCalledWith("/legal/accept");
  });

  it("keeps people on the accept screen until they accept", () => {
    run(["legal", "accept"], session, true, false, true);
    expect(replace).not.toHaveBeenCalled();
  });

  it("moves on from the accept screen once accepted", () => {
    run(["legal", "accept"], session, true, false, false);
    expect(replace).toHaveBeenCalledWith("/home");
    replace.mockReset();
    run(["legal", "accept"], session, false, false, false);
    expect(replace).toHaveBeenCalledWith("/onboarding");
  });

  it("doesn't gate while the acceptance check is unknown or failed", () => {
    run("(tabs)", session, true, false, undefined);
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends signed-out people away from the accept screen", () => {
    run(["legal", "accept"], null, false);
    expect(replace).toHaveBeenCalledWith("/welcome");
  });
});
