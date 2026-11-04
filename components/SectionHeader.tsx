import { Pressable, StyleSheet, View } from "react-native";
import { colors, spacing, typography } from "../lib/theme";
import { Text } from "./Text";

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: -spacing.xs,
  },
  title: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.lg,
    color: colors.textPrimary,
  },
  action: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.accent,
  },
});
