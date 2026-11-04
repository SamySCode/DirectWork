import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Badge } from "../../../components/Badge";
import { PressableCard } from "../../../components/Card";
import { NodeMeter } from "../../../components/NodeMeter";
import { Text } from "../../../components/Text";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import type { ListingDetail } from "../api";
import {
  commitmentLabels,
  formatCompensation,
  listingStatusMeta,
  opportunityLabels,
  remotePrefLabels,
  timeAgo,
} from "../labels";

type ListingCardProps = {
  listing: ListingDetail;
  onPress: () => void;
  /** Lowercased skill names of the viewer - matching ones are highlighted. */
  mySkills?: Set<string>;
  /** Owner's view shows lifecycle status instead of the owner's name. */
  showStatus?: boolean;
};

function ListingCardBase({ listing, onPress, mySkills, showStatus = false }: ListingCardProps) {
  const pay = formatCompensation(listing);
  const matches = mySkills ? listing.skills.filter((s) => mySkills.has(s.toLowerCase())) : [];
  const meta = [
    listing.remote_pref ? remotePrefLabels[listing.remote_pref] : null,
    listing.location,
    listing.commitment ? commitmentLabels[listing.commitment] : null,
  ].filter(Boolean);
  const status = listingStatusMeta[listing.status];

  return (
    <PressableCard onPress={onPress} accessibilityLabel={listing.title} style={styles.card}>
      {listing.images[0] ? (
        <Image
          source={{ uri: listing.images[0].url }}
          style={styles.cover}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={styles.topRow}>
        <View style={styles.badges}>
          <Badge
            label={opportunityLabels[listing.opportunity_type]}
            tone={listing.opportunity_type === "partner" ? "ink" : "accent"}
          />
          {listing.is_featured && !showStatus ? <Badge label="Featured" tone="warning" /> : null}
          {showStatus ? <Badge label={status.label} tone={status.tone} /> : null}
        </View>
        {listing.published_at && !showStatus ? (
          <Text style={styles.time}>{timeAgo(listing.published_at)}</Text>
        ) : null}
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title} numberOfLines={2}>
          {listing.title}
        </Text>
        {!showStatus && listing.owner ? (
          <Text style={styles.owner} numberOfLines={1}>
            {listing.owner.full_name} · {listing.owner.headline}
          </Text>
        ) : null}
      </View>

      <Text style={styles.summary} numberOfLines={3}>
        {listing.public_summary}
      </Text>

      {pay || meta.length > 0 ? (
        <View style={styles.metaRow}>
          {pay ? <Text style={styles.pay}>{pay}</Text> : null}
          {meta.length > 0 ? <Text style={styles.meta}>{meta.join(" · ")}</Text> : null}
        </View>
      ) : null}

      {listing.skills.length > 0 ? (
        <View style={styles.skills}>
          {listing.skills.slice(0, 6).map((skill) => {
            const match = mySkills?.has(skill.toLowerCase());
            return (
              <View key={skill} style={[styles.skill, match ? styles.skillMatch : null]}>
                {match ? <Ionicons name="checkmark" size={12} color={colors.mintInk} /> : null}
                <Text style={[styles.skillText, match ? styles.skillTextMatch : null]}>
                  {skill}
                </Text>
              </View>
            );
          })}
          {listing.skills.length > 6 ? (
            <Text style={styles.more}>+{listing.skills.length - 6}</Text>
          ) : null}
        </View>
      ) : null}

      {matches.length > 0 ? (
        <View style={styles.matchRow}>
          <NodeMeter
            total={listing.skills.length}
            lit={matches.length}
            size={8}
            max={8}
            accessibilityLabel={`Matches ${matches.length} of your skills`}
          />
          <Text style={styles.matchLine}>Matches {matches.length} of your skills</Text>
        </View>
      ) : null}
    </PressableCard>
  );
}

// Memoised: Discover renders these in a virtualised list, and they only
// change when the listing or the viewer's skills do.
export const ListingCard = memo(ListingCardBase);

const styles = StyleSheet.create({
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    overflow: "hidden",
  },
  // Bleeds to the card edges (negative margins cancel the card padding).
  cover: {
    height: 140,
    marginTop: -spacing.lg,
    marginHorizontal: -spacing.lg,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceSunken,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badges: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  time: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  titleBlock: {
    gap: 2,
  },
  title: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.lg,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  owner: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  summary: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: spacing.md,
    rowGap: spacing.xs,
  },
  pay: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  meta: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  skills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    alignItems: "center",
  },
  skill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
  },
  skillMatch: {
    backgroundColor: colors.mintMuted,
  },
  skillText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  },
  skillTextMatch: {
    color: colors.mintInk,
  },
  more: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  matchLine: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mintInk,
  },
});
