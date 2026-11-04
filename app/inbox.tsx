import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { PressableCard } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { Text } from "../components/Text";
import { useActivity, useMarkAllRead } from "../features/activity/hooks";
import { describeActivity, type ActivityTone } from "../features/activity/describe";
import { useAuth } from "../features/auth/SessionProvider";
import { timeAgo } from "../features/listings/labels";
import { colors, layout, radius, spacing, typography } from "../lib/theme";

const toneColors: Record<ActivityTone, { bg: string; fg: string }> = {
  accent: { bg: colors.accentMuted, fg: colors.accent },
  mint: { bg: colors.mintMuted, fg: colors.mintInk },
  warning: { bg: colors.warningMuted, fg: colors.warning },
  neutral: { bg: colors.surfaceSunken, fg: colors.textSecondary },
};

export default function InboxScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const activity = useActivity();
  const markAllRead = useMarkAllRead();
  const hasUnread = !!activity.data?.some((item) => !item.read_at);

  // Opening the inbox reads it. The rows keep their dots until next visit.
  const { mutate } = markAllRead;
  useEffect(() => {
    if (hasUnread) mutate();
  }, [hasUnread, mutate]);

  if (activity.isPending) return <LoadingState />;
  if (activity.isError) {
    return <ErrorState title="Couldn't load activity" onRetry={() => activity.refetch()} />;
  }

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={styles.list}
      data={activity.data}
      keyExtractor={(item) => item.id}
      refreshing={activity.isRefetching}
      onRefresh={() => activity.refetch()}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => {
        const view = describeActivity(item, session?.user.id);
        const tone = toneColors[view.tone];
        const unread = !item.read_at;
        return (
          <View style={styles.column}>
            <PressableCard
              onPress={() => view.href && router.push(view.href)}
              accessibilityLabel={`${unread ? "New: " : ""}${view.text}, ${timeAgo(item.created_at)}`}
              style={styles.row}
            >
              <View style={[styles.icon, { backgroundColor: tone.bg }]}>
                <Ionicons name={view.icon} size={18} color={tone.fg} />
              </View>
              <View style={styles.text}>
                <Text style={[styles.body, unread && styles.bodyUnread]}>{view.text}</Text>
                <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
              </View>
              {unread ? <View style={styles.dot} /> : null}
            </PressableCard>
          </View>
        );
      }}
      ListEmptyComponent={
        <EmptyState
          icon="notifications-outline"
          title="Nothing yet"
          description="Applications, decisions, questions and references show up here as they happen."
        />
      }
      ListFooterComponent={
        (activity.data?.length ?? 0) > 0 ? (
          <Text style={styles.footer}>Showing your most recent activity.</Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  column: {
    width: "100%",
    maxWidth: layout.maxContentWidth - spacing.lg * 2,
    alignSelf: "center",
  },
  separator: {
    height: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    gap: 2,
  },
  body: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  bodyUnread: {
    color: colors.textPrimary,
    fontWeight: typography.weight.semibold,
  },
  time: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  footer: {
    marginTop: spacing.lg,
    textAlign: "center",
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
});
