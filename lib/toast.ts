import { useSyncExternalStore } from "react";
import { haptics } from "./haptics";

// A short confirmation after something worked ("Profile saved"), shown by
// the ToastHost in the root layout. For success only: an error belongs next
// to the thing that failed, where it can be read and acted on, not in a
// message that disappears.
export type Toast = { id: number; message: string };

let current: Toast | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function set(next: Toast | null) {
  current = next;
  listeners.forEach((listener) => listener());
}

/** Show a confirmation. A new one replaces whatever is showing. */
export function showToast(message: string): void {
  set({ id: nextId++, message });
  // A soft success tap on phones, once per confirmation.
  haptics.success();
}

/** Take down the toast with this id (a newer one is left alone). */
export function dismissToast(id: number): void {
  if (current?.id === id) set(null);
}

export function useToast(): Toast | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => current,
    () => null,
  );
}
