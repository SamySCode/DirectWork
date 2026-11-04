import Ionicons from "@expo/vector-icons/Ionicons";
import { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius, spacing, typography } from "../lib/theme";
import { Button } from "./Button";
import { Text } from "./Text";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  actionLabel?: string;
  onAction?: () => void;
  /** Inline = sits inside a list/section rather than filling the screen. */
  inline?: boolean;
};

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  inline = false,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, inline ? styles.inline : styles.fill]}>
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={24} color={colors.accent} />
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} size="sm" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  fill: {
    flex: 1,
    padding: spacing.xl,
  },
  inline: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
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
    maxWidth: 360,
    lineHeight: 20,
  },
  action: {
    marginTop: spacing.sm,
  },
});
