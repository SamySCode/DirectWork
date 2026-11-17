import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Chip } from "../../../components/Chip";
import { SegmentedTabs } from "../../../components/SegmentedTabs";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { PageHero } from "../../../components/PageHero";
import { Text } from "../../../components/Text";
import { DiscoverFilterPanel } from "../../../features/listings/components/DiscoverFilterPanel";
import type { ListingDetail } from "../../../features/listings/api";
import { ListingCard } from "../../../features/listings/components/ListingCard";
import { ListingListSkeleton } from "../../../features/listings/components/ListingSkeletons";
import { useDiscoverFilters } from "../../../features/listings/useDiscoverFilters";
import { topSkills } from "../../../features/listings/demand";
import { useDiscover } from "../../../features/listings/hooks";
import { useMyProfile } from "../../../features/profile/hooks";
import { colors, layout, radius, spacing, tabThemes, typography } from "../../../lib/theme";
import { useDebounced } from "../../../lib/useDebounced";
import { useReducedMotion } from "../../../lib/accessibility";
import { useTabReselect } from "../../../lib/tabReselect";
import { useBlockedIds } from "../../../features/safety/hooks";

const theme = tabThemes.discover;

// Defined once: an inline component here would be a new type on every
// render, remounting every separator each time the screen updates.
function Separator() {
  return <View style={styles.separator} />;
}

export default function DiscoverScreen() {
  const router = useRouter();
  const list = useRef<FlatList<ListingDetail>>(null);
  const reduceMotion = useReducedMotion();
  useTabReselect("discover", () =>
    list.current?.scrollToOffset({ offset: 0, animated: !reduceMotion }),
  );
  const { skills, profile } = useMyProfile();
  const mySkills = useMemo(() => new Set(skills.map((s) => s.toLowerCase())), [skills]);

  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const query = useDebounced(search);
  const filters = useDiscoverFilters(query);

  const blocked = useBlockedIds();
  const discover = useDiscover(
    blocked.data?.length ? { ...filters.server, excludeOwners: blocked.data } : filters.server,
  );
  // The server leaves blocked owners out once it is told who they are, but
  // the first request of a session goes out before the block list is back.
  // Dropping them here too, and holding the list until the block list has
  // loaded, means a blocked owner's listing never flashes on screen.
  const blockedOwners = useMemo(() => new Set(blocked.data ?? []), [blocked.data]);
  const loading = discover.isPending || !!blocked.isPending;
  const loaded = useMemo(
    () =>
      loading
        ? []
        : (discover.data?.pages.flat() ?? []).filter(
            (l) => l.owner_id !== profile?.id && !blockedOwners.has(l.owner_id),
          ),
    [loading, discover.data, profile?.id, blockedOwners],
  );
  // "In demand": the most-requested skills across what's loaded - computed
  // here, no extra query. Tapping one narrows the loaded list to it.
  const demand = useMemo(() => topSkills(loaded), [loaded]);
  const overlap = useCallback(
    (skills: string[]) => skills.filter((s) => mySkills.has(s.toLowerCase())).length,
    [mySkills],
  );
  // Client-side refinements over what's loaded: the demand chip, "needs my
  // skills", and best-match ordering (they need the viewer's skills).
  const listings = useMemo(() => {
    let out = loaded;
    if (skillFilter) {
      out = out.filter((l) => l.skills.some((s) => s.toLowerCase() === skillFilter.toLowerCase()));
    }
    if (filters.refine.matchesOnly) out = out.filter((l) => overlap(l.skills) > 0);
    if (filters.sort === "match") {
      out = [...out].sort((a, b) => overlap(b.skills) - overlap(a.skills));
    }
    return out;
  }, [loaded, skillFilter, filters.refine.matchesOnly, filters.sort, overlap]);
  const mySkillSet = (skill: string) => mySkills.has(skill.toLowerCase());
  // Stable across renders, so typing in the search box re-renders the header
  // and not every card in the list (ListingCard is memoised).
  const openListing = useCallback(
    (listing: ListingDetail) => router.push(`/listing/${listing.id}`),
    [router],
  );
  const renderItem = useCallback<ListRenderItem<ListingDetail>>(
    ({ item }) => (
      <View style={styles.column}>
        <ListingCard listing={item} mySkills={mySkills} onPress={openListing} />
      </View>
    ),
    [mySkills, openListing],
  );
  const matching = listings.filter((l) => l.skills.some((s) => mySkills.has(s.toLowerCase())));
  const filtersActive =
    !!query || filters.type !== "all" || filters.active.length > 0 || !!skillFilter;

  const header = (
    <View>
      <PageHero
        theme={theme}
        title="Discover"
        subtitle={
          listings.length > 0 && matching.length > 0
            ? `${matching.length} of ${listings.length} shown match your skills`
            : "Every listing here was reviewed by our team before it went live."
        }
      >
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by title or description"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            maxLength={100}
            accessibilityLabel="Search listings"
          />
          {search ? (
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.textMuted}
              onPress={() => setSearch("")}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={12}
            />
          ) : null}
        </View>
      </PageHero>
      <View style={[styles.column, styles.filters]}>
        <SegmentedTabs
          accessibilityLabel="Type of work"
          tint={theme.tint}
          value={filters.type}
          onChange={filters.setType}
          options={[
            { value: "all", label: "All" },
            { value: "paid", label: "Paid work" },
            { value: "partner", label: "Partnerships" },
          ]}
        />
        <DiscoverFilterPanel
          filters={filters}
          open={filtersOpen}
          onToggle={() => setFiltersOpen((v) => !v)}
          tint={theme.tint}
          canMatch={mySkills.size > 0}
        />
      </View>
      {demand.length > 0 ? (
        <View style={[styles.column, styles.demand]}>
          <Text style={styles.demandTitle}>In demand right now</Text>
          <View style={styles.demandRow}>
            {demand.map((skill) => {
              const selected = skillFilter === skill;
              return (
                <Chip
                  key={skill}
                  label={mySkillSet(skill) ? `✓ ${skill}` : skill}
                  tint={theme.tint}
                  selected={selected}
                  accessibilityLabel={`Show listings asking for ${skill}`}
                  onPress={() => setSkillFilter(selected ? null : skill)}
                />
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );

  // One FlatList throughout, so the header (and the search and pay inputs
  // in it) never remounts mid-typing; loading and errors show in its body.
  return (
    <FlatList
      ref={list}
      style={styles.page}
      contentContainerStyle={styles.list}
      data={listings}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      renderItem={renderItem}
      ItemSeparatorComponent={Separator}
      onEndReached={() => {
        if (discover.hasNextPage && !discover.isFetchingNextPage) discover.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      // useDiscover keeps a few pages at a time (maxPages), so scrolling on
      // drops the oldest off the top. Scrolling back up fetches it again, and
      // native keeps the visible rows still while rows above them change
      // (web has no maintainVisibleContentPosition; the browser's scroll
      // anchoring covers most of it).
      onStartReached={() => {
        if (discover.hasPreviousPage && !discover.isFetchingPreviousPage) {
          discover.fetchPreviousPage();
        }
      }}
      onStartReachedThreshold={0.5}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      refreshing={
        !!discover.isRefetching && !discover.isFetchingNextPage && !discover.isFetchingPreviousPage
      }
      onRefresh={() => discover.refetch()}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        <View style={styles.column}>
          {loading ? (
            <ListingListSkeleton />
          ) : discover.isError ? (
            <ErrorState
              title="Couldn't load listings"
              description="Check your connection and try again."
              onRetry={() => discover.refetch()}
            />
          ) : filtersActive ? (
            <EmptyState
              inline
              icon="search-outline"
              title="Nothing matches those filters"
              description="Try a broader search, or clear the filters."
              actionLabel="Clear filters"
              onAction={() => {
                setSearch("");
                filters.setType("all");
                filters.clear();
                setSkillFilter(null);
              }}
            />
          ) : (
            <EmptyState
              inline
              icon="compass-outline"
              title="No live listings yet"
              description="Every listing is reviewed before it appears here. Check back soon, or post your own."
              actionLabel="Post a listing"
              onAction={() => router.push("/listing/new")}
            />
          )}
        </View>
      }
      ListFooterComponent={
        discover.isFetchingNextPage ? (
          <ActivityIndicator color={theme.tint} style={styles.footerSpinner} />
        ) : listings.length > 0 && !discover.hasNextPage ? (
          <Text style={styles.end}>That's everything for now.</Text>
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
    paddingBottom: spacing.xl,
  },
  // Rows carry their own gutter (not the list) so the hero runs edge to edge.
  column: {
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
  },
  filters: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.size.md,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  demand: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
    marginTop: -spacing.sm,
  },
  demandTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  demandRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  separator: {
    height: spacing.md,
  },
  footerSpinner: {
    marginVertical: spacing.lg,
  },
  end: {
    textAlign: "center",
    color: colors.textMuted,
    fontSize: typography.size.sm,
    marginVertical: spacing.lg,
  },
});

// A crash here shows a retry prompt in place of this screen only.
export { RouteErrorBoundary as ErrorBoundary } from "../../../components/RouteErrorBoundary";
