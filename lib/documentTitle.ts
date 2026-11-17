import { useEffect } from "react";
import { Platform } from "react-native";

const APP_NAME = "DirectWork";

// Titles by route. Longest match wins, so "listing/new" beats "listing".
// Group folders such as "(tabs)" are dropped before matching.
const TITLES: [route: string, title: string][] = [
  ["welcome", ""],
  ["sign-in", "Sign in"],
  ["sign-up", "Create your profile"],
  ["forgot-password", "Reset your password"],
  ["update-password", "New password"],
  ["onboarding", "Set up your profile"],
  ["home", "Home"],
  ["discover", "Discover"],
  ["applications", "Your applications"],
  ["listings", "Your listings"],
  ["profile", "Your profile"],
  ["listing/new", "New listing"],
  ["listing/[id]/edit", "Edit listing"],
  ["listing", "Listing"],
  ["application", "Application"],
  ["deal", "Deal Sheet"],
  ["people", "Profile"],
  ["account/edit", "Edit profile"],
  ["account/delete", "Delete account"],
  ["account/blocked", "Blocked people"],
  ["inbox", "Activity"],
  ["billing", "Plans"],
  ["guide", "Guide & tips"],
  ["help", "Help & legal"],
  ["legal/accept", "Updated terms"],
  ["legal", "Legal"],
  ["review", "Review queue"],
  ["moderation", "Reports"],
];

/**
 * The browser tab title for a route: "Discover · DirectWork". `detail`
 * replaces the generic name where the page is about one named thing (a
 * listing's own title). The app name alone for the welcome page and for
 * anything unrecognised.
 */
export function documentTitle(segments: readonly string[], detail?: string): string {
  const route = segments.filter((segment) => !segment.startsWith("(")).join("/");
  let best: [string, string] | undefined;
  for (const entry of TITLES) {
    const matches = route === entry[0] || route.startsWith(`${entry[0]}/`);
    if (matches && (!best || entry[0].length > best[0].length)) best = entry;
  }
  const name = detail?.trim() || best?.[1];
  return name ? `${name} · ${APP_NAME}` : APP_NAME;
}

/**
 * Keeps the browser tab title in step with the screen (web only; phones
 * have no such thing). Every page said just "DirectWork" before, so tabs,
 * history and bookmarks were indistinguishable, and a screen reader had
 * nothing to announce on arrival (WCAG 2.4.2, Page Titled).
 */
export function useDocumentTitle(segments: readonly string[], detail?: string): void {
  const title = documentTitle(segments, detail);
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") document.title = title;
  }, [title]);
}
