import Ionicons from "@expo/vector-icons/Ionicons";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "../../../components/Avatar";
import { Badge } from "../../../components/Badge";
import { Card } from "../../../components/Card";
import { Gallery } from "../../../components/Gallery";
import { Text } from "../../../components/Text";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import { remotePrefLabels } from "../labels";
import {
  avatarUrl,
  type PortfolioImage,
  type Profile,
  type TrackRecord,
  type WorkReference,
} from "../api";
import { availabilityFreshness, freshnessLabel } from "../freshness";
import { OutcomeChain } from "./OutcomeChain";
import { ReferencesList } from "./ReferencesList";

type ProfileViewProps = {
  profile: Profile;
  skills: string[];
  trackRecord?: TrackRecord;
  portfolio?: PortfolioImage[];
  references?: WorkReference[];
  /** False when the screen already shows name/photo in its own header. */
  showHeader?: boolean;
};

export function ProfileView({
  profile,
  skills,
  trackRecord,
  portfolio = [],
  references = [],
  showHeader = true,
}: ProfileViewProps) {
  const freshness = availabilityFreshness(profile);
  const fresh = freshnessLabel(freshness);
  const details = [
    profile.current_title,
    profile.location,
    profile.remote_pref ? remotePrefLabels[profile.remote_pref] : null,
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      {showHeader ? (
        <Card style={styles.header}>
          <Avatar name={profile.full_name} uri={avatarUrl(profile.avatar_url)} size={72} />
          <View style={styles.headerText}>
            <Text style={styles.name}>{profile.full_name}</Text>
            <Text style={styles.headline}>{profile.headline}</Text>
            {details.length > 0 ? <Text style={styles.details}>{details.join(" · ")}</Text> : null}
          </View>
          <View style={styles.badges}>
            {profile.seeking_paid ? <Badge label="Open to paid work" tone="accent" /> : null}
            {profile.seeking_partner ? <Badge label="Open to partnerships" tone="ink" /> : null}
            {profile.wants_to_hire ? <Badge label="Hiring" tone="warning" /> : null}
          </View>
          {fresh ? (
            <Text style={[styles.fresh, freshness.stale && styles.stale]}>{fresh}</Text>
          ) : null}
        </Card>
      ) : null}

      {trackRecord ? <OutcomeChain record={trackRecord} /> : null}

      {references.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>References</Text>
          <ReferencesList references={references} />
        </View>
      ) : null}

      {profile.bio ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.body}>{profile.bio}</Text>
        </View>
      ) : null}

      {portfolio.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Work</Text>
          <Gallery
            images={portfolio.map((image) => ({
              key: image.id,
              uri: image.url,
              caption: image.caption,
            }))}
          />
        </View>
      ) : null}

      {skills.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills</Text>
          <View style={styles.skills}>
            {skills.map((skill) => (
              <View key={skill} style={styles.skill}>
                <Text style={styles.skillText}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {profile.availability || profile.experience_level ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability & experience</Text>
          {profile.availability ? <Text style={styles.body}>{profile.availability}</Text> : null}
          {profile.experience_level ? (
            <Text style={styles.body}>{profile.experience_level}</Text>
          ) : null}
        </View>
      ) : null}

      {profile.portfolio_url ? (
        <Pressable
          onPress={() => Linking.openURL(profile.portfolio_url!)}
          accessibilityRole="link"
          style={styles.link}
        >
          <Ionicons name="open-outline" size={16} color={colors.accent} />
          <Text style={styles.linkText} numberOfLines={1}>
            {profile.portfolio_url.replace(/^https?:\/\//, "")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  header: {
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  headerText: {
    alignItems: "center",
    gap: spacing.xs,
  },
  name: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.xl,
    color: colors.textPrimary,
    textAlign: "center",
  },
  headline: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    textAlign: "center",
  },
  details: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    textAlign: "center",
  },
  fresh: {
    fontSize: typography.size.xs,
    color: colors.mintInk,
  },
  stale: {
    color: colors.textMuted,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.xs,
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
    lineHeight: 23,
    color: colors.textPrimary,
  },
  skills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  skill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.accentMuted,
  },
  skillText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.accent,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  linkText: {
    fontSize: typography.size.md,
    color: colors.accent,
    fontWeight: typography.weight.medium,
  },
});
