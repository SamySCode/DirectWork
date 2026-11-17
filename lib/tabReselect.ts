import { useEffect, useRef } from "react";

// Pressing the tab you are already on scrolls that tab back to the top, as
// in most apps. The tab bar (app/(tabs)/_layout.tsx) announces the press
// here; the tab's scrolling view listens.
//
// A plain event list rather than React Navigation's useScrollToTop: that
// hook needs a navigation context, which Screen doesn't otherwise depend
// on, so every screen test would have to provide one.

export type TabName = "home" | "discover" | "applications" | "listings" | "profile";

const listeners = new Map<string, Set<() => void>>();

/** Called by the tab bar when the active tab is pressed again. */
export function emitTabReselect(tab: string): void {
  listeners.get(tab)?.forEach((listener) => listener());
}

/** The tab bar's route name ("discover/index") as a tab name ("discover"). */
export function tabNameOf(routeName: string): string {
  return routeName.replace(/\/index$/, "");
}

/** Runs `onReselect` when `tab` is pressed while already showing. Does nothing without a tab. */
export function useTabReselect(tab: TabName | undefined, onReselect: () => void): void {
  const latest = useRef(onReselect);
  latest.current = onReselect;
  useEffect(() => {
    if (!tab) return;
    const listener = () => latest.current();
    const set = listeners.get(tab) ?? new Set();
    set.add(listener);
    listeners.set(tab, set);
    return () => {
      set.delete(listener);
    };
  }, [tab]);
}
