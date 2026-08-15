import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../../../lib/theme";

type AuthHeaderProps = {
  title: string;
};

export function AuthHeader({ title }: AuthHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>DirectWork</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  brand: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.accent,
  },
  title: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },
});
