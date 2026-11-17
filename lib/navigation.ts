import type { Href } from "expo-router";

type Navigator = { canGoBack(): boolean; back(): void; replace(href: Href): void };

/**
 * Leaves a screen once its job is done (saved, deleted). Normally that's
 * back to where the person came from. If the screen was opened directly
 * (a shared link, or a reload on the web) there is nothing to go back to,
 * and `back()` would do nothing at all, so go to `fallback` instead.
 */
export function goBackOr(router: Navigator, fallback: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
