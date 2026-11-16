import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import { colors } from "./theme";

/**
 * True when the person has asked their device to reduce motion (iOS
 * "Reduce Motion", Android "Remove animations", the web
 * prefers-reduced-motion media query). Animations should then be skipped,
 * not just shortened.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => mounted && setReduced(value))
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

export type A11yState = {
  checked?: boolean;
  selected?: boolean;
  expanded?: boolean;
  busy?: boolean;
  disabled?: boolean;
};

/**
 * The state of a control for assistive technology, on every platform.
 * Spread it onto the element: `<Pressable {...a11yState({ checked })} />`.
 *
 * iOS and Android read `accessibilityState`. React Native Web (0.21) does
 * not read it at all: it only understands `aria-*` props, so passing
 * `accessibilityState` alone leaves a web screen reader unable to tell a
 * ticked box from an empty one. Always use this instead of writing
 * `accessibilityState` directly.
 *
 * `selectedAs: "pressed"` is for toggle buttons (chips): ARIA has no
 * "selected" on a button, its on/off state is `aria-pressed`.
 */
export function a11yState(
  state: A11yState,
  { selectedAs = "selected" }: { selectedAs?: "selected" | "pressed" } = {},
) {
  if (Platform.OS !== "web") return { accessibilityState: state };
  const aria: Record<string, boolean> = {};
  if (state.checked !== undefined) aria["aria-checked"] = state.checked;
  if (state.selected !== undefined) aria[`aria-${selectedAs}`] = state.selected;
  if (state.expanded !== undefined) aria["aria-expanded"] = state.expanded;
  if (state.busy !== undefined) aria["aria-busy"] = state.busy;
  if (state.disabled !== undefined) aria["aria-disabled"] = state.disabled;
  return { accessibilityState: state, ...aria };
}

/**
 * React Native Web renders pressables as focusable elements but strips the
 * browser's focus outline. Put a clear, high-contrast ring back for
 * keyboard users only (:focus-visible), so mouse/touch users don't see it.
 */
export function installWebFocusStyles(): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  if (document.getElementById("dw-focus-styles")) return;
  const style = document.createElement("style");
  style.id = "dw-focus-styles";
  style.textContent = `
    [role="button"]:focus-visible, [role="link"]:focus-visible, [role="checkbox"]:focus-visible,
    [role="radio"]:focus-visible, [role="tab"]:focus-visible, a:focus-visible,
    input:focus-visible, textarea:focus-visible {
      outline: 3px solid ${colors.accent} !important;
      outline-offset: 2px;
      border-radius: 8px;
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `;
  document.head.appendChild(style);
}
