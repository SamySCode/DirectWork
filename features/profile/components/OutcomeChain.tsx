import { StyleSheet, View } from "react-native";
import { Card } from "../../../components/Card";
import { NodeMeter } from "../../../components/NodeMeter";
import { Text } from "../../../components/Text";
import { colors, spacing, typography } from "../../../lib/theme";
import type { TrackRecord } from "../api";

/**
 * The track record as a chain: one node per collaboration both sides
 * confirmed, lit for completed, hollow for ended early. Nobody can add a
 * node on their own - that's what makes the chain worth reading.
 */
export function OutcomeChain({ record }: { record: TrackRecord }) {
  const ended = record.total - record.completed;
  return (
    <Card style={styles.card}>
      <View style={styles.text}>
        <Text style={styles.value}>
          {record.completed} completed {record.completed === 1 ? "collaboration" : "collaborations"}
        </Text>
        <Text style={styles.label}>
          {record.total === 0
            ? "Confirmed by both sides once a project wraps up."
            : ended > 0
              ? `${ended} more ended early. Every one confirmed by both sides.`
              : "Every one confirmed by both sides."}
        </Text>
      </View>
      {record.total > 0 ? (
        <NodeMeter
          total={record.total}
          lit={record.completed}
          size={14}
          max={12}
          accessibilityLabel={`${record.completed} of ${record.total} collaborations completed`}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  text: {
    gap: 2,
  },
  value: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  label: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
});
