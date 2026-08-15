import { useRef } from "react";
import { ActivityIndicator, Animated, Pressable, PressableProps, StyleSheet } from "react-native";
import { nativeDriverEnabled } from "../lib/animation";
import { colors, radius, spacing, typography } from "../lib/theme";
import { Text } from "./Text";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonVariant = "primary" | "secondary";

type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
};

export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled,
  onPressIn,
  onPressOut,
  ...pressableProps
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: nativeDriverEnabled,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPressIn={(event) => {
        animateTo(0.97);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateTo(1);
        onPressOut?.(event);
      }}
      style={[
        styles.base,
        variant === "primary" ? styles.primary : styles.secondary,
        isDisabled ? styles.disabled : null,
        { transform: [{ scale }] },
      ]}
      {...pressableProps}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.onAccent : colors.accent} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === "primary" ? styles.labelPrimary : styles.labelSecondary,
          ]}
        >
          {label}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  labelPrimary: {
    color: colors.onAccent,
  },
  labelSecondary: {
    color: colors.textPrimary,
  },
});
