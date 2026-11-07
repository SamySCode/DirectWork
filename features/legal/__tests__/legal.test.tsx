import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import { Platform, Share } from "react-native";
import LegalDocumentScreen from "../../../app/legal/[doc]";
import AcceptLegalScreen from "../../../app/legal/accept";
import LegalIndexScreen from "../../../app/legal/index";
import HelpScreen from "../../../app/help";
import { signUp } from "../../auth/api";
import { useAuth } from "../../auth/SessionProvider";
import { renderWithClient } from "../../../test/utils";
import { supabase } from "../../../lib/supabase";
import { exportFileName, getMyLegalStatus } from "../api";
import { getLegalDocument, legalDocuments, PRIVACY_VERSION, TERMS_VERSION } from "../documents";
import { needsLegalAcceptance } from "../versions";

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useLocalSearchParams: jest.fn(),
}));
jest.mock("expo-linking", () => ({ createURL: (p: string) => p }));
jest.mock("../../../lib/supabase", () => ({
  supabase: { rpc: jest.fn(), auth: { signUp: jest.fn(), signOut: jest.fn() } },
}));
jest.mock("../../auth/SessionProvider", () => ({ useAuth: jest.fn() }));

const rpc = supabase.rpc as jest.Mock;
const signedIn = { session: { user: { id: "u1", email: "sam@example.com" } } };

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue(signedIn);
});

const allText = (slug: string) => JSON.stringify(getLegalDocument(slug));

describe("legal documents", () => {
  it("every document has a version, a date and content", () => {
    for (const doc of legalDocuments) {
      expect(doc.version).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(doc.updated).toBeTruthy();
      expect(doc.sections.length).toBeGreaterThan(0);
    }
    expect(getLegalDocument("terms")!.version).toBe(TERMS_VERSION);
    expect(getLegalDocument("privacy")!.version).toBe(PRIVACY_VERSION);
  });

  it("never overclaims track records or keeps drafting markers", () => {
    for (const doc of legalDocuments) {
      const text = JSON.stringify(doc);
      expect(text).not.toMatch(/⚠|can't fake|\bverified\b/i);
    }
  });

  it("states the key terms", () => {
    const terms = allText("terms");
    expect(terms).toMatch(/18 or over/);
    expect(terms).toMatch(/not a party/);
    expect(terms).toMatch(/free for professionals/i);
    expect(terms).toMatch(/National Minimum Wage/);
    expect(terms).toMatch(/England and Wales/);
  });

  it("names the processors, and leaves Stripe out while billing is off", () => {
    const privacy = allText("privacy");
    for (const name of ["Supabase", "Amazon SES", "Cloudflare", "Expo", "Apple and Google"]) {
      expect(privacy).toContain(name);
    }
    expect(privacy).not.toContain("Stripe");
    expect(privacy).toMatch(/still see it, marked as withdrawn/);
  });

  it("reads operator details from operator.json", () => {
    expect(allText("contact")).toContain("[LEGAL NAME]");
    expect(allText("privacy")).toContain("[PRIVACY EMAIL]");
  });
});

describe("legal acceptance status", () => {
  it("needs acceptance when nothing or an older version was accepted", () => {
    expect(needsLegalAcceptance({ terms_version: null, privacy_version: null })).toBe(true);
    expect(
      needsLegalAcceptance({ terms_version: "2020-01-01", privacy_version: PRIVACY_VERSION }),
    ).toBe(true);
    expect(
      needsLegalAcceptance({ terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION }),
    ).toBe(false);
    // A newer version (accepted on a newer app build) never re-gates an old build.
    expect(
      needsLegalAcceptance({ terms_version: "2099-01-01", privacy_version: "2099-01-01" }),
    ).toBe(false);
  });

  it("reads get_my_legal_status rows", async () => {
    rpc.mockResolvedValue({ data: [{ terms_version: "a", privacy_version: null }], error: null });
    await expect(getMyLegalStatus()).resolves.toEqual({
      terms_version: "a",
      privacy_version: null,
    });
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(getMyLegalStatus()).resolves.toEqual({
      terms_version: null,
      privacy_version: null,
    });
  });
});

describe("sign-up metadata", () => {
  it("passes the accepted versions and age confirmation to Auth", async () => {
    (supabase.auth.signUp as jest.Mock).mockResolvedValue({ data: {}, error: null });
    await signUp({
      email: "sam@example.com",
      password: "long-enough",
      confirmPassword: "long-enough",
      acceptedTerms: true,
    });
    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: {
            terms_version: TERMS_VERSION,
            privacy_version: PRIVACY_VERSION,
            age_confirmed: true,
          },
        }),
      }),
    );
  });
});

describe("legal screens", () => {
  it("lists every document and opens one", () => {
    (useAuth as jest.Mock).mockReturnValue({ session: null });
    render(<LegalIndexScreen />);
    fireEvent.press(screen.getByRole("link", { name: "Deleting your account" }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/legal/[doc]",
      params: { doc: "account-deletion" },
    });
  });

  it("renders a document signed out", () => {
    (useAuth as jest.Mock).mockReturnValue({ session: null });
    (useLocalSearchParams as jest.Mock).mockReturnValue({ doc: "account-deletion" });
    render(<LegalDocumentScreen />);
    expect(screen.getByRole("header", { name: "Deleting your account" })).toBeTruthy();
    expect(screen.getByText(/Go to Profile, then Delete account/)).toBeTruthy();
  });

  it("handles an unknown document", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ doc: "nope" });
    render(<LegalDocumentScreen />);
    fireEvent.press(screen.getByRole("button", { name: "See all documents" }));
    expect(mockReplace).toHaveBeenCalledWith("/legal");
  });

  it("re-acceptance needs the box, then records the current versions", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    renderWithClient(<AcceptLegalScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Accept and continue" }));
    expect(screen.getByText("Tick the box to carry on.")).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole("checkbox"));
    fireEvent.press(screen.getByRole("button", { name: "Accept and continue" }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("record_legal_acceptance", {
        p_terms_version: TERMS_VERSION,
        p_privacy_version: PRIVACY_VERSION,
      }),
    );
  });
});

describe("Help & legal", () => {
  it("shows the contact emails and every document", () => {
    renderWithClient(<HelpScreen />);
    expect(screen.getByText("[SUPPORT EMAIL]")).toBeTruthy();
    expect(screen.getByText("[PRIVACY EMAIL]")).toBeTruthy();
    expect(screen.getByText("[COMPLAINTS EMAIL]")).toBeTruthy();
    for (const doc of legalDocuments) {
      expect(screen.getByRole("link", { name: doc.title })).toBeTruthy();
    }
  });

  it("hides Download my data when signed out", () => {
    (useAuth as jest.Mock).mockReturnValue({ session: null });
    renderWithClient(<HelpScreen />);
    expect(screen.queryByRole("button", { name: "Download my data" })).toBeNull();
  });

  it("exports my data and shares it as JSON", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    rpc.mockResolvedValue({ data: { profile: { full_name: "Sam" } }, error: null });
    renderWithClient(<HelpScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Download my data" }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(rpc).toHaveBeenCalledWith("export_my_data");
    const shared = share.mock.calls[0]![0] as { message: string; title: string };
    expect(JSON.parse(shared.message)).toEqual({ profile: { full_name: "Sam" } });
    expect(shared.title).toBe(exportFileName());
    expect(await screen.findByText(/Your data is ready/)).toBeTruthy();
    expect(Platform.OS).not.toBe("web");
  });

  it("shows an export failure", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("Can't export right now") });
    renderWithClient(<HelpScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Download my data" }));
    expect(await screen.findByText("Can't export right now")).toBeTruthy();
  });
});
