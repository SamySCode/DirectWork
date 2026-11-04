import { StyleSheet, View } from "react-native";
import { colors, radius, spacing, typography } from "../lib/theme";
import { Text } from "./Text";

export type BadgeTone = "neutral" | "accent" | "mint" | "warning" | "danger" | "ink";

const tones: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceSunken, fg: colors.textSecondary },
  accent: { bg: colors.accentMuted, fg: colors.accent },
  mint: { bg: colors.mintMuted, fg: colors.mintInk },
  warning: { bg: colors.warningMuted, fg: colors.warning },
  danger: { bg: colors.dangerMuted, fg: colors.danger },
  ink: { bg: colors.ink, fg: colors.onInk },
};

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

export function Badge({ label, tone = "neutral" }: BadgeProps) {
  const { bg, fg } = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]} maxFontSizeMultiplier={1.5}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.2,
  },
});
