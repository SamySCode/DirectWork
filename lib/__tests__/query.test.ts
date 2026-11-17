import { isTransientError } from "../query";
import { isUuid } from "../validation";

describe("isTransientError (one automatic retry only when it can help)", () => {
  it.each([
    ["a network failure", { message: "TypeError: Failed to fetch", code: "" }],
    ["no error object", undefined],
    ["a PostgREST connection error", { code: "PGRST000", message: "db down" }],
    ["an expired token", { code: "PGRST303", message: "JWT expired" }],
    ["a statement timeout", { code: "57014", message: "canceling statement" }],
    ["a deadlock", { code: "40P01", message: "deadlock" }],
    ["a gateway error", { status: 503, message: "unavailable" }],
  ])("retries %s", (_label, error) => {
    expect(isTransientError(error)).toBe(true);
  });

  it.each([
    ["a malformed id", { code: "22P02", message: "invalid input syntax for type uuid" }],
    ["a permission refusal", { code: "42501", message: "permission denied" }],
    ["a rule our SQL raised", { code: "P0001", message: "Not allowed" }],
    ["a bad filter", { code: "PGRST100", message: "parse error" }],
    ["a rate limit", { status: 429, message: "Too many" }],
    ["a function 404", { status: 404, message: "Not found" }],
  ])("doesn't retry %s", (_label, error) => {
    expect(isTransientError(error)).toBe(false);
  });
});

describe("isUuid", () => {
  it("accepts uuids and refuses anything a hand-typed link could carry", () => {
    expect(isUuid("6f1c1c2e-8d1a-4c8e-9d43-2b8f3f9a1e07")).toBe(true);
    expect(isUuid("6F1C1C2E-8D1A-4C8E-9D43-2B8F3F9A1E07")).toBe(true);
    for (const bad of [
      "",
      "garbage",
      "1",
      "../etc",
      "6f1c1c2e-8d1a-4c8e-9d43-2b8f3f9a1e07x",
      null,
    ]) {
      expect(isUuid(bad)).toBe(false);
    }
  });
});
