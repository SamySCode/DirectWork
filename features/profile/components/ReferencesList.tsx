import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import { Avatar } from "../../../components/Avatar";
import { Card } from "../../../components/Card";
import { Text } from "../../../components/Text";
import { colors, spacing, typography } from "../../../lib/theme";
import { avatarUrl, type WorkReference } from "../api";

/**
 * References can only come from someone who completed work with this person
 * and confirmed it on both sides - the opposite of a self-curated
 * endorsement wall. The badge says so, so readers know what they're worth.
 */
export function ReferencesList({ references }: { references: WorkReference[] }) {
  if (references.length === 0) return null;
  return (
    <View style={styles.list}>
      {references.map((ref) => {
        const name = ref.author?.full_name ?? "Former collaborator";
        return (
          <Card key={ref.id} style={styles.card}>
            <Text style={styles.quote}>“{ref.body}”</Text>
            <View style={styles.footer}>
              <Avatar name={name} uri={avatarUrl(ref.author?.avatar_url)} size={28} />
              <View style={styles.who}>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.context} numberOfLines={1}>
                  {ref.project_title}
                </Text>
              </View>
            </View>
            <View
              style={styles.verified}
              accessibilityLabel="Verified: from a completed collaboration both sides confirmed"
            >
              <Ionicons name="shield-checkmark" size={14} color={colors.mintInk} />
              <Text style={styles.verifiedText}>Verified collaboration</Text>
            </View>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.md,
  },
  quote: {
    fontSize: typography.size.md,
    lineHeight: 23,
    color: colors.textPrimary,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  who: {
    flex: 1,
  },
  name: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  context: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  verified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifiedText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mintInk,
  },
});
