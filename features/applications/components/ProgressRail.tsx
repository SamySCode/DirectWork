import { StyleSheet, View } from "react-native";
import { Text } from "../../../components/Text";
import { colors, spacing, typography } from "../../../lib/theme";
import type { Application } from "../api";

// The signature connection motif stretched into a timeline: each node is a
// real state from the application/outcome model, lit as it's reached.
const STEPS = ["Applied", "Accepted", "Working together", "Confirmed"] as const;

function reached(application: Application): number {
  if (application.status !== "accepted") return 0;
  const outcome = application.membership?.outcome;
  if (outcome?.confirmed_by_owner_at && outcome?.confirmed_by_member_at) return 3;
  return 2;
}

export function ProgressRail({ application }: { application: Application }) {
  const ended = application.status === "rejected" || application.status === "withdrawn";
  const step = reached(application);

  return (
    <View
      style={styles.rail}
      accessibilityLabel={ended ? "Application closed" : `Progress: ${STEPS[step]}`}
    >
      {STEPS.map((label, index) => {
        const lit = !ended && index <= step;
        const final = lit && step === 3;
        return (
          <View key={label} style={styles.step}>
            <View style={styles.track}>
              <View
                style={[
                  styles.line,
                  index === 0 ? styles.hidden : null,
                  lit ? { backgroundColor: final ? colors.mint : colors.accent } : null,
                ]}
              />
              <View
                style={[
                  styles.node,
                  lit
                    ? {
                        backgroundColor: final ? colors.mint : colors.accent,
                        borderColor: "transparent",
                      }
                    : null,
                ]}
              />
              <View
                style={[
                  styles.line,
                  index === STEPS.length - 1 ? styles.hidden : null,
                  !ended && index < step
                    ? { backgroundColor: step === 3 ? colors.mint : colors.accent }
                    : null,
                ]}
              />
            </View>
            <Text style={[styles.label, lit ? styles.labelLit : null]} numberOfLines={2}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: "row",
  },
  step: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  track: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
  },
  line: {
    flex: 1,
    height: 3,
    backgroundColor: colors.border,
  },
  hidden: {
    opacity: 0,
  },
  node: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    textAlign: "center",
  },
  labelLit: {
    color: colors.textPrimary,
    fontWeight: typography.weight.semibold,
  },
});
