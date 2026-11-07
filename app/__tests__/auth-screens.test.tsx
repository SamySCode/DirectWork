import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import ForgotPasswordScreen from "../(auth)/forgot-password";
import SignInScreen from "../(auth)/sign-in";
import SignUpScreen from "../(auth)/sign-up";
import WelcomeScreen from "../(auth)/welcome";
import UpdatePasswordScreen from "../update-password";
import { act } from "@testing-library/react-native";
import { requestPasswordReset, resendConfirmation, signIn, signUp } from "../../features/auth/api";
import { useAuth } from "../../features/auth/SessionProvider";
import { supabase } from "../../lib/supabase";

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  return {
    useRouter: () => ({ push: mockPush, replace: mockReplace }),
    Link: ({ href, children }: { href: string; children: string }) => (
      <Text accessibilityRole="link" onPress={() => mockPush(href)}>
        {children}
      </Text>
    ),
  };
});
let mockLinkingUrl: string | null = null;
jest.mock("expo-linking", () => ({
  useLinkingURL: () => mockLinkingUrl,
  createURL: (p: string) => p,
  parse: (url: string) => ({ queryParams: { code: new URL(url).searchParams.get("code") } }),
}));
jest.mock("../../lib/supabase", () => ({
  supabase: {
    auth: { updateUser: jest.fn(), setSession: jest.fn(), exchangeCodeForSession: jest.fn() },
  },
}));
jest.mock("../../features/auth/api", () => ({
  signIn: jest.fn(),
  signUp: jest.fn(),
  requestPasswordReset: jest.fn(),
  resendConfirmation: jest.fn(),
}));
jest.mock("../../features/auth/SessionProvider", () => ({ useAuth: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  mockLinkingUrl = null;
});

describe("Welcome", () => {
  it("routes to sign-up and sign-in", () => {
    render(<WelcomeScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Create your profile" }));
    expect(mockPush).toHaveBeenCalledWith("/sign-up");
    fireEvent.press(screen.getByRole("button", { name: "I already have an account" }));
    expect(mockPush).toHaveBeenCalledWith("/sign-in");
  });

  it("links to the Terms, Privacy Notice and Help", () => {
    render(<WelcomeScreen />);
    fireEvent.press(screen.getByRole("link", { name: "Terms" }));
    expect(mockPush).toHaveBeenCalledWith("/legal/terms");
    fireEvent.press(screen.getByRole("link", { name: "Privacy" }));
    expect(mockPush).toHaveBeenCalledWith("/legal/privacy");
    fireEvent.press(screen.getByRole("link", { name: "Help" }));
    expect(mockPush).toHaveBeenCalledWith("/help");
  });

  it("states the professional promise", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("Free for professionals, always.")).toBeTruthy();
  });
});

describe("Sign in", () => {
  it("validates before calling the server", () => {
    render(<SignInScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Enter a valid email address")).toBeTruthy();
    expect(screen.getByText("Enter your password")).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("signs in with trimmed credentials", async () => {
    (signIn as jest.Mock).mockResolvedValue({});
    render(<SignInScreen />);
    fireEvent.changeText(screen.getByLabelText("Email"), "  sam@example.com ");
    fireEvent.changeText(screen.getByLabelText("Password"), "secret-password");
    fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith({
        email: "sam@example.com",
        password: "secret-password",
      }),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled());
  });

  it("shows the server error", async () => {
    (signIn as jest.Mock).mockRejectedValue(new Error("Invalid login credentials"));
    render(<SignInScreen />);
    fireEvent.changeText(screen.getByLabelText("Email"), "sam@example.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "wrong");
    fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Invalid login credentials")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled());
  });
});

describe("Sign up", () => {
  it("requires matching passwords of 10+ characters", () => {
    render(<SignUpScreen />);
    fireEvent.changeText(screen.getByLabelText("Email"), "sam@example.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "short");
    fireEvent.changeText(screen.getByLabelText("Confirm password"), "different");
    fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("Password must be at least 10 characters")).toBeTruthy();
    expect(screen.getByText("Passwords don't match")).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("asks you to confirm by email after signing up", async () => {
    (signUp as jest.Mock).mockResolvedValue({});
    render(<SignUpScreen />);
    fireEvent.changeText(screen.getByLabelText("Email"), "sam@example.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "long-enough");
    fireEvent.changeText(screen.getByLabelText("Confirm password"), "long-enough");
    fireEvent.press(screen.getByRole("checkbox"));
    fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Check your email")).toBeTruthy();
    expect(screen.getByText(/sam@example.com/)).toBeTruthy();
  });
});

describe("Sign-up legal acceptance", () => {
  const fill = () => {
    render(<SignUpScreen />);
    fireEvent.changeText(screen.getByLabelText("Email"), "sam@example.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "long-enough");
    fireEvent.changeText(screen.getByLabelText("Confirm password"), "long-enough");
  };

  it("requires the 18+ and Terms checkbox", () => {
    fill();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(
      screen.getByText("Confirm you're 18 or over and accept the Terms to create an account"),
    ).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("signs up once the box is ticked", async () => {
    (signUp as jest.Mock).mockResolvedValue({});
    fill();
    fireEvent.press(
      screen.getByRole("checkbox", {
        name: "I'm 18 or over, I agree to the Terms of Service, and I've read the Privacy Notice",
      }),
    );
    expect(screen.getByRole("checkbox")).toBeChecked();
    fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith(expect.objectContaining({ acceptedTerms: true })),
    );
  });

  it("opens the Terms and Privacy Notice", () => {
    render(<SignUpScreen />);
    fireEvent.press(screen.getByRole("link", { name: "Terms of Service" }));
    expect(mockPush).toHaveBeenCalledWith("/legal/terms");
    fireEvent.press(screen.getByRole("link", { name: "Privacy Notice" }));
    expect(mockPush).toHaveBeenCalledWith("/legal/privacy");
  });
});

describe("Forgot password", () => {
  it("doesn't reveal whether the account exists", async () => {
    (requestPasswordReset as jest.Mock).mockResolvedValue(undefined);
    render(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByLabelText("Email"), "anyone@example.com");
    fireEvent.press(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText(/If an account exists for anyone@example.com/)).toBeTruthy();
  });
});

describe("Update password", () => {
  it("explains an expired link when there's no recovery session", () => {
    (useAuth as jest.Mock).mockReturnValue({ session: null });
    render(<UpdatePasswordScreen />);
    expect(screen.getByText("This reset link didn't work")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Request a new link" }));
    expect(mockReplace).toHaveBeenCalledWith("/forgot-password");
  });

  it("waits for the link's code instead of flashing an error", async () => {
    (useAuth as jest.Mock).mockReturnValue({ session: null });
    let finish: (value: unknown) => void = () => {};
    (supabase.auth.exchangeCodeForSession as jest.Mock).mockReturnValue(
      new Promise((resolve) => (finish = resolve)),
    );
    mockLinkingUrl = "directwork://update-password?code=abc123";
    render(<UpdatePasswordScreen />);
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(screen.queryByText("This reset link didn't work")).toBeNull();
    await act(async () => finish({ error: { message: "invalid" } }));
    expect(screen.getByText("This reset link didn't work")).toBeTruthy();
  });

  it("saves the new password and goes home", async () => {
    (useAuth as jest.Mock).mockReturnValue({ session: { user: { id: "u1" } } });
    (supabase.auth.updateUser as jest.Mock).mockResolvedValue({ error: null });
    render(<UpdatePasswordScreen />);
    fireEvent.changeText(screen.getByLabelText("New password"), "brand-new-pass");
    fireEvent.changeText(screen.getByLabelText("Confirm new password"), "brand-new-pass");
    fireEvent.press(screen.getByRole("button", { name: "Save new password" }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/home"));
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "brand-new-pass" });
  });
});

describe("Sign-up journey", () => {
  async function signUpAs(email: string) {
    (signUp as jest.Mock).mockResolvedValue({});
    render(<SignUpScreen />);
    fireEvent.changeText(screen.getByLabelText("Email"), email);
    fireEvent.changeText(screen.getByLabelText("Password"), "long-enough");
    fireEvent.changeText(screen.getByLabelText("Confirm password"), "long-enough");
    fireEvent.press(screen.getByRole("checkbox"));
    fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    await screen.findByText("Check your email");
  }

  afterEach(() => jest.useRealTimers());

  it("states the password rule up front", () => {
    render(<SignUpScreen />);
    expect(screen.getByText("At least 10 characters.")).toBeTruthy();
  });

  it("lets you show the password you typed", () => {
    render(<SignUpScreen />);
    const field = screen.getByLabelText("Password");
    expect(field.props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getAllByRole("button", { name: "Show password" })[0]!);
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(false);
  });

  it("offers a resend after a cooldown, and confirms it went", async () => {
    jest.useFakeTimers();
    (resendConfirmation as jest.Mock).mockResolvedValue(undefined);
    await signUpAs("sam@example.com");
    expect(screen.getByRole("button", { name: /Resend email in 60s/ })).toBeDisabled();
    await act(async () => {
      jest.advanceTimersByTime(61_000);
    });
    fireEvent.press(screen.getByRole("button", { name: "Resend email" }));
    expect(await screen.findByText(/Sent again/)).toBeTruthy();
    expect(resendConfirmation).toHaveBeenCalledWith("sam@example.com");
  });

  it("goes back to fix a mistyped address", async () => {
    await signUpAs("sam@exmaple.com");
    fireEvent.press(screen.getByRole("button", { name: "Use a different email" }));
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
  });
});

describe("Sign-in recovery paths", () => {
  const attempt = async () => {
    render(<SignInScreen />);
    fireEvent.changeText(screen.getByLabelText("Email"), "sam@example.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "whatever");
    fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
  };

  it("turns 'email not confirmed' into a resend, not an error", async () => {
    (signIn as jest.Mock).mockRejectedValue(
      Object.assign(new Error("Email not confirmed"), { code: "email_not_confirmed" }),
    );
    await attempt();
    expect(await screen.findByText("Confirm your email first")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Resend email/ })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled());
  });

  it("explains wrong credentials and points at the reset", async () => {
    (signIn as jest.Mock).mockRejectedValue(
      Object.assign(new Error("Invalid login credentials"), { code: "invalid_credentials" }),
    );
    await attempt();
    expect(await screen.findByText(/don't match/)).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled());
  });
});
