import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import SignInScreen from "../../../app/(auth)/sign-in";
import { signIn } from "../api";
import { forgetEmail, getRememberedEmail, rememberEmail } from "../rememberedEmail";
import { getLegalDocument } from "../../legal/documents";

jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    Link: ({ children }: { children: string }) => <Text accessibilityRole="link">{children}</Text>,
  };
});
jest.mock("expo-linking", () => ({ useLinkingURL: () => null, createURL: (p: string) => p }));
jest.mock("../../../lib/supabase", () => ({ supabase: { auth: {} } }));
jest.mock("../api", () => ({ signIn: jest.fn(), resendConfirmation: jest.fn() }));
jest.mock("../SessionProvider", () => ({ useAuth: () => ({ session: null }) }));
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void store.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void store.delete(key)),
  };
});

const box = () => screen.getByRole("checkbox", { name: "Remember my email on this device" });

async function signInAs(email: string) {
  fireEvent.changeText(screen.getByLabelText("Email"), email);
  fireEvent.changeText(screen.getByLabelText("Password"), "secret-password");
  fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(signIn).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled());
}

beforeEach(async () => {
  jest.clearAllMocks();
  (signIn as jest.Mock).mockResolvedValue({});
  await forgetEmail();
});

describe("remember my email (opt-in)", () => {
  it("is unticked by default and stores nothing unless ticked", async () => {
    render(<SignInScreen />);
    expect(box().props.accessibilityState).toMatchObject({ checked: false });
    await signInAs("sam@example.com");
    expect(await getRememberedEmail()).toBeNull();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("keeps the email when ticked, and fills the form next time", async () => {
    const first = render(<SignInScreen />);
    fireEvent.press(box());
    await signInAs("  sam@example.com ");
    expect(await getRememberedEmail()).toBe("sam@example.com");
    first.unmount();

    render(<SignInScreen />);
    await waitFor(() => expect(screen.getByLabelText("Email").props.value).toBe("sam@example.com"));
    expect(box().props.accessibilityState).toMatchObject({ checked: true });
  });

  it("forgets it the moment the box is unticked, before any sign-in", async () => {
    await rememberEmail("sam@example.com");
    render(<SignInScreen />);
    await waitFor(() => expect(box().props.accessibilityState).toMatchObject({ checked: true }));
    fireEvent.press(box());
    await waitFor(async () => expect(await getRememberedEmail()).toBeNull());
    expect(signIn).not.toHaveBeenCalled();
  });

  it("says where it's kept and how to undo it, next to the box", () => {
    render(<SignInScreen />);
    expect(screen.getByText(/Kept only on this device and never sent to us/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "About device storage" })).toBeTruthy();
  });

  it("uses the browser's local storage on the web", async () => {
    jest.replaceProperty(Platform, "OS", "web");
    const data = new Map<string, string>();
    const local = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
    Object.defineProperty(window, "localStorage", { value: local, configurable: true });
    await rememberEmail("sam@example.com");
    expect(await getRememberedEmail()).toBe("sam@example.com");
    await forgetEmail();
    expect(await getRememberedEmail()).toBeNull();
    jest.restoreAllMocks();
  });
});

describe("the notices describe it", () => {
  const text = (slug: string) => JSON.stringify(getLegalDocument(slug));

  it("the Privacy Notice names consent as the basis and how to withdraw it", () => {
    const privacy = text("privacy");
    expect(privacy).not.toContain("We don't rely on your consent for anything");
    expect(privacy).toContain("Remember my email on this device");
    expect(privacy).toContain("withdraw your consent at any time");
  });

  it("the Cookies & Storage notice lists it as the one optional item", () => {
    const cookies = text("cookies");
    expect(cookies).not.toContain("Strictly necessary only.");
    expect(cookies).toContain("Remember my email on this device");
    expect(cookies).toContain("To forget a remembered email, untick");
  });
});
