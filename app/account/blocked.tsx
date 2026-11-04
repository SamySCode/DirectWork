import { StyleSheet, View } from "react-native";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { Screen } from "../../components/Screen";
import { Text } from "../../components/Text";
import { useBlockedPeople, useUnblock } from "../../features/safety/hooks";
import { colors, spacing, typography } from "../../lib/theme";

export default function BlockedPeopleScreen() {
  const blocked = useBlockedPeople();
  const unblock = useUnblock();

  if (blocked.isPending) return <LoadingState />;
  if (blocked.isError) return <ErrorState onRetry={() => blocked.refetch()} />;
  if (blocked.data.length === 0) {
    return (
      <EmptyState
        icon="eye-off-outline"
        title="You haven't blocked anyone"
        description="Block someone from their profile or listing. They aren't told."
      />
    );
  }

  return (
    <Screen>
      <Text style={styles.hint}>
        You don't see their listings, and neither of you can apply to the other's.
      </Text>
      {blocked.data.map((person) => (
        <Card key={person.id} style={styles.row}>
          <View style={styles.text}>
            <Text style={styles.name}>{person.full_name}</Text>
            <Text style={styles.headline} numberOfLines={1}>
              {person.headline}
            </Text>
          </View>
          <Button
            label="Unblock"
            variant="secondary"
            size="sm"
            onPress={() => unblock.mutate(person.id)}
            disabled={unblock.isPending}
          />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  text: {
    flex: 1,
  },
  name: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  headline: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
});
