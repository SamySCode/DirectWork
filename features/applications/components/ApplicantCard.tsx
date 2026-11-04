import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "../../../components/Avatar";
import { Badge } from "../../../components/Badge";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Text } from "../../../components/Text";
import { confirm } from "../../../lib/confirm";
import { errorMessage } from "../../../lib/functions";
import { colors, spacing, typography } from "../../../lib/theme";
import { timeAgo } from "../../listings/labels";
import { avatarUrl } from "../../profile/api";
import type { Application } from "../api";
import { useDecideApplication } from "../hooks";
import { applicationStatusMeta } from "../labels";
import { ApplicationQuestions } from "./ApplicationQuestions";
import { AttachmentGallery } from "./AttachmentGallery";
import { CollaborationPanel } from "./CollaborationPanel";

export function ApplicantCard({ application }: { application: Application }) {
  const router = useRouter();
  const decide = useDecideApplication();
  const [error, setError] = useState<string | null>(null);
  const applicant = application.applicant;
  const name = applicant?.full_name ?? "Deleted account";
  const status = applicationStatusMeta[application.status];

  const onDecide = async (accept: boolean) => {
    const ok = await confirm({
      title: accept ? `Accept ${name}?` : `Decline ${name}?`,
      message: accept
        ? "You'll both see each other's email address so you can take it from here."
        : "They'll see that it wasn't a fit this time. This can't be undone.",
      confirmLabel: accept ? "Accept" : "Decline",
      destructive: !accept,
    });
    if (!ok) return;
    setError(null);
    decide.mutate(
      { applicationId: application.id, accept },
      { onError: (err) => setError(errorMessage(err)) },
    );
  };

  return (
    <Card style={styles.card}>
      <Pressable
        onPress={() => applicant && router.push(`/people/${applicant.id}`)}
        accessibilityRole="link"
        style={styles.header}
      >
        <Avatar name={name} uri={avatarUrl(applicant?.avatar_url)} size={40} />
        <View style={styles.headerText}>
          <Text style={styles.name}>{name}</Text>
          {applicant?.headline ? (
            <Text style={styles.headline} numberOfLines={1}>
              {applicant.headline}
            </Text>
          ) : null}
        </View>
        <Text style={styles.time}>{timeAgo(application.created_at)}</Text>
      </Pressable>

      <Text style={styles.note}>{application.cover_note}</Text>
      {application.attachments.length > 0 ? (
        <AttachmentGallery attachments={application.attachments} />
      ) : null}
      <ApplicationQuestions application={application} viewerIsOwner />

      {application.status === "submitted" ? (
        <View style={styles.buttons}>
          <Button
            label="Decline"
            variant="secondary"
            size="sm"
            onPress={() => onDecide(false)}
            disabled={decide.isPending}
            style={styles.flex}
          />
          <Button
            label="Accept"
            icon="checkmark"
            size="sm"
            onPress={() => onDecide(true)}
            loading={decide.isPending}
            style={styles.flex}
          />
        </View>
      ) : application.status === "accepted" ? (
        <CollaborationPanel application={application} viewerIsOwner />
      ) : (
        <Badge label={status.label} tone={status.tone} />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerText: {
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
  time: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  note: {
    fontSize: typography.size.md,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  buttons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  error: {
    fontSize: typography.size.sm,
    color: colors.danger,
  },
});
