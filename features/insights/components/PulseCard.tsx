import { StyleSheet, View } from "react-native";
import { Card } from "../../../components/Card";
import { Text } from "../../../components/Text";
import { colors, spacing, typography } from "../../../lib/theme";
import type { PlatformPulse } from "../api";
import { describeCount } from "../api";

// Below this, platform totals read as "empty room" and hurt more than help -
// the card simply doesn't appear until there's something worth showing.
export const PULSE_MIN = 20;

type PulseCardProps = {
  pulse: PlatformPulse;
  /** Whose eyes: owners care about talent, professionals about work. */
  audience: "owner" | "professional";
};

export function PulseCard({ pulse, audience }: PulseCardProps) {
  const people = pulse.open_to_paid + pulse.open_to_partner;
  if (people + pulse.live_listings < PULSE_MIN) return null;

  const stats =
    audience === "owner"
      ? [
          { value: pulse.open_to_paid, label: "open to paid work" },
          { value: pulse.open_to_partner, label: "open to partnerships" },
        ]
      : [
          { value: pulse.live_listings, label: "live listings" },
          { value: pulse.completed, label: "collaborations completed" },
        ];

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Right now on DirectWork</Text>
      <View style={styles.row}>
        {stats.map((stat) => (
          <View
            key={stat.label}
            style={styles.stat}
            accessible
            accessibilityLabel={`${describeCount(stat.value)} ${stat.label}`}
          >
            <Text style={styles.value}>{describeCount(stat.value)}</Text>
            <Text style={styles.label}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  row: {
    flexDirection: "row",
    gap: spacing.xl,
  },
  stat: {
    gap: 2,
  },
  value: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.xl,
    color: colors.textPrimary,
  },
  label: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
});
