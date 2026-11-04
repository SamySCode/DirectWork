import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { FadeIn } from "../../../components/FadeIn";
import { Text } from "../../../components/Text";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import { guideSection, type GuideSection } from "../tips";

/**
 * Collapsible tips at the top of a form. Closed by default so it never
 * pushes the form down for people who don't need it; one tap to open.
 */
export function TipsCard({ section }: { section: GuideSection["key"] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const content = guideSection(section);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Tips: ${content.title}`}
        style={styles.header}
      >
        <Ionicons name="bulb-outline" size={18} color={colors.accent} />
        <Text style={styles.title}>Tips: {content.title.toLowerCase()}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
      </Pressable>
      {open ? (
        <FadeIn duration={160}>
          <View style={styles.body}>
            {content.tips.slice(0, 4).map((tip) => (
              <View key={tip.title} style={styles.tip}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipBody}>{tip.body}</Text>
              </View>
            ))}
            <Pressable onPress={() => router.push("/guide")} accessibilityRole="link" hitSlop={8}>
              <Text style={styles.more}>Read the full guide</Text>
            </Pressable>
          </View>
        </FadeIn>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.accentMuted,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  body: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  tip: {
    gap: 2,
  },
  tipTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  tipBody: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  more: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.accent,
  },
});
