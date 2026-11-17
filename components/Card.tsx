import { ReactNode } from "react";
import { Pressable, StyleProp, StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { colors, elevation, radius, spacing, surfaces, webTransition } from "../lib/theme";

type CardProps = ViewProps & {
  /** Floating things (menus, popovers, pinned panels): one step above a resting card. */
  raised?: boolean;
};

export function Card({ style, raised = false, ...viewProps }: CardProps) {
  return <View style={[styles.card, raised ? styles.raised : null, style]} {...viewProps} />;
}

type PressableCardProps = {
  onPress: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function PressableCard({
  onPress,
  children,
  style,
  accessibilityLabel,
}: PressableCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      // `hovered` is React Native Web-only and missing from RN's types.
      style={(state) => [
        styles.card,
        (state as { hovered?: boolean }).hovered ? styles.hovered : null,
        state.pressed ? styles.pressed : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...surfaces.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...elevation.sm,
    // Web only (ignored natively): eases the hover lift / press dip.
    ...webTransition("transform, box-shadow, border-color"),
  },
  // In dark mode height is a lighter fill and edge; the shadow adds the rest.
  raised: {
    ...surfaces.raised,
    ...elevation.md,
  },
  // Web hover: lift 2px with a deeper shadow - says "this opens" without
  // a colour flash. Transitioned in CSS so it eases rather than jumps.
  hovered: {
    borderColor: colors.accent,
    transform: [{ translateY: -2 }],
    ...elevation.md,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
