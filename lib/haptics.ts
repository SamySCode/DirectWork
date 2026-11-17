import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

// Small physical confirmations on phones, used sparingly so they keep
// meaning something: a success tap with each confirmation toast, and a
// light tick when a filter or segment changes. Nothing on the web, where
// the only option is a blunt vibration.
//
// iOS uses the Taptic Engine, which follows Settings > Sounds & Haptics >
// System Haptics. Android uses the system haptics engine
// (performHapticFeedback), which follows the phone's touch-feedback setting
// and needs no vibrate permission: app.json blocks VIBRATE, which this
// package would otherwise add to the Play Store listing. So never call
// notificationAsync, impactAsync or selectionAsync on Android; they use
// the Vibrator and would fail without that permission.
//
// People can also turn it off in the app (Profile > On this phone). That
// choice is kept on the device only, as "off"; nothing is stored while it
// is on. It's a setting the person asked us to remember, so it's strictly
// necessary storage, listed in the Cookies & Storage notice.

/** Whether this device can give haptic feedback at all: phones only. */
export function hapticsSupported(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

const OFF_KEY = "directwork.haptics-off";
let enabled = true;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function fire(effect: () => Promise<void>) {
  if (!enabled) return;
  try {
    // Feedback is a nicety: a device without it is not an error.
    effect().catch(() => {});
  } catch {
    // Some older devices throw synchronously.
  }
}

export const haptics = {
  /** Something worked: saved, sent, deleted. */
  success() {
    if (Platform.OS === "ios") {
      fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    } else if (Platform.OS === "android") {
      fire(() => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm));
    }
  },
  /** A choice changed: a filter chip, a segment. */
  selection() {
    if (Platform.OS === "ios") {
      fire(() => Haptics.selectionAsync());
    } else if (Platform.OS === "android") {
      fire(() => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick));
    }
  },
};

/** Reads the person's choice. Called once at start-up (app/_layout.tsx). */
export async function loadHapticsPreference(): Promise<void> {
  if (!hapticsSupported()) return;
  try {
    const off = (await AsyncStorage.getItem(OFF_KEY)) === "1";
    if (enabled === !off) return;
    enabled = !off;
    notify();
  } catch {
    // Unreadable storage: keep the default (on).
  }
}

/** Turns vibration on or off for this device, and remembers it. */
export async function setHapticsEnabled(on: boolean): Promise<void> {
  enabled = on;
  notify();
  // A tick as it comes back on, so people feel what they've chosen.
  if (on) haptics.selection();
  try {
    if (on) await AsyncStorage.removeItem(OFF_KEY);
    else await AsyncStorage.setItem(OFF_KEY, "1");
  } catch {
    // It still applies until the app is closed.
  }
}

export function useHapticsEnabled(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => enabled,
    () => true,
  );
}
