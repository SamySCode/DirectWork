import { Appearance, Platform } from "react-native";

// Palette: ink-indigo for weight, iris violet as the working accent, and
// signal mint reserved for "it's a match" moments (accepted, contact
// revealed, completed) - so mint always means something good happened.
//
// Every text/background pairing here is checked against WCAG 2.2 AA in
// lib/__tests__/contrast.test.ts - change a value and that test tells you
// if it still passes in both light and dark.
const light = {
  background: "#F5F4FC",
  surface: "#FFFFFF",
  surfaceSunken: "#EEEDF8",
  border: "#E3E1F0",
  textPrimary: "#16133D",
  textSecondary: "#4E4A72",
  textMuted: "#68648C",
  ink: "#16133D",
  inkSoft: "#2A2560",
  accent: "#5B4CF0",
  accentPressed: "#4A3BD9",
  accentMuted: "#ECEAFE",
  onAccent: "#FFFFFF",
  mint: "#1FC896",
  mintMuted: "#DDF7EE",
  mintInk: "#0B7A59",
  success: "#0B7A59",
  danger: "#B82A3B",
  dangerMuted: "#FDE8EA",
  warning: "#8A5200",
  warningMuted: "#FFF1D9",
  onInk: "#FFFFFF",
  onInkMuted: "#C9C5EE",
};

export type Palette = typeof light;

// Dark: deep ink surfaces rather than pure black (less glare, keeps the
// brand), lighter accents so links and tints stay readable, and muted
// fills that sit *below* their text instead of glowing.
const dark: Palette = {
  background: "#0D0B22",
  surface: "#17143A",
  surfaceSunken: "#211D4B",
  border: "#2E2A5E",
  textPrimary: "#F2F0FF",
  textSecondary: "#C2BEEA",
  textMuted: "#9C97C8",
  ink: "#2E2780",
  inkSoft: "#3A3394",
  accent: "#9E94FF",
  accentPressed: "#B3ABFF",
  accentMuted: "#2A2566",
  onAccent: "#120F33",
  mint: "#2FDDA8",
  mintMuted: "#0E3B31",
  mintInk: "#5CE6BD",
  success: "#5CE6BD",
  danger: "#FF8593",
  dangerMuted: "#3D1622",
  warning: "#FFC261",
  warningMuted: "#3B2A0C",
  onInk: "#FFFFFF",
  onInkMuted: "#C9C5EE",
};

export type ColorScheme = "light" | "dark";

/**
 * Follows the device's appearance setting, read once at launch: styles are
 * built with StyleSheet.create at import time, so the palette has to be
 * fixed before any screen loads. On web a change reloads the page (see
 * app/_layout.tsx); on iOS/Android it applies the next time the app starts.
 */
export const colorScheme: ColorScheme = Appearance.getColorScheme() === "dark" ? "dark" : "light";

export const palettes: Record<ColorScheme, Palette> = { light, dark };

export const colors: Palette = palettes[colorScheme];

export const gradients = {
  hero: ["#16133D", "#2E2690", "#5B4CF0"] as const,
  accent: ["#6A5CF5", "#5B4CF0"] as const,
};

// Each tab's identity: a hero gradient that always starts from ink (so the
// app still reads as one family) and a tint for the tab bar + accents on
// that tab. Mint stays reserved for "match" moments and isn't used here.
export type TabTheme = { gradient: readonly [string, string, string]; tint: string; muted: string };

const lightTabs = {
  home: { gradient: ["#16133D", "#2E2690", "#5B4CF0"], tint: "#5B4CF0", muted: "#ECEAFE" },
  discover: { gradient: ["#0B1B3F", "#123E8C", "#2F7BEA"], tint: "#1F63D1", muted: "#E3EEFD" },
  applications: { gradient: ["#2A0E34", "#7A1F5E", "#D9467A"], tint: "#C2336B", muted: "#FCE6EE" },
  listings: { gradient: ["#2A1407", "#8A3A12", "#E8742A"], tint: "#AE4C16", muted: "#FDEDE1" },
  profile: { gradient: ["#062A30", "#0B5563", "#14A3B8"], tint: "#0E7F92", muted: "#DDF3F6" },
} as const satisfies Record<string, TabTheme>;

// Same gradients (they already sit on ink); tints lifted so tab labels and
// chips stay readable on dark surfaces, fills darkened to match.
const darkTabs: Record<keyof typeof lightTabs, TabTheme> = {
  home: { gradient: lightTabs.home.gradient, tint: "#9E94FF", muted: "#2A2566" },
  discover: { gradient: lightTabs.discover.gradient, tint: "#7DB0FF", muted: "#14284F" },
  applications: { gradient: lightTabs.applications.gradient, tint: "#FF8AB4", muted: "#3D1630" },
  listings: { gradient: lightTabs.listings.gradient, tint: "#FFA766", muted: "#3D2310" },
  profile: { gradient: lightTabs.profile.gradient, tint: "#5DD3E4", muted: "#0C3238" },
};

export const tabThemePalettes = { light: lightTabs as typeof darkTabs, dark: darkTabs };

export const tabThemes = tabThemePalettes[colorScheme];

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const shadow = {
  card: Platform.select({
    web: { boxShadow: "0 1px 2px rgba(22,19,61,0.04), 0 4px 16px rgba(22,19,61,0.06)" },
    default: {
      shadowColor: "#16133D",
      shadowOpacity: 0.07,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
  }),
  raised: Platform.select({
    web: { boxShadow: "0 8px 32px rgba(46,38,144,0.28)" },
    default: {
      shadowColor: "#2E2690",
      shadowOpacity: 0.28,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
  }),
};

export const layout = {
  // Content column on wide (web/tablet) screens - forms and lists read badly
  // stretched across a desktop window.
  maxContentWidth: 720,
} as const;

export const typography = {
  fontFamily: Platform.select({
    ios: "System",
    android: "Roboto",
    default: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  }),
  // General Sans (Fontshare Free License) - wordmark/headlines only, see lib/fonts.ts.
  displayFontFamily: "GeneralSans-Bold",
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    display: 40,
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
} as const;
