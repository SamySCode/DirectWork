import { StyleSheet, View } from "react-native";
import { colors, elevation, radius, spacing, surfaces, typography } from "../lib/theme";
import { Button } from "./Button";
import { Text } from "./Text";

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  panel: {
    ...surfaces.card,
    ...elevation.sm,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: "center",
    maxWidth: 420,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.danger,
    textAlign: "center",
  },
  description: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
