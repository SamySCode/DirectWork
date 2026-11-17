import { renderHook } from "@testing-library/react-native";
import { formSnapshot, useUnsavedChanges } from "../unsavedChanges";

describe("formSnapshot", () => {
  it("is equal for the same values, whatever the object identity", () => {
    expect(formSnapshot({ title: "A", skills: ["x"] })).toBe(
      formSnapshot({ title: "A", skills: ["x"] }),
    );
  });

  it("notices any edit, including a reordered list", () => {
    const opened = formSnapshot({ title: "A", skills: ["x", "y"] });
    expect(formSnapshot({ title: "A ", skills: ["x", "y"] })).not.toBe(opened);
    expect(formSnapshot({ title: "A", skills: ["y", "x"] })).not.toBe(opened);
  });

  it("treats a field that was never set and one that is unset again as the same", () => {
    expect(formSnapshot({ location: undefined })).toBe(formSnapshot({ location: undefined }));
    expect(formSnapshot({ location: undefined })).not.toBe(formSnapshot({}));
  });
});

describe("useUnsavedChanges", () => {
  it("renders nothing outside a navigator, so forms work in component tests", async () => {
    const { result } = await renderHook(() => useUnsavedChanges(true));
    expect(result.current.guard).toBeNull();
    expect(() => result.current.allowLeave()).not.toThrow();
  });
});
