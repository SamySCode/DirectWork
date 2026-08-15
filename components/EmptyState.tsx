import { StyleSheet, View } from "react-native";
import { colors, spacing, typography } from "../lib/theme";
import { Text } from "./Text";

type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    textAlign: "center",
  },
  description: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
