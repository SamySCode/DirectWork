import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Button } from "../../../components/Button";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { HeroStat, HeroStats, PageHero } from "../../../components/PageHero";
import { Screen } from "../../../components/Screen";
import { Text } from "../../../components/Text";
import { useIncomingPending } from "../../../features/applications/hooks";
import { billingAvailable } from "../../../features/billing/availability";
import { FactCard } from "../../../features/insights/components/FactCard";
import { PulseCard } from "../../../features/insights/components/PulseCard";
import { wrongTeam } from "../../../features/insights/facts";
import { usePlatformPulse } from "../../../features/insights/hooks";
import { ListingCard } from "../../../features/listings/components/ListingCard";
import { useListingQuota, useMyListings } from "../../../features/listings/hooks";
import { colors, radius, spacing, tabThemes, typography } from "../../../lib/theme";

const theme = tabThemes.listings;

export default function ListingsScreen() {
  const router = useRouter();
  const listings = useMyListings();
  const quota = useListingQuota();
  const pending = useIncomingPending();
  // Only needed for the empty state, so only fetched when there's nothing to show.
  const pulse = usePlatformPulse(listings.isSuccess && (listings.data?.length ?? 0) === 0);

  const mine = listings.data ?? [];
  const used = quota.data?.live ?? 0;
  const max = quota.data?.max_live ?? 1;
  const atLimit = used >= max;

  const hero = (
    <PageHero
      theme={theme}
      title="Your listings"
      subtitle="Every listing is reviewed before it goes live in Discover."
    >
      {mine.length > 0 ? (
        <HeroStats>
          <HeroStat value={mine.filter((l) => l.status === "published").length} label="live" />
          <HeroStat value={pending.data?.length ?? 0} label="applicants waiting" />
          <HeroStat
            value={
              mine.filter((l) => l.status === "draft" || l.status === "changes_requested").length
            }
            label="drafts"
          />
        </HeroStats>
      ) : null}
      {quota.data ? (
        <View style={styles.quota} accessibilityLabel={`${used} of ${max} live slots used`}>
          <View style={styles.quotaRow}>
            <Text style={styles.quotaText}>
              {used} of {max} live {max === 1 ? "slot" : "slots"} used
            </Text>
            {atLimit && billingAvailable ? (
              <Text style={styles.quotaLink} onPress={() => router.push("/billing")}>
                Get more
              </Text>
            ) : null}
          </View>
          <View style={styles.meter}>
            <View style={[styles.meterFill, { width: `${Math.min(100, (used / max) * 100)}%` }]} />
          </View>
        </View>
      ) : null}
      <View style={styles.heroActions}>
        <Button
          label="New listing"
          icon="add"
          variant="light"
          size="sm"
          onPress={() => router.push("/listing/new")}
        />
      </View>
    </PageHero>
  );

  return (
    <Screen
      header={hero}
      onRefresh={() => {
        listings.refetch();
        quota.refetch();
        pending.refetch();
      }}
      refreshing={listings.isRefetching}
    >
      {listings.isPending ? (
        <LoadingState />
      ) : listings.isError ? (
        <ErrorState title="Couldn't load your listings" onRetry={() => listings.refetch()} />
      ) : mine.length === 0 ? (
        <View style={styles.list}>
          <EmptyState
            inline
            icon="layers-outline"
            title="Post your first listing"
            description="Describe the work, the skills you need, and what's on offer. Our team reviews it, then it goes live in Discover. You'll see how many people have those skills as you write."
            actionLabel="Create a listing"
            onAction={() => router.push("/listing/new")}
          />
          {pulse.data ? <PulseCard pulse={pulse.data} audience="owner" /> : null}
          <FactCard fact={wrongTeam} color={theme.tint} />
        </View>
      ) : (
        <View style={styles.list}>
          {mine.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              showStatus
              onPress={() => router.push(`/listing/${listing.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  quota: {
    gap: spacing.xs,
  },
  quotaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quotaText: {
    fontSize: typography.size.xs,
    color: "rgba(255,255,255,0.8)",
  },
  quotaLink: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.onInk,
    textDecorationLine: "underline",
  },
  meter: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  meterFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.onInk,
  },
  heroActions: {
    flexDirection: "row",
  },
  list: {
    gap: spacing.md,
  },
});
