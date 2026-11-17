import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Switch, View } from "react-native";
import { Card } from "../../../components/Card";
import { Text } from "../../../components/Text";
import { hapticsSupported, setHapticsEnabled, useHapticsEnabled } from "../../../lib/haptics";
import { colors, minTouchTarget, spacing, typography } from "../../../lib/theme";

type DeviceSettingsProps = { tint?: string };

/**
 * Settings that belong to this phone rather than to the account, so they
 * aren't on the profile and don't follow people to other devices. Phones
 * only: the web has nothing to set here.
 */
export function DeviceSettings({ tint = colors.accent }: DeviceSettingsProps) {
  const vibration = useHapticsEnabled();
  if (!hapticsSupported()) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.heading} accessibilityRole="header">
        On this phone
      </Text>
      <Card style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="phone-portrait-outline" size={20} color={colors.textSecondary} />
          <View style={styles.text}>
            <Text style={styles.label}>Vibration</Text>
            <Text style={styles.detail}>A light tap when something saves or a filter changes.</Text>
          </View>
          <Switch
            value={vibration}
            onValueChange={(on) => void setHapticsEnabled(on)}
            accessibilityLabel="Vibration"
            accessibilityHint="A light tap when something saves or a filter changes"
            trackColor={{ true: tint, false: colors.surfaceSunken }}
            ios_backgroundColor={colors.surfaceSunken}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  heading: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  card: {
    padding: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: minTouchTarget + spacing.sm,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  detail: {
    fontSize: typography.size.xs,
    lineHeight: 16,
    color: colors.textSecondary,
  },
});
