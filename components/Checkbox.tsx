import Ionicons from "@expo/vector-icons/Ionicons";
import { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { a11yState } from "../lib/accessibility";
import { colors, minTouchTarget, radius, spacing, typography } from "../lib/theme";
import { Text } from "./Text";

type CheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Smaller text under the label: what ticking it means. */
  hint?: ReactNode;
};

/** A labelled tick box. The whole row is the touch target. */
export function Checkbox({ label, checked, onChange, hint }: CheckboxProps) {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="checkbox"
        {...a11yState({ checked })}
        accessibilityLabel={label}
        onPress={() => onChange(!checked)}
        style={styles.row}
        hitSlop={4}
      >
        <View style={[styles.box, checked ? styles.boxChecked : null]}>
          {checked ? <Ionicons name="checkmark" size={16} color={colors.onAccent} /> : null}
        </View>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: minTouchTarget },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    // The edge of a control someone has to find: 3:1 on every surface.
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: {
    flex: 1,
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  hint: {
    marginLeft: 24 + spacing.sm,
    fontSize: typography.size.xs,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
