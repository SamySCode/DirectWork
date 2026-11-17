import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import SignInScreen from "../(auth)/sign-in";
import { resendConfirmation, signIn } from "../../features/auth/api";
import { parseAuthLink } from "../../features/auth/useAuthLink";
import { supabase } from "../../lib/supabase";

// Email-link journeys on the sign-in screen (J-04, J-05). Kept apart from
// auth-screens.test.tsx, which covers the forms themselves.
jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    Link: ({ children }: { children: string }) => <Text accessibilityRole="link">{children}</Text>,
  };
});
let mockLinkingUrl: string | null = null;
jest.mock("expo-linking", () => ({
  useLinkingURL: () => mockLinkingUrl,
  createURL: (p: string) => p,
}));
jest.mock("../../lib/supabase", () => ({
  supabase: { auth: { exchangeCodeForSession: jest.fn(), getSession: jest.fn() } },
}));
jest.mock("../../features/auth/api", () => ({
  signIn: jest.fn(),
  resendConfirmation: jest.fn(),
}));

const exchange = supabase.auth.exchangeCodeForSession as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockLinkingUrl = null;
});

describe("parseAuthLink", () => {
  it("reads the code and error codes from the query or the fragment", () => {
    expect(parseAuthLink("directwork://sign-in?code=abc")).toEqual({
      code: "abc",
      errorCode: null,
    });
    expect(
      parseAuthLink(
        "https://app.example/sign-in#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid",
      ),
    ).toEqual({ code: null, errorCode: "otp_expired" });
    expect(parseAuthLink("directwork://sign-in?error=server_error")).toEqual({
      code: null,
      errorCode: "server_error",
    });
    expect(parseAuthLink(null)).toEqual({ code: null, errorCode: null });
  });
});

describe("Sign in from a confirmation link", () => {
  it("shows a plain form without a link", async () => {
    await render(<SignInScreen />);
    expect(screen.queryByText(/confirmed/i)).toBeNull();
    expect(exchange).not.toHaveBeenCalled();
  });

  it("exchanges the code and says it's signing you in", async () => {
    let finish: (value: unknown) => void = () => {};
    exchange.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    mockLinkingUrl = "directwork://sign-in?code=abc123";
    await render(<SignInScreen />);
    expect(exchange).toHaveBeenCalledWith("abc123");
    expect(screen.getByText("Confirming your email…")).toBeTruthy();
    await act(async () => finish({ data: { session: {} }, error: null }));
    expect(screen.getByText("Email confirmed. Signing you in…")).toBeTruthy();
  });

  it("says the email is confirmed when this device can't finish the sign-in", async () => {
    exchange.mockResolvedValue({ data: null, error: { message: "code verifier missing" } });
    mockLinkingUrl = "directwork://sign-in?code=abc123";
    await render(<SignInScreen />);
    expect(await screen.findByText("Your email is confirmed. Sign in to continue.")).toBeTruthy();
  });

  it("explains an expired link", async () => {
    mockLinkingUrl = "directwork://sign-in#error=access_denied&error_code=otp_expired";
    await render(<SignInScreen />);
    expect(
      screen.getByText("That link has expired. Sign in and we'll send a new one."),
    ).toBeTruthy();
    expect(exchange).not.toHaveBeenCalled();
  });

  it("explains other link errors", async () => {
    mockLinkingUrl = "directwork://sign-in?error=access_denied&error_code=bad_code";
    await render(<SignInScreen />);
    expect(screen.getByText(/That link didn't work/)).toBeTruthy();
  });

  it("lets an unconfirmed account resend straight away", async () => {
    (signIn as jest.Mock).mockRejectedValue(
      Object.assign(new Error("Email not confirmed"), { code: "email_not_confirmed" }),
    );
    (resendConfirmation as jest.Mock).mockResolvedValue(undefined);
    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText("Email"), "sam@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "whatever");
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Confirm your email first")).toBeTruthy();
    // Nothing was sent just now, so there's no cooldown to wait out.
    const resend = screen.getByRole("button", { name: "Resend email" });
    expect(resend).toBeEnabled();
    await fireEvent.press(resend);
    await waitFor(() => expect(resendConfirmation).toHaveBeenCalledWith("sam@example.com"));
    expect(await screen.findByText(/Sent again/)).toBeTruthy();
  });
});
