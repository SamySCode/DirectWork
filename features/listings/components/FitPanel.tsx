import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import { Card } from "../../../components/Card";
import { NodeMeter } from "../../../components/NodeMeter";
import { Text } from "../../../components/Text";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import type { Fit } from "../fit";

/** "Why you fit" on a listing - facts from both sides, no invented score. */
export function FitPanel({ fit }: { fit: Fit }) {
  const total = fit.matchedSkills.length + fit.missingSkills.length;
  if (total === 0 && fit.signals.length === 0) return null;

  return (
    <Card style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        How you fit
      </Text>
      {total > 0 ? (
        <View style={styles.skills}>
          <View style={styles.meterRow}>
            <NodeMeter
              total={total}
              lit={fit.matchedSkills.length}
              size={12}
              accessibilityLabel={`${fit.matchedSkills.length} of ${total} skills match`}
            />
            <Text style={styles.count}>
              {fit.matchedSkills.length} of {total} skills
            </Text>
          </View>
          {fit.missingSkills.length > 0 ? (
            <Text style={styles.missing}>Not on your profile: {fit.missingSkills.join(", ")}</Text>
          ) : null}
        </View>
      ) : null}
      {fit.signals.map((signal) => (
        <View key={signal.key} style={styles.signal}>
          <View style={[styles.dot, signal.ok ? styles.dotOk : styles.dotNo]}>
            <Ionicons
              name={signal.ok ? "checkmark" : "remove"}
              size={12}
              color={signal.ok ? colors.mintInk : colors.textMuted}
            />
          </View>
          <Text style={styles.signalText}>{signal.label}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  skills: {
    gap: spacing.xs,
  },
  meterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  count: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.mintInk,
  },
  missing: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  signal: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  dotOk: {
    backgroundColor: colors.mintMuted,
  },
  dotNo: {
    backgroundColor: colors.surfaceSunken,
  },
  signalText: {
    fontSize: typography.size.sm,
    color: colors.textPrimary,
  },
});
