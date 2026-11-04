import { Pressable, PressableProps, StyleSheet } from "react-native";
import { colors, radius, spacing, typography } from "../lib/theme";
import { Text } from "./Text";

type ChipProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  selected: boolean;
  /** Selected fill colour - defaults to the app accent; tabs pass their own tint. */
  tint?: string;
};

export function Chip({ label, selected, tint = colors.accent, ...pressableProps }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      // 36pt visual height + 4pt slop each side = 44pt touch target (WCAG 2.5.8 / Apple HIG).
      hitSlop={{ top: 4, bottom: 4 }}
      style={[styles.chip, selected ? { borderColor: tint, backgroundColor: tint } : null]}
      {...pressableProps}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
  },
  labelSelected: {
    color: colors.onAccent,
  },
});
