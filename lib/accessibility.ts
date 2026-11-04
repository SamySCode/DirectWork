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
