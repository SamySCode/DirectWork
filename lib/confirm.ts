import { useSyncExternalStore } from "react";
import { Alert, Platform } from "react-native";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  /** Red confirm button and a warning icon: for things that can't be undone. */
  destructive?: boolean;
};

export type ConfirmRequest = ConfirmOptions & { id: number; resolve: (ok: boolean) => void };

// Requests waiting for an answer, oldest first. ConfirmHost (mounted once in
// the root layout) shows the first one as the app's own dialog.
let queue: ConfirmRequest[] = [];
let hosts = 0;
let nextId = 1;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/**
 * Asks the person to confirm something, in the app's own dialog. Resolves
 * true for the confirm button, false for Cancel, a tap outside, Escape or
 * the Android back button.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  // Before the app has drawn its host (or in a test without one), fall
  // back to the system dialog rather than never answering.
  if (hosts === 0) return systemConfirm(options);
  return new Promise((resolve) => {
    queue = [...queue, { ...options, id: nextId++, resolve }];
    notify();
  });
}

/** Called by the dialog with the person's answer. */
export function answerConfirm(id: number, ok: boolean): void {
  const request = queue.find((r) => r.id === id);
  if (!request) return;
  queue = queue.filter((r) => r.id !== id);
  notify();
  request.resolve(ok);
}

/** The request the dialog should show now, if any. */
export function useConfirmRequest(): ConfirmRequest | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => queue[0] ?? null,
    () => null,
  );
}

/** ConfirmHost registers itself while mounted. */
export function registerConfirmHost(): () => void {
  hosts += 1;
  return () => {
    hosts -= 1;
    if (hosts > 0) return;
    // Nothing left to show them: answer "no" rather than leave callers
    // waiting for ever.
    const pending = queue;
    queue = [];
    notify();
    pending.forEach((request) => request.resolve(false));
  };
}

function systemConfirm({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: "cancel", onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}
