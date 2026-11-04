import { StyleSheet, View } from "react-native";
import { Card } from "../../../components/Card";
import { Text } from "../../../components/Text";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import type { Application } from "../api";

export type FunnelCounts = {
  applied: number;
  accepted: number;
  working: number;
  completed: number;
};

/** Counted from the applications the owner's listing page already loaded. */
export function funnelCounts(applications: Application[]): FunnelCounts {
  const accepted = applications.filter((a) => a.status === "accepted");
  const completed = accepted.filter((a) => {
    const outcome = a.membership?.outcome;
    return (
      outcome?.outcome === "completed" &&
      !!outcome.confirmed_by_owner_at &&
      !!outcome.confirmed_by_member_at
    );
  });
  return {
    applied: applications.length,
    accepted: accepted.length,
    working: accepted.filter((a) => !a.membership?.left_at).length,
    completed: completed.length,
  };
}

const STAGES: { key: keyof FunnelCounts; label: string }[] = [
  { key: "applied", label: "Applied" },
  { key: "accepted", label: "Accepted" },
  { key: "working", label: "Working now" },
  { key: "completed", label: "Completed" },
];

/** Each bar is a share of everyone who applied. */
export function ApplicantFunnel({ counts }: { counts: FunnelCounts }) {
  if (counts.applied === 0) return null;
  return (
    <Card style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        Applicants so far
      </Text>
      {STAGES.map(({ key, label }) => {
        const value = counts[key];
        const share = value / counts.applied;
        return (
          <View key={key} style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.bar,
                  {
                    width: `${Math.max(share * 100, value > 0 ? 4 : 0)}%`,
                    backgroundColor: key === "completed" ? colors.mint : colors.accent,
                  },
                ]}
              />
            </View>
            <Text style={styles.value}>{value}</Text>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    width: 92,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  track: {
    flex: 1,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: radius.pill,
  },
  value: {
    width: 28,
    textAlign: "right",
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
});
