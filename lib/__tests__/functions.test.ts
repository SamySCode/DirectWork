import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { errorMessage, FunctionError, invokeFunction, runAction } from "../functions";
import { supabase } from "../supabase";

jest.mock("../supabase", () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

const invoke = supabase.functions.invoke as jest.Mock;

function httpError(status: number, body: unknown) {
  return new FunctionsHttpError(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => invoke.mockReset());

describe("invokeFunction", () => {
  it("returns data on success", async () => {
    invoke.mockResolvedValue({ data: { url: "https://x" }, error: null });
    await expect(invokeFunction("billing", { action: "checkout" })).resolves.toEqual({
      url: "https://x",
    });
    expect(invoke).toHaveBeenCalledWith("billing", { body: { action: "checkout" } });
  });

  it("surfaces the server's message, status and code instead of a generic error", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(409, {
        error: "Your plan's live listing limit is reached",
        code: "LISTING_LIMIT",
      }),
    });
    const error = await invokeFunction("actions", {}).catch((e) => e);
    expect(error).toBeInstanceOf(FunctionError);
    expect(error).toMatchObject({
      message: "Your plan's live listing limit is reached",
      status: 409,
      code: "LISTING_LIMIT",
    });
  });

  it("falls back to a readable message when the error body isn't JSON", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response("<html>bad gateway</html>", { status: 502 })),
    });
    await expect(invokeFunction("actions", {})).rejects.toMatchObject({
      message: "Something went wrong. Try again.",
      status: 502,
    });
  });

  it("reports network failures as a connection problem", async () => {
    invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError("offline") });
    await expect(invokeFunction("actions", {})).rejects.toMatchObject({
      message: expect.stringMatching(/Check your connection/),
      status: 0,
    });
  });
});

describe("runAction", () => {
  it("posts the typed payload to the actions gate", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await runAction({ action: "withdraw_application", applicationId: "abc" });
    expect(invoke).toHaveBeenCalledWith("actions", {
      body: { action: "withdraw_application", applicationId: "abc" },
    });
  });
});

describe("errorMessage", () => {
  it("uses Error messages and a fallback for anything else", () => {
    expect(errorMessage(new Error("Nope"))).toBe("Nope");
    expect(errorMessage("string thrown")).toBe("Something went wrong. Try again.");
  });
});

describe("errorMessage keeps internals out of the UI", () => {
  it("hides raw database errors but keeps intentional rule messages", () => {
    const raw = {
      code: "42501",
      details: null,
      hint: null,
      message: "permission denied for table projects",
    };
    const rule = {
      code: "P0001",
      details: null,
      hint: null,
      message: "This listing is not accepting applications",
    };
    expect(errorMessage(raw)).toBe("Something went wrong. Try again.");
    expect(errorMessage(rule)).toBe("This listing is not accepting applications");
  });

  it("explains the contact-details rule, but not other check violations", () => {
    const check = (constraint: string) => ({
      code: "23514",
      details: null,
      hint: null,
      message: `new row for relation "profiles" violates check constraint "${constraint}"`,
    });
    expect(errorMessage(check("profiles_details_no_contact"))).toMatch(/Leave out emails/);
    expect(errorMessage(check("profiles_avatar_path"))).toBe("Something went wrong. Try again.");
  });

  it("explains a request that never reached the server", () => {
    const offline = /Can't reach DirectWork/;
    expect(errorMessage(new TypeError("Failed to fetch"))).toMatch(offline);
    expect(errorMessage(new TypeError("Network request failed"))).toMatch(offline);
    expect(errorMessage({ name: "AuthRetryableFetchError", message: "{}", status: 0 })).toMatch(
      offline,
    );
    expect(
      errorMessage({ code: "", details: "", hint: "", message: "TypeError: Failed to fetch" }),
    ).toMatch(offline);
  });

  it("hides storage errors", () => {
    expect(
      errorMessage({
        __isStorageError: true,
        message: "new row violates row-level security policy",
      }),
    ).toBe("That upload didn't work. Try again.");
  });

  it("passes our own errors through", () => {
    expect(
      errorMessage(new FunctionError("You're already on Pro.", 409, "ALREADY_SUBSCRIBED")),
    ).toBe("You're already on Pro.");
    expect(errorMessage(new Error(""))).toBe("Something went wrong. Try again.");
  });
});
