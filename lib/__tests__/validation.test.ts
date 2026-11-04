import { act, renderHook } from "@testing-library/react-native";
import { z } from "zod";
import {
  CONTACT_DETAILS_MESSAGE,
  fieldErrors,
  hasContactDetails,
  useFormValidation,
} from "../validation";

describe("hasContactDetails", () => {
  // Same cases as supabase/tests/db/db.test.mjs "content rules" - the client
  // check must agree with private.has_contact_details().
  it.each([
    "Email me at founder@startup.io for details please",
    "Call me on +44 7700 900123 to discuss the project",
    "See https://example.com/brief for the full brief here",
    "Full brief at www.example.com before you apply",
    "UK mobile 07700900123",
    "(020) 7946 0958",
    "FIRST.LAST+tag@Sub.Domain.co.uk",
    "http://insecure.example",
  ])("flags %p", (text) => {
    expect(hasContactDetails(text)).toBe(true);
  });

  it.each([
    "We have 14 clinics, £1,800 MRR, built with Node.js in 2024-2025.",
    "Looking for a React Native dev for 6 weeks",
    "12% equity, 4-year vest, 1-year cliff",
    "Next.js and Vue.js experience preferred",
    "Budget £3,000 to £4,000",
    "Dates: 01/02/2026 - 15/03/2026",
    "",
  ])("allows %p", (text) => {
    expect(hasContactDetails(text)).toBe(false);
  });

  it("treats null and undefined as clean", () => {
    expect(hasContactDetails(null)).toBe(false);
    expect(hasContactDetails(undefined)).toBe(false);
  });
});

describe("fieldErrors", () => {
  const schema = z.object({
    name: z.string().min(1, "Name required"),
    nested: z.object({ milestone: z.string().min(3, "Milestone too short") }),
  });

  it("keys errors by the field that can fix them, including nested fields", () => {
    const result = schema.safeParse({ name: "", nested: { milestone: "x" } });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldErrors(result.error)).toEqual({
      name: "Name required",
      milestone: "Milestone too short",
    });
  });

  it("keeps the first message when a field has several issues", () => {
    const multi = z.object({
      code: z.string().min(5, "Too short").regex(/^\d+$/, "Digits only"),
    });
    const result = multi.safeParse({ code: "ab" });
    if (result.success) throw new Error("expected failure");
    expect(fieldErrors(result.error).code).toBe("Too short");
  });
});

describe("useFormValidation", () => {
  const schema = z.object({
    title: z.string().min(3, "Title too short"),
    body: z.string().min(5, "Body too short"),
  });

  it("hides errors until a field is touched, then keeps them live", () => {
    const { result, rerender } = renderHook(
      ({ values }: { values: { title: string; body: string } }) =>
        useFormValidation(schema, values),
      { initialProps: { values: { title: "", body: "" } } },
    );
    expect(result.current.errors).toEqual({});

    act(() => result.current.touch("title"));
    expect(result.current.errors).toEqual({ title: "Title too short" });

    rerender({ values: { title: "Good title", body: "" } });
    expect(result.current.errors).toEqual({});
    expect(result.current.allErrors).toEqual({ body: "Body too short" });
  });

  it("submit reveals every error and returns null when invalid", () => {
    const { result } = renderHook(() => useFormValidation(schema, { title: "", body: "" }));
    let data: unknown;
    act(() => {
      data = result.current.submit();
    });
    expect(data).toBeNull();
    expect(result.current.errors).toEqual({ title: "Title too short", body: "Body too short" });
    expect(result.current.hasErrors).toBe(true);
  });

  it("submit returns the parsed data when valid", () => {
    const { result } = renderHook(() =>
      useFormValidation(schema, { title: "A title", body: "A long enough body" }),
    );
    let data: unknown;
    act(() => {
      data = result.current.submit();
    });
    expect(data).toEqual({ title: "A title", body: "A long enough body" });
  });

  it("exposes the shared contact-details message", () => {
    expect(CONTACT_DETAILS_MESSAGE).toMatch(/shared automatically once you both accept/);
  });
});
