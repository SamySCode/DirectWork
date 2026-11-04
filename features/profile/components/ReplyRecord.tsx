import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import { Text } from "../../../components/Text";
import { colors, spacing, typography } from "../../../lib/theme";
import type { ReplyRecord as Record } from "../api";

// Below this many applications a rate says more about luck than habit.
const MIN_SAMPLE = 3;

export function replyTime(hours: number): string {
  if (hours < 1) return "within an hour";
  if (hours < 24) return `within ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round(hours / 24);
  return `within ${days} ${days === 1 ? "day" : "days"}`;
}

/** The anti-ghosting line next to an owner: how often, and how fast, they reply. */
export function ReplyRecord({ record }: { record: Record }) {
  if (record.received < MIN_SAMPLE) {
    return (
      <View style={styles.row}>
        <Ionicons name="sparkles-outline" size={14} color={colors.textMuted} />
        <Text style={styles.muted}>New to hiring here - no reply record yet</Text>
      </View>
    );
  }
  const rate = record.replied / record.received;
  const good = rate >= 0.8;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Replies to ${record.replied} of ${record.received} applicants`}
    >
      <Ionicons
        name={good ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"}
        size={14}
        color={good ? colors.mintInk : colors.warning}
      />
      <Text style={[styles.text, { color: good ? colors.mintInk : colors.warning }]}>
        Replies to {record.replied} of {record.received} applicants
        {record.median_hours != null ? ` · usually ${replyTime(record.median_hours)}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  text: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  muted: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
});
