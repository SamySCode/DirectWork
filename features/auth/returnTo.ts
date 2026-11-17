// Where a signed-out visitor was heading when the route guard sent them to
// the welcome screen. People arrive from shared links ("have a look at this
// listing"); without this they sign in and land on Home, with the thing
// they came for gone.
//
// Kept in memory only, on purpose: nothing new is stored on the device, so
// the cookies notice ("only your sign-in session") stays true. The cost is
// that it doesn't survive the new tab a sign-up confirmation email opens;
// it does survive signing in, which is the common case for a shared link.

// Only pages that make sense to land on from outside, by exact shape: a
// listing, a profile, an application or a Deal Sheet, each with a UUID.
// Anything else (forms, settings, an address with extra parts) is ignored,
// so this can never be used to send someone somewhere unexpected.
const RETURNABLE =
  /^\/(listing|people|application|deal)\/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

// Long enough to sign in or sign up; short enough that a link opened this
// morning doesn't hijack an unrelated sign-in this afternoon.
const MAX_AGE_MS = 60 * 60 * 1000;

export type ReturnToKind = "listing" | "profile" | "page";

let pending: { path: string; at: number } | null = null;

/** Note where the visitor was going. Ignores anything that isn't a returnable page. */
export function rememberReturnTo(path: string): void {
  if (RETURNABLE.test(path)) pending = { path, at: Date.now() };
}

/** The remembered page, if there is one and it's still fresh. */
export function peekReturnTo(): string | null {
  if (!pending) return null;
  if (Date.now() - pending.at > MAX_AGE_MS) {
    pending = null;
    return null;
  }
  return pending.path;
}

/**
 * Forget it. Called once the person has arrived inside the app, not at the
 * moment of redirecting: the guard can run again before a redirect lands,
 * and a second run must still point at the same place, not fall back to Home.
 */
export function clearReturnTo(): void {
  pending = null;
}

/** What the remembered page is, for wording such as "the listing you opened". */
export function returnToKind(path: string): ReturnToKind {
  if (path.startsWith("/listing/")) return "listing";
  if (path.startsWith("/people/")) return "profile";
  return "page";
}
