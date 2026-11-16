import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { checkConnection, useIsOnline } from "../lib/query";
import { colors, spacing, typography } from "../lib/theme";
import { Text } from "./Text";

/**
 * Shown while requests are paused because the backend can't be reached
 * (lib/query.ts). Screens keep showing what they last loaded; this says why
 * nothing is updating and offers a way to check again straight away.
 */
export function OfflineBanner() {
  const online = useIsOnline();
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(false);
  if (online) return null;
  const retry = async () => {
    setChecking(true);
    await checkConnection();
    setChecking(false);
  };
  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { paddingBottom: spacing.sm + insets.bottom }]}
    >
      <Text style={styles.text}>
        Can&apos;t connect right now. Showing what&apos;s saved. We&apos;ll refresh when you&apos;re
        back.
      </Text>
      <Pressable
        onPress={retry}
        disabled={checking}
        accessibilityRole="button"
        accessibilityLabel="Try connecting now"
        hitSlop={8}
      >
        <Text style={styles.action}>{checking ? "Checking…" : "Try now"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSunken,
  },
  text: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  action: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
});
