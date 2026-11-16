import { Platform } from "react-native";
import { a11yState } from "../accessibility";

describe("a11yState", () => {
  afterEach(() => jest.restoreAllMocks());

  it("gives iOS and Android the accessibilityState they read", () => {
    expect(a11yState({ checked: true })).toEqual({ accessibilityState: { checked: true } });
  });

  describe("on web, where React Native Web ignores accessibilityState", () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, "OS", "web");
    });

    it("spells each state as the aria attribute a browser understands", () => {
      expect(
        a11yState({ checked: false, expanded: true, busy: true, disabled: false, selected: true }),
      ).toMatchObject({
        "aria-checked": false,
        "aria-expanded": true,
        "aria-busy": true,
        "aria-disabled": false,
        "aria-selected": true,
      });
    });

    it("says nothing about a state it wasn't given", () => {
      const props = a11yState({ selected: undefined, expanded: false });
      expect(props).not.toHaveProperty("aria-selected");
      expect(props).not.toHaveProperty("aria-checked");
      expect(props).toHaveProperty("aria-expanded", false);
    });

    it("marks a toggle button as pressed, since a button can't be 'selected'", () => {
      const props = a11yState({ selected: true }, { selectedAs: "pressed" });
      expect(props).toHaveProperty("aria-pressed", true);
      expect(props).not.toHaveProperty("aria-selected");
    });
  });
});
