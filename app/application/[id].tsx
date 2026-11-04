import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { Screen } from "../../components/Screen";
import { Text } from "../../components/Text";
import { AttachmentGallery } from "../../features/applications/components/AttachmentGallery";
import { ApplicationQuestions } from "../../features/applications/components/ApplicationQuestions";
import { CollaborationPanel } from "../../features/applications/components/CollaborationPanel";
import { ProgressRail } from "../../features/applications/components/ProgressRail";
import { useApplication, useWithdrawApplication } from "../../features/applications/hooks";
import { applicationStatusMeta } from "../../features/applications/labels";
import { opportunityLabels, timeAgo } from "../../features/listings/labels";
import { confirm } from "../../lib/confirm";
import { errorMessage } from "../../lib/functions";
import { colors, spacing, typography } from "../../lib/theme";

export default function ApplicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const application = useApplication(id);
  const withdraw = useWithdrawApplication();
  const [error, setError] = useState<string | null>(null);

  if (application.isPending) return <LoadingState />;
  if (application.isError) return <ErrorState onRetry={() => application.refetch()} />;
  if (!application.data) {
    return <EmptyState icon="document-outline" title="Application not found" />;
  }

  const app = application.data;
  const status = applicationStatusMeta[app.status];

  const onWithdraw = async () => {
    const ok = await confirm({
      title: "Withdraw your application?",
      message: "The owner will no longer see it. You can apply again later.",
      confirmLabel: "Withdraw",
      destructive: true,
    });
    if (!ok) return;
    setError(null);
    withdraw.mutate(app.id, { onError: (err) => setError(errorMessage(err)) });
  };

  return (
    <Screen onRefresh={() => application.refetch()} refreshing={application.isRefetching}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          {opportunityLabels[app.application_type]} · applied {timeAgo(app.created_at)}
        </Text>
        <Text style={styles.title}>{app.project?.title ?? "Listing removed"}</Text>
        {app.project ? (
          <Button
            label="View listing"
            variant="ghost"
            size="sm"
            icon="open-outline"
            onPress={() => router.push(`/listing/${app.project_id}`)}
            style={styles.viewListing}
          />
        ) : null}
      </View>

      <Card style={styles.card}>
        <ProgressRail application={app} />
      </Card>

      {app.status === "accepted" ? (
        <Card style={styles.card}>
          <CollaborationPanel application={app} viewerIsOwner={false} />
        </Card>
      ) : (
        <Card style={styles.card}>
          <Badge label={status.label} tone={status.tone} />
          {app.status === "submitted" ? (
            <Text style={styles.body}>
              The owner has your note and profile. You'll see their reply here, and get their
              contact details if they accept.
            </Text>
          ) : null}
          {app.decision_note ? <Text style={styles.body}>{app.decision_note}</Text> : null}
        </Card>
      )}

      {app.questions.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Questions from the owner</Text>
          <ApplicationQuestions application={app} viewerIsOwner={false} />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your note</Text>
        <Text style={styles.body}>{app.cover_note}</Text>
        {app.attachments.length > 0 ? <AttachmentGallery attachments={app.attachments} /> : null}
      </View>

      {app.status === "submitted" ? (
        <Button
          label="Withdraw application"
          variant="danger"
          onPress={onWithdraw}
          loading={withdraw.isPending}
        />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  eyebrow: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  title: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.xl,
    color: colors.textPrimary,
  },
  viewListing: {
    alignSelf: "flex-start",
    paddingHorizontal: 0,
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
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
  error: {
    fontSize: typography.size.sm,
    color: colors.danger,
    textAlign: "center",
  },
});
