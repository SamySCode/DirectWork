import { StyleSheet, View } from "react-native";
import { Card } from "../../../components/Card";
import { Text } from "../../../components/Text";
import { colors, spacing, typography } from "../../../lib/theme";
import type { LegalBlock, LegalDocument } from "../documents";

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "p":
      return <Text style={styles.body}>{block.text}</Text>;
    case "list":
      return (
        <View style={styles.list}>
          {block.items.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <Text style={styles.bullet} importantForAccessibility="no">
                {"•"}
              </Text>
              <Text style={[styles.body, styles.bulletText]}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case "rows":
      return (
        <Card style={styles.rows}>
          {block.rows.map((row, index) => (
            <View key={row.label} style={[styles.row, index > 0 ? styles.rowDivider : null]}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.body}>{row.value}</Text>
            </View>
          ))}
        </Card>
      );
  }
}

/** Renders a legal document: title, date, then headed sections. */
export function LegalDocumentView({ document }: { document: LegalDocument }) {
  return (
    <View style={styles.page}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {document.title}
        </Text>
        <Text style={styles.meta}>Last updated {document.updated}</Text>
      </View>
      {document.intro?.map((text) => (
        <Text key={text} style={styles.body}>
          {text}
        </Text>
      ))}
      {document.sections.map((part) => (
        <View key={part.heading} style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {part.heading}
          </Text>
          {part.blocks.map((block, index) => (
            <Block key={index} block={block} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  head: { gap: spacing.xs },
  title: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.xxl,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  meta: { fontSize: typography.size.sm, color: colors.textMuted },
  section: { gap: spacing.sm },
  heading: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.lg,
    color: colors.textPrimary,
  },
  body: {
    fontSize: typography.size.md,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  list: { gap: spacing.xs },
  bulletRow: { flexDirection: "row", gap: spacing.sm },
  bullet: { fontSize: typography.size.md, lineHeight: 23, color: colors.textMuted },
  bulletText: { flex: 1 },
  rows: { padding: 0 },
  row: { gap: spacing.xs, padding: spacing.md },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
});
