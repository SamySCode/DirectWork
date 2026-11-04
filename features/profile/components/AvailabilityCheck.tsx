import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Text } from "../../../components/Text";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import { FRESH_DAYS, type Freshness } from "../freshness";

type AvailabilityCheckProps = {
  freshness: Freshness;
  onConfirm: () => void;
  onUpdate: () => void;
  confirming: boolean;
};

/**
 * "Still available?" - asked shortly before an open-to-work claim lapses, so
 * owners only ever see people who are actually around.
 */
export function AvailabilityCheck({
  freshness,
  onConfirm,
  onUpdate,
  confirming,
}: AvailabilityCheckProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name="pulse" size={20} color={colors.warning} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>
            {freshness.stale ? "Are you still open to work?" : "Still open to work?"}
          </Text>
          <Text style={styles.body}>
            {freshness.stale
              ? "You're hidden from talent counts until you confirm. Owners only see people who are actually available."
              : `Availability counts for ${FRESH_DAYS} days after you confirm it. One tap keeps you visible.`}
          </Text>
        </View>
      </View>
      <View style={styles.buttons}>
        <Button
          label="Still available"
          icon="checkmark"
          size="sm"
          onPress={onConfirm}
          loading={confirming}
          style={styles.flex}
        />
        <Button
          label="Update"
          variant="secondary"
          size="sm"
          onPress={onUpdate}
          style={styles.flex}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.warningMuted,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  body: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  buttons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
});
