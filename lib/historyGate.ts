import { Platform } from "react-native";

// Lets a screen hold the browser's own back and forward buttons on the web.
//
// The router handles those steps by resetting its whole state, which
// skips React Navigation's leave-guard (usePreventRemove): a known
// limitation on the web. Its listener is added when the app mounts, and
// listeners on window run in the order they were added, so a listener
// added before that, at app start, runs first and can stop the step
// reaching the router at all. That is all this does: it asks the one
// screen that has registered a gate (a form with unsaved changes), and
// lets the step through unless the gate says no.
//
// Install once, at module scope in the root layout, so it is added first.

type Gate = () => boolean;

let gate: Gate | null = null;
let installed = false;

export function installHistoryGate(): void {
  if (Platform.OS !== "web" || installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("popstate", (event) => {
    if (gate && !gate()) event.stopImmediatePropagation();
  });
}

/**
 * While set, every browser back or forward step asks `allow` first; it
 * returns true to let the router carry on. Returns a function that removes
 * the gate (only if it is still this one).
 */
export function setHistoryGate(allow: Gate): () => void {
  gate = allow;
  return () => {
    if (gate === allow) gate = null;
  };
}

/** For tests: whether the listener was added. */
export function historyGateInstalled(): boolean {
  return installed;
}
