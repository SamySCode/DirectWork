import Ionicons from "@expo/vector-icons/Ionicons";
import { Href, useRouter } from "expo-router";
import { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "../../../components/Avatar";
import { Badge } from "../../../components/Badge";
import { Card } from "../../../components/Card";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { PageHero } from "../../../components/PageHero";
import { Screen } from "../../../components/Screen";
import { Text } from "../../../components/Text";
import { useIsAdmin } from "../../../features/admin/hooks";
import { signOut } from "../../../features/auth/api";
import { useAuth } from "../../../features/auth/SessionProvider";
import { ProfileStrengthCard } from "../../../features/profile/components/ProfileStrengthCard";
import { ProfileView } from "../../../features/profile/components/ProfileView";
import { profileStrength } from "../../../features/profile/strength";
import { avatarUrl } from "../../../features/profile/api";
import {
  useMyProfile,
  usePortfolio,
  useReferences,
  useTrackRecord,
} from "../../../features/profile/hooks";
import { billingAvailable } from "../../../features/billing/availability";
import { colors, spacing, tabThemes, typography } from "../../../lib/theme";

type Row = {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  tone?: "danger";
};

export default function ProfileScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { profile, skills, loading, error, refetch, userId } = useMyProfile();
  const trackRecord = useTrackRecord(userId);
  const portfolio = usePortfolio(userId);
  const references = useReferences(userId);
  const isAdmin = useIsAdmin();

  if (loading) return <LoadingState />;
  if (error || !profile) return <ErrorState title="Couldn't load your profile" onRetry={refetch} />;

  const go = (href: Href) => () => router.push(href);

  const rows: Row[] = [
    { icon: "create-outline", label: "Edit profile", onPress: go("/account/edit") },
    { icon: "eye-outline", label: "See your public profile", onPress: go(`/people/${profile.id}`) },
    { icon: "notifications-outline", label: "Activity", onPress: go("/inbox") },
    { icon: "bulb-outline", label: "Guide & tips", onPress: go("/guide") },
    ...(billingAvailable
      ? [{ icon: "card-outline" as const, label: "Plans & billing", onPress: go("/billing") }]
      : []),
    ...(isAdmin.data
      ? [
          {
            icon: "shield-checkmark-outline" as const,
            label: "Review queue",
            onPress: go("/review"),
          },
          {
            icon: "flag-outline" as const,
            label: "Reports",
            onPress: go("/moderation"),
          },
        ]
      : []),
    { icon: "eye-off-outline", label: "Blocked people", onPress: go("/account/blocked") },
    { icon: "log-out-outline", label: "Sign out", onPress: () => signOut() },
    {
      icon: "trash-outline",
      label: "Delete account",
      onPress: go("/account/delete"),
      tone: "danger",
    },
  ];

  return (
    <Screen
      onRefresh={refetch}
      header={
        <PageHero
          theme={tabThemes.profile}
          title={profile.full_name}
          subtitle={profile.headline}
          top={<Avatar name={profile.full_name} uri={avatarUrl(profile.avatar_url)} size={72} />}
        >
          <View style={styles.heroBadges}>
            {profile.seeking_paid ? <Badge label="Open to paid work" tone="neutral" /> : null}
            {profile.seeking_partner ? <Badge label="Open to partnerships" tone="neutral" /> : null}
            {profile.wants_to_hire ? <Badge label="Hiring" tone="neutral" /> : null}
          </View>
        </PageHero>
      }
    >
      <ProfileStrengthCard
        items={profileStrength(profile, skills.length, portfolio.data?.length ?? 0)}
        tint={tabThemes.profile.tint}
        onFix={() => router.push("/account/edit")}
      />
      <ProfileView
        profile={profile}
        skills={skills}
        trackRecord={trackRecord.data}
        portfolio={portfolio.data}
        references={references.data}
        showHeader={false}
      />

      <Card style={styles.menu}>
        {rows.map((row, index) => (
          <Pressable
            key={row.label}
            onPress={row.onPress}
            accessibilityRole="button"
            style={[styles.row, index > 0 ? styles.rowDivider : null]}
          >
            <Ionicons
              name={row.icon}
              size={20}
              color={row.tone === "danger" ? colors.danger : colors.textSecondary}
            />
            <Text style={[styles.rowLabel, row.tone === "danger" ? styles.danger : null]}>
              {row.label}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ))}
      </Card>
      {session?.user.email ? (
        <Text style={styles.email}>Signed in as {session.user.email}</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  menu: {
    padding: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowLabel: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  danger: {
    color: colors.danger,
  },
  error: {
    color: colors.danger,
    fontSize: typography.size.sm,
    textAlign: "center",
  },
  email: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    textAlign: "center",
  },
});
