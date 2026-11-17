import { usePreventRemove } from "expo-router";
import { NavigationContext } from "expo-router/react-navigation";
import { MutableRefObject, useContext, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { confirm } from "./confirm";
import { setHistoryGate } from "./historyGate";

/** Shared between the hook (allowLeave) and the guard it renders. */
type Controls = {
  /** Set once leaving is allowed: after a save, or "Discard" in the prompt. */
  leaving: boolean;
  /** Lifts the guard straight away (usePreventRemove's disablePrevention). */
  release: () => void;
};

type GuardProps = { dirty: boolean; controls: MutableRefObject<Controls> };

const TITLE = "Discard your changes?";
const MESSAGE = "You haven't saved them. If you leave now, they'll be lost.";

function Guard({ dirty, controls }: GuardProps) {
  // Every way of leaving inside the app: the header back button, the
  // Android back button, the iOS swipe back and a modal's swipe down (the
  // native stack holds the gesture). On the web it also covers closing or
  // reloading the tab: since SDK 58 the hook asks the browser for that.
  //
  // SDK 58 contract: a blocked navigation is carried on with `repeat()`
  // (re-sending the action would be blocked again), and navigating away on
  // purpose needs the returned `disablePrevention()` first.
  const disablePrevention = usePreventRemove(dirty, ({ repeat }) => {
    void confirm({
      title: TITLE,
      message: MESSAGE,
      confirmLabel: "Discard",
      destructive: true,
    }).then((discard) => {
      if (!discard) return;
      controls.current.leaving = true;
      repeat();
    });
  });

  useEffect(() => {
    controls.current.release = disablePrevention;
  }, [controls, disablePrevention]);

  // The browser's own back and forward buttons, which the router handles by
  // resetting its state, skipping the guard above (see lib/historyGate.ts).
  // A step the gate refuses never reaches the router, so its idea of where
  // we are stays right.
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

    let asking = false;

    return setHistoryGate(() => {
      if (controls.current.leaving) return true;
      if (restoring) {
        // Our own step back to this page: nothing for the router to do.
        restoring = false;
        return false;
      }
      // Hold the step: put the browser back on this page straight away (the
      // router never sees it), then ask in the app's own dialog. If the
      // answer is Discard, take the same step again with the guard lifted.
      const now = historyPosition();
      const back = formPosition !== undefined && now !== undefined ? formPosition - now : 1;
      if (back !== 0) {
        restoring = true;
        window.history.go(back);
      }
      if (asking) return false; // the dialog is already up
      asking = true;
      void confirm({
        title: TITLE,
        message: MESSAGE,
        confirmLabel: "Discard",
        destructive: true,
      }).then((discard) => {
        asking = false;
        if (!discard) return;
        controls.current.leaving = true;
        controls.current.release();
        window.history.go(-back || -1);
      });
      return false;
    });
  }, [dirty, controls]);

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
  const controls = useRef<Controls>({ leaving: false, release: () => {} });
  const inNavigator = useContext(NavigationContext) !== undefined;
  return {
    guard: inNavigator ? <Guard dirty={dirty} controls={controls} /> : null,
    allowLeave: () => {
      controls.current.leaving = true;
      controls.current.release();
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
