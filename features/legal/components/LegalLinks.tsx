import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Card } from "../../../components/Card";
import { Text } from "../../../components/Text";
import { colors, spacing, typography } from "../../../lib/theme";
import { legalDocuments } from "../documents";

/** Every legal document as a tappable list, each opening /legal/<slug>. */
export function LegalLinks() {
  const router = useRouter();
  return (
    <Card style={styles.card}>
      {legalDocuments.map((doc, index) => (
        <Pressable
          key={doc.slug}
          accessibilityRole="link"
          accessibilityLabel={doc.title}
          accessibilityHint={doc.summary}
          onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: doc.slug } })}
          style={[styles.row, index > 0 ? styles.divider : null]}
        >
          <View style={styles.text}>
            <Text style={styles.title}>{doc.title}</Text>
            <Text style={styles.summary}>{doc.summary}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    minHeight: 52,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  text: { flex: 1, gap: 2 },
  title: { fontSize: typography.size.md, color: colors.textPrimary },
  summary: { fontSize: typography.size.sm, color: colors.textMuted },
});
