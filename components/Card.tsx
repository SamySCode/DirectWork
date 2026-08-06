import { StyleSheet, View, ViewProps } from "react-native";
import { colors, radius, spacing } from "../lib/theme";

export function Card({ style, ...viewProps }: ViewProps) {
  return <View style={[styles.card, style]} {...viewProps} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
});
