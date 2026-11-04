import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from "react-native";
import { colors, radius, spacing, typography } from "../lib/theme";
import { Text } from "./Text";

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  /** Marks the label with an asterisk. Optional fields say "(optional)" in their label instead. */
  required?: boolean;
  /** Helper text under the field, hidden while an error is showing. */
  hint?: string;
  /** Shows "used / maxLength" - needs maxLength. Turns amber in the last 10%. */
  showCount?: boolean;
  /** Password field with a show/hide button. Implies secureTextEntry. */
  secureToggle?: boolean;
};

export function TextField({
  label,
  error,
  required = false,
  hint,
  showCount = false,
  secureToggle = false,
  style,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const length = inputProps.value?.length ?? 0;
  const max = inputProps.maxLength;
  const nearLimit = !!max && length >= max * 0.9;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required ? (
          <Text style={styles.required} accessibilityLabel="required">
            {" *"}
          </Text>
        ) : null}
      </Text>
      <View>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          style={[
            styles.input,
            inputProps.multiline ? styles.inputMultiline : null,
            focused ? styles.inputFocused : null,
            error ? styles.inputError : null,
            secureToggle ? styles.inputWithToggle : null,
            style,
          ]}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...inputProps}
          secureTextEntry={secureToggle ? !revealed : inputProps.secureTextEntry}
        />
        {secureToggle ? (
          <Pressable
            onPress={() => setRevealed((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            hitSlop={10}
            style={styles.toggle}
          >
            <Ionicons
              name={revealed ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
      {error || hint || (showCount && max) ? (
        <View style={styles.footer}>
          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : hint ? (
            <Text style={styles.hint}>{hint}</Text>
          ) : (
            <View />
          )}
          {showCount && max ? (
            <Text style={[styles.count, nearLimit ? styles.countNear : null]}>
              {length} / {max}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
  },
  required: {
    color: colors.accent,
    fontWeight: typography.weight.bold,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontFamily: typography.fontFamily,
    fontSize: typography.size.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    outlineColor: colors.accent,
    outlineOffset: 2,
  },
  inputWithToggle: {
    paddingRight: 48,
  },
  toggle: {
    position: "absolute",
    right: spacing.sm,
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  inputMultiline: {
    minHeight: 100,
    paddingVertical: spacing.sm,
    textAlignVertical: "top",
  },
  inputFocused: {
    borderColor: colors.accent,
  },
  inputError: {
    borderColor: colors.danger,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  error: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.danger,
  },
  hint: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  count: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  countNear: {
    color: colors.warning,
    fontWeight: typography.weight.semibold,
  },
});
