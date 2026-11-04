import { useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { Text } from "../components/Text";
import { guide, type GuideSection } from "../features/guide/tips";
import { colors, spacing, typography } from "../lib/theme";

/** The full guide: profile, listings, applying. `?section=` puts one first. */
export default function GuideScreen() {
  const { section } = useLocalSearchParams<{ section?: GuideSection["key"] }>();
  const ordered = section
    ? [...guide].sort((a, b) => (a.key === section ? -1 : b.key === section ? 1 : 0))
    : guide;

  return (
    <Screen>
      <View style={styles.intro}>
        <Text style={styles.title} accessibilityRole="header">
          Getting the most from DirectWork
        </Text>
        <Text style={styles.lead}>
          Short, practical advice for the three things that matter here: your profile, your
          listings, and your applications.
        </Text>
      </View>
      {ordered.map((part) => (
        <View key={part.key} style={styles.section}>
          <SectionHeader title={part.title} />
          <Text style={styles.sectionIntro}>{part.intro}</Text>
          <Card style={styles.card}>
            {part.tips.map((tip, index) => (
              <View key={tip.title} style={[styles.tip, index > 0 ? styles.tipDivider : null]}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipBody}>{tip.body}</Text>
              </View>
            ))}
          </Card>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: spacing.sm,
  },
  title: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.xxl,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  lead: {
    fontSize: typography.size.md,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  section: {
    gap: spacing.md,
  },
  sectionIntro: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  card: {
    padding: 0,
  },
  tip: {
    gap: spacing.xs,
    padding: spacing.lg,
  },
  tipDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tipTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  tipBody: {
    fontSize: typography.size.sm,
    lineHeight: 21,
    color: colors.textSecondary,
  },
});
