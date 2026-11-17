import { useSyncExternalStore } from "react";

// Signing out waits on the server (it revokes the session there first), and
// the screen underneath has nothing to say while it does. This flag lets the
// root layout cover the app with "Signing out" from the moment of the press
// until the route guard has moved on to the welcome screen, so a press is
// never followed by a still screen.
let active = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (active === next) return;
  active = next;
  listeners.forEach((listener) => listener());
}

export const beginSigningOut = () => set(true);
/** Lifts the cover. Returns whether a sign-out was actually in progress. */
export function endSigningOut(): boolean {
  const was = active;
  set(false);
  return was;
}

/** True from pressing "Sign out" until the app has left the signed-in screens. */
export function useSigningOut(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => active,
    () => false,
  );
}
