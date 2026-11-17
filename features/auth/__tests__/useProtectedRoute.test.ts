import { renderHook } from "@testing-library/react-native";
import type { Session } from "@supabase/supabase-js";
import { usePathname, useRouter, useSegments } from "expo-router";
import { useProtectedRoute } from "../hooks";
import { clearReturnTo, peekReturnTo } from "../returnTo";
import { beginSigningOut } from "../signingOut";

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  useSegments: jest.fn(),
  usePathname: jest.fn(),
}));
jest.mock("../../../lib/supabase", () => ({ supabase: {} }));

const replace = jest.fn();
const session = { user: { id: "u1" } } as Session;

async function run(
  segment: string | string[],
  s: Session | null,
  hasProfile: boolean | undefined,
  loading = false,
  needsAcceptance?: boolean,
  pathname = "/somewhere",
) {
  (usePathname as jest.Mock).mockReturnValue(pathname);
  (useSegments as jest.Mock).mockReturnValue(Array.isArray(segment) ? segment : [segment]);
  (useRouter as jest.Mock).mockReturnValue({ replace });
  await renderHook(() => useProtectedRoute(s, loading, hasProfile, needsAcceptance));
}

beforeEach(() => {
  replace.mockReset();
  clearReturnTo();
});

describe("useProtectedRoute", () => {
  it("does nothing while the session is loading", async () => {
    await run("(tabs)", null, undefined, true);
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends signed-out users to the welcome screen", async () => {
    await run("(tabs)", null, false);
    expect(replace).toHaveBeenCalledWith("/welcome");
  });

  it("lets signed-out users stay on auth screens", async () => {
    await run("(auth)", null, false);
    expect(replace).not.toHaveBeenCalled();
  });

  it("waits for the profile before deciding", async () => {
    await run("(tabs)", session, undefined);
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends signed-in users without a profile to onboarding", async () => {
    await run("(tabs)", session, false);
    expect(replace).toHaveBeenCalledWith("/onboarding");
  });

  it("keeps users on onboarding until they have a profile", async () => {
    await run("onboarding", session, false);
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(["(auth)", "onboarding"])("moves set-up users from %s to home", async (segment) => {
    await run(segment, session, true);
    expect(replace).toHaveBeenCalledWith("/home");
  });

  it("never redirects away from the password reset screen", async () => {
    await run("update-password", null, false);
    await run("update-password", session, true);
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([["legal"], ["legal", "[doc]"], ["help"]])(
    "lets anyone read the legal pages and help (%s)",
    async (...segments) => {
      await run(segments, null, false);
      await run(segments, session, false);
      await run(segments, session, true, false, true);
      expect(replace).not.toHaveBeenCalled();
    },
  );

  it("sends people with outdated Terms/Privacy acceptance to the accept screen", async () => {
    await run("(tabs)", session, true, false, true);
    expect(replace).toHaveBeenCalledWith("/legal/accept");
    replace.mockReset();
    await run("onboarding", session, false, false, true);
    expect(replace).toHaveBeenCalledWith("/legal/accept");
  });

  it("keeps people on the accept screen until they accept", async () => {
    await run(["legal", "accept"], session, true, false, true);
    expect(replace).not.toHaveBeenCalled();
  });

  it("moves on from the accept screen once accepted", async () => {
    await run(["legal", "accept"], session, true, false, false);
    expect(replace).toHaveBeenCalledWith("/home");
    replace.mockReset();
    await run(["legal", "accept"], session, false, false, false);
    expect(replace).toHaveBeenCalledWith("/onboarding");
  });

  it("doesn't gate while the acceptance check is unknown or failed", async () => {
    await run("(tabs)", session, true, false, undefined);
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends signed-out people away from the accept screen", async () => {
    await run(["legal", "accept"], null, false);
    expect(replace).toHaveBeenCalledWith("/welcome");
  });
});

describe("returning to a shared link after sign-in", () => {
  const LISTING = "/listing/aaaaaaaa-0000-4000-8000-000000000001";

  it("takes a signed-out visitor to the listing they opened, once they've signed in", async () => {
    await run(["listing", "[id]"], null, false, false, undefined, LISTING);
    expect(replace).toHaveBeenCalledWith("/welcome");
    expect(peekReturnTo()).toBe(LISTING);

    replace.mockReset();
    await run("(auth)", session, true);
    expect(replace).toHaveBeenCalledWith(LISTING);
  });

  it("still points at the listing if the guard runs again before the redirect lands", async () => {
    await run(["listing", "[id]"], null, false, false, undefined, LISTING);
    await run("(auth)", session, true);
    replace.mockReset();
    await run("(auth)", session, true);
    expect(replace).toHaveBeenCalledWith(LISTING);
  });

  it("carries the link through onboarding and the terms screen", async () => {
    await run(["listing", "[id]"], null, false, false, undefined, LISTING);
    replace.mockReset();
    await run("onboarding", session, true);
    expect(replace).toHaveBeenCalledWith(LISTING);

    replace.mockReset();
    await run(["legal", "accept"], session, true, false, false);
    expect(replace).toHaveBeenCalledWith(LISTING);
  });

  it("forgets the link once the person is inside the app", async () => {
    await run(["listing", "[id]"], null, false, false, undefined, LISTING);
    await run(["listing", "[id]"], session, true, false, undefined, LISTING);
    expect(peekReturnTo()).toBeNull();
    replace.mockReset();
    await run("(auth)", session, true);
    expect(replace).toHaveBeenCalledWith("/home");
  });

  it("only remembers pages worth landing on, never forms, settings or odd addresses", async () => {
    for (const path of [
      "/profile",
      "/account/delete",
      "/listing/new",
      LISTING + "/edit",
      "/listing/not-a-real-id",
      "//evil.example/listing/aaaaaaaa-0000-4000-8000-000000000001",
    ]) {
      await run("(tabs)", null, false, false, undefined, path);
      expect(peekReturnTo()).toBeNull();
    }
  });

  it("doesn't send someone back to the page they just signed out from", async () => {
    beginSigningOut();
    await run(["listing", "[id]"], null, false, false, undefined, LISTING);
    expect(replace).toHaveBeenCalledWith("/welcome");
    expect(peekReturnTo()).toBeNull();
  });
});
