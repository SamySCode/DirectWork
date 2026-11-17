import { NavigationContext, usePreventRemove } from "expo-router/react-navigation";
import { MutableRefObject, useContext, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { confirm } from "./confirm";
import { setHistoryGate } from "./historyGate";

type GuardProps = { dirty: boolean; skip: MutableRefObject<boolean> };

const TITLE = "Discard your changes?";
const MESSAGE = "You haven't saved them. If you leave now, they'll be lost.";

function Guard({ dirty, skip }: GuardProps) {
  const navigation = useContext(NavigationContext)!;

  // Covers every way of leaving the screen inside the app: the header back
  // button, the Android back button, the iOS swipe back and a modal's swipe
  // down (the native stack reads this and holds the gesture).
  usePreventRemove(dirty, ({ data }) => {
    if (skip.current) {
      navigation.dispatch(data.action);
      return;
    }
    void confirm({
      title: TITLE,
      message: MESSAGE,
      confirmLabel: "Discard",
      destructive: true,
    }).then((discard) => {
      if (discard) navigation.dispatch(data.action);
    });
  });

  // The browser's own back and forward buttons, which skip the guard above
  // (see lib/historyGate.ts). A step the gate refuses never reaches the
  // router, so its idea of where we are stays right.
  useEffect(() => {
    if (Platform.OS !== "web" || !dirty) return;
    // Where this page sits in the tab's history. The Navigation API reports
    // it exactly (Chromium, recent Safari and Firefox); elsewhere a history
    // step is assumed to be a back press, by far the common case.
    const historyPosition = () =>
      (window as { navigation?: { currentEntry?: { index: number } | null } }).navigation
        ?.currentEntry?.index;
    const formPosition = historyPosition();
    let restoring = false;

    return setHistoryGate(() => {
      if (skip.current) return true;
      if (restoring) {
        // Our own step back to this page: nothing for the router to do.
        restoring = false;
        return false;
      }
      if (window.confirm(`${TITLE}\n\n${MESSAGE}`)) {
        skip.current = true;
        return true;
      }
      // Keep editing: step the browser back to this page.
      const now = historyPosition();
      const delta = formPosition !== undefined && now !== undefined ? formPosition - now : 1;
      if (delta !== 0) {
        restoring = true;
        window.history.go(delta);
      }
      return false;
    });
  }, [dirty, skip]);

  // On the web, also closing the tab or reloading the page. Browsers show
  // their own wording for this; a page can only ask for the prompt.
  useEffect(() => {
    if (Platform.OS !== "web" || !dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (skip.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, skip]);

  return null;
}

/**
 * Asks "Discard your changes?" before leaving a form with unsaved edits.
 *
 * Render `guard` once in the form. Call `allowLeave()` straight before
 * navigating away after a successful save, so the save itself isn't
 * questioned; a failed save never calls it, so the form stays protected.
 *
 * Outside a navigator (component tests) it does nothing.
 */
export function useUnsavedChanges(dirty: boolean) {
  const skip = useRef(false);
  const inNavigator = useContext(NavigationContext) !== undefined;
  return {
    guard: inNavigator ? <Guard dirty={dirty} skip={skip} /> : null,
    allowLeave: () => {
      skip.current = true;
    },
  };
}

/**
 * A stable fingerprint of a form's values, to compare with how the form
 * started. Order-sensitive on purpose: reordering images or skills is a
 * change.
 */
export function formSnapshot(values: unknown): string {
  return JSON.stringify(values, (_key, value) => (value === undefined ? null : value));
}
