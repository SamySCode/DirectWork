import Ionicons from "@expo/vector-icons/Ionicons";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { DotGrid } from "../../../components/DotGrid";
import { Text } from "../../../components/Text";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import type { Fact } from "../facts";

type FactCardProps = {
  fact: Fact;
  /** "dark" for gradient backgrounds (welcome), "light" for normal surfaces. */
  tone?: "light" | "dark";
  /** Accent for the lit dots / highlighted rank. */
  color?: string;
};

export function FactCard({ fact, tone = "light", color = colors.accent }: FactCardProps) {
  const dark = tone === "dark";
  const fg = dark ? colors.onInk : colors.textPrimary;
  const fgMuted = dark ? colors.onInkMuted : colors.textSecondary;

  return (
    <View style={[styles.card, dark ? styles.cardDark : styles.cardLight]}>
      {fact.kind === "share" ? (
        <View style={styles.shareRow}>
          <DotGrid
            value={fact.value}
            color={color}
            dimColor={dark ? "rgba(255,255,255,0.18)" : colors.border}
            size={7}
            accessibilityLabel={`${fact.value} out of 100`}
          />
          <View style={styles.shareText}>
            <Text style={[styles.big, { color: fg }]}>{fact.headline}</Text>
            <Text style={[styles.detail, { color: fgMuted }]}>{fact.detail}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.rank}>
          <Text style={[styles.rankHeadline, { color: fg }]}>{fact.headline}</Text>
          {fact.ranking.map((reason, index) => {
            const hot = index === fact.highlight;
            return (
              <View key={reason} style={styles.rankRow}>
                <Text style={[styles.rankNumber, { color: hot ? color : fgMuted }]}>
                  #{index + 1}
                </Text>
                <View
                  style={[
                    styles.rankBar,
                    {
                      // Rank, not magnitude: bars step down evenly so nobody
                      // reads a percentage the source doesn't support.
                      width: `${100 - index * 18}%`,
                      backgroundColor: hot
                        ? color
                        : dark
                          ? "rgba(255,255,255,0.14)"
                          : colors.surfaceSunken,
                    },
                  ]}
                >
                  <Text
                    style={[styles.rankLabel, { color: hot ? colors.onAccent : fg }]}
                    numberOfLines={1}
                  >
                    {reason}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Text style={[styles.answer, { color: fg }]}>{fact.answer}</Text>

      <Pressable
        onPress={() => Linking.openURL(fact.source.url)}
        accessibilityRole="link"
        accessibilityLabel={`Source: ${fact.source.label}`}
        hitSlop={8}
        style={styles.source}
      >
        <Ionicons name="document-text-outline" size={12} color={fgMuted} />
        <Text style={[styles.sourceText, { color: fgMuted }]}>Source: {fact.source.label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  cardLight: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDark: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  shareRow: {
    flexDirection: "row",
    gap: spacing.lg,
    alignItems: "center",
  },
  shareText: {
    flex: 1,
    gap: spacing.xs,
  },
  big: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.xl,
  },
  detail: {
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
  rank: {
    gap: spacing.sm,
  },
  rankHeadline: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rankNumber: {
    width: 24,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  rankBar: {
    minHeight: 28,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  rankLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  answer: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    lineHeight: 20,
  },
  source: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sourceText: {
    fontSize: typography.size.xs,
    textDecorationLine: "underline",
  },
});
