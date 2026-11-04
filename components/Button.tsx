import Ionicons from "@expo/vector-icons/Ionicons";
import { ComponentProps, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { useReducedMotion } from "../lib/accessibility";
import { nativeDriverEnabled } from "../lib/animation";
import { colors, radius, spacing, typography } from "../lib/theme";
import { Text } from "./Text";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "light" | "onDark";

type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ComponentProps<typeof Ionicons>["name"];
  size?: "md" | "sm";
  style?: StyleProp<ViewStyle>;
};

const variantStyles: Record<ButtonVariant, { container: ViewStyle; text: string }> = {
  primary: { container: { backgroundColor: colors.accent }, text: colors.onAccent },
  secondary: {
    container: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    text: colors.textPrimary,
  },
  ghost: { container: { backgroundColor: "transparent" }, text: colors.accent },
  danger: {
    container: { backgroundColor: colors.dangerMuted },
    text: colors.danger,
  },
  light: { container: { backgroundColor: colors.onInk }, text: colors.ink },
  onDark: {
    container: { borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
    text: colors.onInk,
  },
};

// Hover (web/pointer devices): a quiet shift in tone, never a size change.
const hoverStyles: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.accentPressed },
  secondary: { borderColor: colors.accent },
  ghost: { backgroundColor: colors.accentMuted },
  danger: { borderWidth: 1, borderColor: colors.danger },
  light: { opacity: 0.92 },
  onDark: { backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.5)" },
};

// Press feedback: short, eased, no overshoot - reads as "precise" rather
// than "playful". A spring's bounce is what makes button animation tacky.
const PRESS_IN = { toValue: 0.97, duration: 90, easing: Easing.out(Easing.quad) };
const PRESS_OUT = { toValue: 1, duration: 140, easing: Easing.out(Easing.cubic) };

export function Button({
  label,
  variant = "primary",
  loading = false,
  icon,
  size = "md",
  style,
  disabled,
  onPressIn,
  onPressOut,
  ...pressableProps
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const { container, text } = variantStyles[variant];

  const animate = (config: typeof PRESS_IN) => {
    if (reduceMotion) return;
    Animated.timing(scale, { ...config, useNativeDriver: nativeDriverEnabled }).start();
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPressIn={(event) => {
        animate(PRESS_IN);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animate(PRESS_OUT);
        onPressOut?.(event);
      }}
      style={[
        styles.base,
        size === "sm" ? styles.small : null,
        container,
        hovered && !isDisabled ? hoverStyles[variant] : null,
        isDisabled ? styles.disabled : null,
        { transform: [{ scale }] },
        style,
      ]}
      {...pressableProps}
    >
      {loading ? (
        <ActivityIndicator color={text} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === "sm" ? 16 : 18} color={text} /> : null}
          <Text style={[styles.label, size === "sm" ? styles.labelSmall : null, { color: text }]}>
            {label}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  small: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  labelSmall: {
    fontSize: typography.size.sm,
  },
});
