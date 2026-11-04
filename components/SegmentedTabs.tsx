import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing, typography } from "../lib/theme";
import { Text } from "./Text";

type Option<T extends string> = { value: T; label: string };

type SegmentedTabsProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  tint?: string;
  accessibilityLabel: string;
};

/** Equal-width tabs for one exclusive choice (e.g. All / Paid / Partnerships). */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  tint = colors.accent,
  accessibilityLabel,
}: SegmentedTabsProps<T>) {
  return (
    <View style={styles.track} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={[styles.tab, selected ? [styles.selected, { backgroundColor: tint }] : null]}
          >
            <Text
              style={[styles.label, selected ? styles.labelSelected : null]}
              maxFontSizeMultiplier={1.4}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  selected: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
  },
  labelSelected: {
    color: colors.onAccent,
  },
});
