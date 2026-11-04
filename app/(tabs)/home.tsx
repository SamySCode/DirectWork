import Ionicons from "@expo/vector-icons/Ionicons";
import { Href, useRouter } from "expo-router";
import { ComponentProps, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../../components/Button";
import { PressableCard } from "../../components/Card";
import { ConnectMark } from "../../components/ConnectMark";
import { EmptyState } from "../../components/EmptyState";
import { HeroStat, HeroStats, PageHero } from "../../components/PageHero";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { Text } from "../../components/Text";
import { InboxButton } from "../../features/activity/components/InboxButton";
import { useIncomingPending, useMyApplications } from "../../features/applications/hooks";
import { collaborationState } from "../../features/applications/labels";
import { ListingCard } from "../../features/listings/components/ListingCard";
import { useDiscover, useMyListings } from "../../features/listings/hooks";
import { PulseCard } from "../../features/insights/components/PulseCard";
import { usePlatformPulse } from "../../features/insights/hooks";
import { AvailabilityCheck } from "../../features/profile/components/AvailabilityCheck";
import { FirstSteps } from "../../features/profile/components/FirstSteps";
import { availabilityFreshness } from "../../features/profile/freshness";
import { useConfirmAvailability, useMyProfile, usePortfolio } from "../../features/profile/hooks";
import { profileStrength } from "../../features/profile/strength";
import { colors, radius, spacing, tabThemes, typography } from "../../lib/theme";

type ActionItem = {
  key: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  detail: string;
  href: Href;
  tone: "accent" | "mint" | "warning";
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const toneColors = {
  accent: { bg: colors.accentMuted, fg: colors.accent },
  mint: { bg: colors.mintMuted, fg: colors.mintInk },
  warning: { bg: colors.warningMuted, fg: colors.warning },
};

export default function HomeScreen() {
  const router = useRouter();
  const { profile, skills } = useMyProfile();
  const applications = useMyApplications();
  const incoming = useIncomingPending();
  const listings = useMyListings();
  const discover = useDiscover({ query: "", remoteOnly: false });

  const seeking = !!profile && (profile.seeking_paid || profile.seeking_partner);
  const freshness = profile ? availabilityFreshness(profile) : null;
  const confirmAvailability = useConfirmAvailability();
  const hiring = !!profile?.wants_to_hire || (listings.data?.length ?? 0) > 0;
  const mySkills = useMemo(() => new Set(skills.map((s) => s.toLowerCase())), [skills]);

  // First run: until someone has applied or posted, Home leads with a path
  // rather than an empty "all caught up".
  const isNewHere =
    applications.isSuccess &&
    listings.isSuccess &&
    applications.data.length === 0 &&
    listings.data.length === 0;
  const portfolio = usePortfolio(isNewHere ? profile?.id : undefined);
  const pulse = usePlatformPulse(isNewHere);
  const profileDone =
    !!profile &&
    profileStrength(profile, skills.length, portfolio.data?.length ?? 0).every((item) => item.done);
  const firstSteps = [
    {
      key: "profile",
      label: "Finish your profile",
      detail: "Owners decide from it - a photo, three skills and some work go a long way.",
      done: profileDone,
      onPress: () => router.push("/account/edit"),
    },
    seeking
      ? {
          key: "apply",
          label: "Apply to a listing that fits",
          detail: "Listings matching your skills are highlighted in Discover.",
          done: false,
          onPress: () => router.push("/discover"),
        }
      : {
          key: "post",
          label: "Post your first listing",
          detail: "You'll see how many people have the skills you need as you write it.",
          done: false,
          onPress: () => router.push("/listing/new"),
        },
    {
      key: "reply",
      label: seeking ? "Hear back" : "Pick someone to work with",
      detail: seeking
        ? "Every owner shows how often they reply, so you know what to expect."
        : "Accept an applicant and you both get each other's contact details.",
      done: false,
    },
  ];

  const actions = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];
    const byListing = new Map<string, { title: string; count: number }>();
    for (const app of incoming.data ?? []) {
      const entry = byListing.get(app.project_id) ?? { title: app.project?.title ?? "", count: 0 };
      entry.count += 1;
      byListing.set(app.project_id, entry);
    }
    for (const [id, { title, count }] of byListing) {
      items.push({
        key: `incoming-${id}`,
        icon: "people",
        title: `${count} ${count === 1 ? "person wants" : "people want"} to join`,
        detail: title,
        href: `/listing/${id}`,
        tone: "accent",
      });
    }
    for (const listing of listings.data ?? []) {
      if (listing.status === "changes_requested") {
        items.push({
          key: `changes-${listing.id}`,
          icon: "create",
          title: "A reviewer asked for changes",
          detail: listing.title,
          href: `/listing/${listing.id}`,
          tone: "warning",
        });
      }
    }
    for (const app of applications.data ?? []) {
      const state = collaborationState(app, false);
      if (state?.needsYou) {
        items.push({
          key: `outcome-${app.id}`,
          icon: "checkmark-done",
          title: state.label,
          detail: app.project?.title ?? "",
          href: `/application/${app.id}`,
          tone: "warning",
        });
      } else if (app.status === "accepted" && !app.membership?.outcome) {
        items.push({
          key: `accepted-${app.id}`,
          icon: "sparkles",
          title: "You're in - contact details unlocked",
          detail: app.project?.title ?? "",
          href: `/application/${app.id}`,
          tone: "mint",
        });
      }
    }
    return items;
  }, [incoming.data, listings.data, applications.data]);

  const picks = useMemo(() => {
    const firstPage = discover.data?.pages[0] ?? [];
    return firstPage
      .filter((listing) => listing.owner_id !== profile?.id)
      .map((listing) => ({
        listing,
        score: listing.skills.filter((s) => mySkills.has(s.toLowerCase())).length,
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ listing }) => listing);
  }, [discover.data, mySkills, profile?.id]);

  const refreshing =
    applications.isRefetching ||
    incoming.isRefetching ||
    listings.isRefetching ||
    discover.isRefetching;
  const refresh = () => {
    applications.refetch();
    incoming.refetch();
    listings.refetch();
    discover.refetch();
  };

  const firstName = profile?.full_name.split(" ")[0] ?? "";
  const live = (applications.data ?? []).filter((a) => a.status === "submitted").length;
  const working = (applications.data ?? []).filter(
    (a) => a.status === "accepted" && !a.membership?.left_at,
  ).length;

  return (
    <Screen
      onRefresh={refresh}
      refreshing={refreshing}
      header={
        <PageHero
          theme={tabThemes.home}
          title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
          top={
            <View style={styles.heroTop}>
              <ConnectMark tone="light" size={24} lit={working > 0} />
              <InboxButton />
            </View>
          }
        >
          <HeroStats>
            {seeking ? (
              <>
                <HeroStat value={live} label="waiting for reply" />
                <HeroStat value={working} label="working together" />
              </>
            ) : null}
            {hiring ? (
              <HeroStat
                value={(listings.data ?? []).filter((l) => l.status === "published").length}
                label="live listings"
              />
            ) : null}
          </HeroStats>
          <View style={styles.heroActions}>
            {seeking ? (
              <Button
                label="Browse listings"
                icon="compass"
                variant="light"
                size="sm"
                onPress={() => router.push("/discover")}
              />
            ) : null}
            {hiring || !seeking ? (
              <Button
                label="Post a listing"
                icon="add"
                variant={seeking ? "onDark" : "light"}
                size="sm"
                onPress={() => router.push("/listing/new")}
              />
            ) : null}
          </View>
        </PageHero>
      }
    >
      {isNewHere ? (
        <>
          <FirstSteps steps={firstSteps} />
          {pulse.data ? (
            <PulseCard pulse={pulse.data} audience={seeking ? "professional" : "owner"} />
          ) : null}
        </>
      ) : null}

      {freshness?.nudge ? (
        <AvailabilityCheck
          freshness={freshness}
          confirming={confirmAvailability.isPending}
          onConfirm={() => confirmAvailability.mutate()}
          onUpdate={() => router.push("/account/edit")}
        />
      ) : null}

      {isNewHere && actions.length === 0 ? null : (
        <View style={styles.section}>
          <SectionHeader title="Needs you" />
          {actions.length > 0 ? (
            actions.map((item) => {
              const tone = toneColors[item.tone];
              return (
                <PressableCard
                  key={item.key}
                  onPress={() => router.push(item.href)}
                  accessibilityLabel={`${item.title}: ${item.detail}`}
                  style={styles.action}
                >
                  <View style={[styles.actionIcon, { backgroundColor: tone.bg }]}>
                    <Ionicons name={item.icon} size={20} color={tone.fg} />
                  </View>
                  <View style={styles.actionText}>
                    <Text style={styles.actionTitle}>{item.title}</Text>
                    <Text style={styles.actionDetail} numberOfLines={1}>
                      {item.detail}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </PressableCard>
              );
            })
          ) : (
            <EmptyState
              inline
              icon="checkmark-circle-outline"
              title="You're all caught up"
              description="Replies to your applications and new applicants on your listings show up here."
            />
          )}
        </View>
      )}

      {seeking ? (
        <View style={styles.section}>
          <SectionHeader
            title="Picked for your skills"
            actionLabel="See all"
            onAction={() => router.push("/discover")}
          />
          {picks.length > 0 ? (
            picks.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                mySkills={mySkills}
                onPress={() => router.push(`/listing/${listing.id}`)}
              />
            ))
          ) : (
            <EmptyState
              inline
              icon="sparkles-outline"
              title="No close matches yet"
              description="New listings are reviewed and added every week. Add more skills to your profile to widen your matches."
              actionLabel="Edit skills"
              onAction={() => router.push("/account/edit")}
            />
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroActions: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  section: {
    gap: spacing.md,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  actionDetail: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
});
