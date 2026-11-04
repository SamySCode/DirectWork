import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import { Text } from "../../../components/Text";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import { describeCount } from "../api";
import { useTalentCount } from "../hooks";

type TalentPoolProps = {
  skills: string[];
  type: "paid" | "partner";
};

/**
 * Shown while an owner writes a listing: real people, right now, who could
 * do this work. The single most persuasive fact for posting - and it's live.
 */
export function TalentPool({ skills, type }: TalentPoolProps) {
  const talent = useTalentCount(skills, type);
  if (skills.length === 0 || talent.data === undefined) return null;

  const count = talent.data;
  const who = type === "paid" ? "open to paid work" : "open to partnerships";
  return (
    <View
      style={[styles.box, count > 0 ? styles.boxLive : styles.boxEmpty]}
      accessible
      accessibilityLiveRegion="polite"
    >
      <Ionicons
        name={count > 0 ? "people" : "people-outline"}
        size={20}
        color={count > 0 ? colors.mintInk : colors.textSecondary}
      />
      <View style={styles.text}>
        <Text style={[styles.count, { color: count > 0 ? colors.mintInk : colors.textPrimary }]}>
          {describeCount(count)} {count === 1 ? "professional" : "professionals"} {who}
        </Text>
        <Text style={styles.detail}>
          {count > 0
            ? "have at least one of these skills on their profile right now."
            : "list these skills yet. Post anyway - new people join every week, and reviewed listings are what bring them."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  boxLive: {
    backgroundColor: colors.mintMuted,
  },
  boxEmpty: {
    backgroundColor: colors.surfaceSunken,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  count: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  detail: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },
});
