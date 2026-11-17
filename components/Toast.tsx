import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "../lib/accessibility";
import { nativeDriverEnabled } from "../lib/animation";
import { colors, elevation, motion, radius, spacing, typography } from "../lib/theme";
import { dismissToast, useToast } from "../lib/toast";
import { Text } from "./Text";

// Long enough to read a few words, short enough not to be in the way.
const VISIBLE_MS = 2600;
// Clears the tab bar, which sits under most of the screens that show one.
const ABOVE_TAB_BAR = 76;

/**
 * Shows the current toast (lib/toast.ts) near the bottom of the screen.
 * Mounted once, in the root layout. It never takes touches, and a screen
 * reader announces it without moving focus.
 */
export function ToastHost() {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    const to = (toValue: number) =>
      Animated.timing(progress, {
        toValue,
        duration: reduceMotion ? 0 : motion.base,
        useNativeDriver: nativeDriverEnabled,
      });
    progress.setValue(0);
    const run = Animated.sequence([to(1), Animated.delay(VISIBLE_MS), to(0)]);
    run.start(({ finished }) => {
      if (finished) dismissToast(toast.id);
    });
    return () => run.stop();
  }, [toast, progress, reduceMotion]);

  if (!toast) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.host, { bottom: Math.max(insets.bottom, spacing.sm) + ABOVE_TAB_BAR }]}
    >
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          {
            opacity: progress,
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            ],
          },
        ]}
      >
        <Ionicons name="checkmark-circle" size={18} color={colors.mint} />
        <Text style={styles.message}>{toast.message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    maxWidth: 420,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    ...elevation.md,
  },
  message: {
    flexShrink: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.onInk,
  },
});
