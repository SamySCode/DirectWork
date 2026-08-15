import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { colors, radius, spacing, typography } from "../lib/theme";

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export function TextField({ label, error, style, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
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
    fontSize: typography.size.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    fontSize: typography.size.xs,
    color: colors.danger,
  },
});
