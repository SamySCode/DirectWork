import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Badge } from "../../../components/Badge";
import { Button } from "../../../components/Button";
import { PressableCard } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { HeroStat, HeroStats, PageHero } from "../../../components/PageHero";
import { Screen } from "../../../components/Screen";
import { SectionHeader } from "../../../components/SectionHeader";
import { Text } from "../../../components/Text";
import type { Application } from "../../../features/applications/api";
import { useMyApplications } from "../../../features/applications/hooks";
import { applicationStatusMeta, collaborationState } from "../../../features/applications/labels";
import { opportunityLabels, timeAgo } from "../../../features/listings/labels";
import { colors, radius, spacing, tabThemes, typography } from "../../../lib/theme";

const theme = tabThemes.applications;

function isActive(app: Application): boolean {
  if (app.status === "submitted") return true;
  if (app.status !== "accepted") return false;
  const outcome = app.membership?.outcome;
  return !(outcome?.confirmed_by_owner_at && outcome?.confirmed_by_member_at);
}

function isCompleted(app: Application): boolean {
  const outcome = app.membership?.outcome;
  return (
    outcome?.outcome === "completed" &&
    !!outcome.confirmed_by_owner_at &&
    !!outcome.confirmed_by_member_at
  );
}

export default function ApplicationsScreen() {
  const router = useRouter();
  const { data, isPending, isError, refetch, isRefetching } = useMyApplications();
  const all = data ?? [];
  const active = all.filter(isActive);
  const past = all.filter((app) => !isActive(app));

  const hero = (
    <PageHero
      theme={theme}
      title="Your applications"
      subtitle="Owners see your note and profile. Your email is only shared if they accept."
    >
      {all.length > 0 ? (
        <HeroStats>
          <HeroStat
            value={all.filter((a) => a.status === "submitted").length}
            label="waiting for reply"
          />
          <HeroStat value={all.filter((a) => a.status === "accepted").length} label="accepted" />
          <HeroStat value={all.filter(isCompleted).length} label="completed" />
        </HeroStats>
      ) : null}
    </PageHero>
  );

  const renderCard = (app: Application) => {
    const status = applicationStatusMeta[app.status];
    const collab = collaborationState(app, false);
    return (
      <PressableCard
        key={app.id}
        onPress={() => router.push(`/application/${app.id}`)}
        accessibilityLabel={app.project?.title}
        style={styles.card}
      >
        <View
          style={[styles.stripe, { backgroundColor: isActive(app) ? theme.tint : colors.border }]}
        />
        <View style={styles.cardText}>
          <Text style={styles.title} numberOfLines={2}>
            {app.project?.title ?? "Listing removed"}
          </Text>
          <Text style={styles.meta}>
            {opportunityLabels[app.application_type]} · applied {timeAgo(app.created_at)}
            {app.attachments.length > 0 ? ` · ${app.attachments.length} attached` : ""}
          </Text>
          <View style={styles.badges}>
            <Badge label={collab?.label ?? status.label} tone={collab?.tone ?? status.tone} />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </PressableCard>
    );
  };

  return (
    <Screen onRefresh={() => refetch()} refreshing={isRefetching} header={hero}>
      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState title="Couldn't load your applications" onRetry={() => refetch()} />
      ) : all.length === 0 ? (
        <EmptyState
          inline
          icon="paper-plane-outline"
          title="You haven't applied to anything yet"
          description="Find a listing that fits your skills and send a short note about why you're a fit."
          actionLabel="Browse listings"
          onAction={() => router.push("/discover")}
        />
      ) : (
        <>
          {active.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="In progress" />
              {active.map(renderCard)}
            </View>
          ) : (
            <View style={[styles.nudge, { backgroundColor: theme.muted }]}>
              <Text style={styles.nudgeText}>Nothing in progress right now.</Text>
              <Button
                label="Find something new"
                size="sm"
                onPress={() => router.push("/discover")}
              />
            </View>
          )}
          {past.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="Past" />
              {past.map(renderCard)}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    overflow: "hidden",
  },
  // Status stripe down the card's left edge: tab colour while it's live.
  stripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  meta: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  badges: {
    flexDirection: "row",
    marginTop: spacing.xs,
  },
  nudge: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: "flex-start",
  },
  nudgeText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
});
