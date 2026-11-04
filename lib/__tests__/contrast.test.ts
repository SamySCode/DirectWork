import { palettes, tabThemePalettes } from "../theme";

// WCAG 2.2 relative luminance / contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = hex
    .replace("#", "")
    .match(/../g)!
    .map((pair) => parseInt(pair, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const AA_TEXT = 4.5;
const AA_LARGE_OR_UI = 3;

// Every pairing the app actually renders as text, with the threshold that applies.
const TEXT_PAIRS = [
  ["textPrimary", "background"],
  ["textPrimary", "surface"],
  ["textSecondary", "background"],
  ["textSecondary", "surface"],
  ["textMuted", "background"],
  ["textMuted", "surface"],
  ["textMuted", "surfaceSunken"],
  ["accent", "surface"],
  ["accent", "background"],
  ["accent", "accentMuted"],
  ["onAccent", "accent"],
  ["mintInk", "mintMuted"],
  ["mintInk", "surface"],
  ["danger", "surface"],
  ["danger", "dangerMuted"],
  ["warning", "warningMuted"],
  ["warning", "surface"],
  ["onInk", "ink"],
  ["textSecondary", "surfaceSunken"],
] as const;

describe.each(["light", "dark"] as const)("%s palette meets WCAG AA", (scheme) => {
  const palette = palettes[scheme];

  it.each(TEXT_PAIRS)("%s on %s", (fg, bg) => {
    expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("borders are visible against surfaces (non-text UI, 1.2:1 floor for decorative dividers)", () => {
    expect(contrast(palette.border, palette.surface)).toBeGreaterThanOrEqual(1.2);
  });

  it("mint (used for lit nodes/progress) is distinguishable from the surface", () => {
    expect(contrast(palette.mint, palette.surface)).toBeGreaterThanOrEqual(AA_LARGE_OR_UI - 1.5);
  });

  it.each(Object.keys(tabThemePalettes[scheme]))("tab tint %s is readable as a label", (tab) => {
    const theme = tabThemePalettes[scheme][tab as keyof (typeof tabThemePalettes)["light"]];
    expect(contrast(theme.tint, palette.surface)).toBeGreaterThanOrEqual(AA_TEXT);
    // Selected chips put onAccent-style white/ink text on the tint.
    expect(contrast(theme.tint, theme.muted)).toBeGreaterThanOrEqual(AA_LARGE_OR_UI);
  });
});
