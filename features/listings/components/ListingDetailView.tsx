import type { ReactNode } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "../../../components/Avatar";
import { Badge } from "../../../components/Badge";
import { Card } from "../../../components/Card";
import { Gallery } from "../../../components/Gallery";
import { Text } from "../../../components/Text";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import { avatarUrl } from "../../profile/api";
import { ReplyRecord } from "../../profile/components/ReplyRecord";
import { useReplyRecord } from "../../profile/hooks";
import type { ListingDetail } from "../api";
import {
  commitmentLabels,
  formatCompensation,
  opportunityLabels,
  remotePrefLabels,
} from "../labels";

type ListingDetailViewProps = {
  listing: ListingDetail;
  mySkills?: Set<string>;
  /** Rendered right after the title/owner block - e.g. the viewer's fit. */
  afterHeader?: ReactNode;
};

export function ListingDetailView({ listing, mySkills, afterHeader }: ListingDetailViewProps) {
  const router = useRouter();
  const replyRecord = useReplyRecord(listing.owner?.id);
  const pay = formatCompensation(listing);
  const facts = [
    pay ? { icon: "cash-outline" as const, label: pay } : null,
    listing.remote_pref
      ? { icon: "globe-outline" as const, label: remotePrefLabels[listing.remote_pref] }
      : null,
    listing.location ? { icon: "location-outline" as const, label: listing.location } : null,
    listing.commitment
      ? { icon: "time-outline" as const, label: commitmentLabels[listing.commitment] }
      : null,
    listing.duration ? { icon: "calendar-outline" as const, label: listing.duration } : null,
  ].filter((fact) => fact !== null);
  const admission = listing.admission;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.badges}>
          <Badge
            label={opportunityLabels[listing.opportunity_type]}
            tone={listing.opportunity_type === "partner" ? "ink" : "accent"}
          />
          {listing.is_featured ? <Badge label="Featured" tone="warning" /> : null}
        </View>
        <Text style={styles.title}>{listing.title}</Text>
        {listing.owner ? (
          <Pressable
            onPress={() => router.push(`/people/${listing.owner!.id}`)}
            accessibilityRole="link"
            style={styles.owner}
          >
            <Avatar
              name={listing.owner.full_name}
              uri={avatarUrl(listing.owner.avatar_url)}
              size={36}
            />
            <View style={styles.ownerText}>
              <Text style={styles.ownerName}>{listing.owner.full_name}</Text>
              <Text style={styles.ownerHeadline} numberOfLines={1}>
                {listing.owner.headline}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
        {replyRecord.data ? <ReplyRecord record={replyRecord.data} /> : null}
      </View>

      {afterHeader}

      {facts.length > 0 ? (
        <View style={styles.facts}>
          {facts.map((fact) => (
            <View key={fact.label} style={styles.fact}>
              <Ionicons name={fact.icon} size={16} color={colors.accent} />
              <Text style={styles.factText}>{fact.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {listing.images.length > 0 ? (
        <Gallery
          images={listing.images.map((image) => ({ key: image.id, uri: image.url }))}
          height={170}
        />
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About the work</Text>
        <Text style={styles.body}>{listing.public_summary}</Text>
      </View>

      {admission ? (
        <Card style={styles.admission}>
          <View style={styles.admissionHeader}>
            <Ionicons name="shield-checkmark" size={18} color={colors.accent} />
            <Text style={styles.admissionTitle}>Reviewed admission criteria</Text>
          </View>
          {(
            [
              ["What exists today", admission.what_exists_already],
              ["Time needed", `${admission.weekly_commitment_hours} hours a week`],
              ["First milestone", admission.first_milestone],
              ["Proposed terms", admission.proposed_terms],
              ["What the owner puts in", admission.owner_contribution],
            ] as const
          ).map(([label, value]) => (
            <View key={label} style={styles.criterion}>
              <Text style={styles.criterionLabel}>{label}</Text>
              <Text style={styles.criterionValue}>{value}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {listing.skills.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills needed</Text>
          <View style={styles.skills}>
            {listing.skills.map((skill) => {
              const match = mySkills?.has(skill.toLowerCase());
              return (
                <View key={skill} style={[styles.skill, match ? styles.skillMatch : null]}>
                  {match ? <Ionicons name="checkmark" size={14} color={colors.mintInk} /> : null}
                  <Text style={[styles.skillText, match ? styles.skillTextMatch : null]}>
                    {skill}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  header: {
    gap: spacing.md,
  },
  badges: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  title: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.xxl,
    lineHeight: 38,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  owner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  ownerText: {
    flex: 1,
  },
  ownerName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  ownerHeadline: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  facts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  factText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textPrimary,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  body: {
    fontSize: typography.size.md,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  admission: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  admissionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  admissionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  criterion: {
    gap: 2,
  },
  criterionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.accent,
  },
  criterionValue: {
    fontSize: typography.size.md,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  skills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  skill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
  },
  skillMatch: {
    backgroundColor: colors.mintMuted,
  },
  skillText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
  },
  skillTextMatch: {
    color: colors.mintInk,
  },
});
