import { Platform } from "react-native";
import { FunctionError, invokeFunction } from "../../../lib/functions";
import { isPro, isStripeUrl, startCheckout } from "../api";

jest.mock("../../../lib/supabase", () => ({ supabase: {} }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));
jest.mock("../../../lib/functions", () => ({
  ...jest.requireActual("../../../lib/functions"),
  invokeFunction: jest.fn(),
}));

const invoke = invokeFunction as jest.Mock;
const WebBrowser = jest.requireMock("expo-web-browser") as { openBrowserAsync: jest.Mock };

beforeEach(() => jest.clearAllMocks());

describe("isStripeUrl", () => {
  it.each([
    ["https://checkout.stripe.com/c/pay/cs_test_123", true],
    ["https://billing.stripe.com/p/session/abc", true],
    ["http://checkout.stripe.com/c/pay", false],
    ["https://checkout.stripe.com.evil.example/c", false],
    ["https://evil.example/?u=checkout.stripe.com", false],
    ["javascript:alert(1)", false],
    ["not a url", false],
  ])("%p -> %p", (url, expected) => {
    expect(isStripeUrl(url)).toBe(expected);
  });
});

describe("startCheckout", () => {
  beforeAll(() => {
    Platform.OS = "ios";
  });

  it("opens Stripe Checkout", async () => {
    invoke.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_1" });
    await startCheckout();
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      "https://checkout.stripe.com/c/pay/cs_1",
    );
  });

  it("sends people who are already on Pro to manage their subscription instead", async () => {
    invoke
      .mockRejectedValueOnce(new FunctionError("You're already on Pro.", 409, "ALREADY_SUBSCRIBED"))
      .mockResolvedValueOnce({ url: "https://billing.stripe.com/p/session/1" });
    await startCheckout();
    expect(invoke).toHaveBeenLastCalledWith("billing", { action: "portal" });
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      "https://billing.stripe.com/p/session/1",
    );
  });

  it("refuses to open anything that isn't Stripe", async () => {
    invoke.mockResolvedValue({ url: "https://evil.example/phish" });
    await expect(startCheckout()).rejects.toThrow(/Billing is unavailable/);
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });
});

describe("isPro", () => {
  it("needs the pro plan, an active-ish status, and a period that hasn't ended", () => {
    const future = "2999-01-01T00:00:00Z";
    expect(isPro({ plan: "pro", status: "active", current_period_end: future })).toBe(true);
    expect(isPro({ plan: "pro", status: "canceled", current_period_end: future })).toBe(false);
    expect(
      isPro({ plan: "pro", status: "active", current_period_end: "2000-01-01T00:00:00Z" }),
    ).toBe(false);
    expect(isPro({ plan: "free", status: "active", current_period_end: null })).toBe(false);
    expect(isPro(null)).toBe(false);
  });
});
