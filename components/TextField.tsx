import { useState } from "react";
import { StyleSheet, TextInput, TextInputProps, View } from "react-native";
import { colors, radius, spacing, typography } from "../lib/theme";
import { Text } from "./Text";

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export function TextField({ label, error, style, onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          inputProps.multiline ? styles.inputMultiline : null,
          focused ? styles.inputFocused : null,
          error ? styles.inputError : null,
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
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  error: {
    fontSize: typography.size.xs,
    color: colors.danger,
  },
});
