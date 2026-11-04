import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";
import { Card } from "../../../components/Card";
import { NodeMeter } from "../../../components/NodeMeter";
import { Text } from "../../../components/Text";
import { colors, spacing, typography } from "../../../lib/theme";
import type { StrengthItem } from "../strength";

type ProfileStrengthCardProps = {
  items: StrengthItem[];
  tint: string;
  onFix: () => void;
};

/** Hidden once everything is done - it's a nudge, not a permanent badge. */
export function ProfileStrengthCard({ items, tint, onFix }: ProfileStrengthCardProps) {
  const done = items.filter((item) => item.done).length;
  const todo = items.filter((item) => !item.done);
  if (todo.length === 0) return null;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile strength</Text>
        <NodeMeter
          total={items.length}
          lit={done}
          color={tint}
          size={11}
          accessibilityLabel={`${done} of ${items.length} profile steps done`}
        />
      </View>
      <Text style={styles.body}>Owners decide from your profile. Finish these to stand out:</Text>
      {todo.slice(0, 3).map((item) => (
        <Pressable
          key={item.key}
          onPress={onFix}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          style={styles.item}
        >
          <Ionicons name="add-circle-outline" size={18} color={tint} />
          <Text style={[styles.itemText, { color: tint }]}>{item.label}</Text>
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  body: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 36,
  },
  itemText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
});
