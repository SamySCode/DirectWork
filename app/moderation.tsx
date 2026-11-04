import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { TextField } from "../components/TextField";
import { useIsAdmin } from "../features/admin/hooks";
import { timeAgo } from "../features/listings/labels";
import { reportReasons, type OpenReport } from "../features/safety/api";
import { useOpenReports, useResolveReport } from "../features/safety/hooks";
import { errorMessage } from "../lib/functions";
import { colors, spacing, typography } from "../lib/theme";

// Reports from users, oldest first. Hidden from non-admins, but the real gate
// is private.resolve_report (and RLS on reports) - this page grants nothing.
export default function ModerationScreen() {
  const isAdmin = useIsAdmin();
  const reports = useOpenReports(!!isAdmin.data);

  if (isAdmin.isPending) return <LoadingState />;
  if (!isAdmin.data) return <EmptyState icon="lock-closed-outline" title="Reviewers only" />;
  if (reports.isPending) return <LoadingState />;
  if (reports.isError) return <ErrorState onRetry={() => reports.refetch()} />;
  if (reports.data.length === 0) {
    return (
      <EmptyState
        icon="shield-checkmark-outline"
        title="No open reports"
        description="Reports from people show up here, oldest first."
      />
    );
  }

  return (
    <Screen onRefresh={() => reports.refetch()} refreshing={reports.isRefetching}>
      <Text style={styles.count}>{reports.data.length} open · oldest first</Text>
      {reports.data.map((report) => (
        <ReportItem key={report.id} report={report} />
      ))}
    </Screen>
  );
}

function ReportItem({ report }: { report: OpenReport }) {
  const router = useRouter();
  const resolve = useResolveReport();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isListing = !!report.project;
  const targetLabel = report.project?.title ?? report.profile?.full_name ?? "Deleted";

  const decide = (takeAction: boolean) => {
    if (takeAction && isListing && !note.trim()) {
      setError("Tell the owner what to change.");
      return;
    }
    setError(null);
    resolve.mutate(
      { reportId: report.id, takeAction, note: note.trim() || undefined },
      { onError: (err) => setError(errorMessage(err)) },
    );
  };

  return (
    <Card style={styles.item}>
      <View style={styles.row}>
        <Badge label={reportReasons[report.reason]} tone="warning" />
        <Text style={styles.meta}>{timeAgo(report.created_at)}</Text>
      </View>
      <Text style={styles.kind}>{isListing ? "Listing" : "Profile"}</Text>
      <Text style={styles.target}>{targetLabel}</Text>
      {report.details ? <Text style={styles.details}>{report.details}</Text> : null}
      <Button
        label={isListing ? "Open listing" : "Open profile"}
        variant="ghost"
        size="sm"
        icon="open-outline"
        onPress={() =>
          router.push(
            isListing ? `/listing/${report.project!.id}` : `/people/${report.profile!.id}`,
          )
        }
        style={styles.open}
      />
      {isListing ? (
        <TextField
          label="Note to the owner (needed to take it down)"
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={1000}
        />
      ) : (
        <Text style={styles.meta}>
          Actioning a profile records the decision. Suspend the account from the Supabase dashboard
          if needed.
        </Text>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.buttons}>
        <Button
          label="Dismiss"
          variant="secondary"
          size="sm"
          onPress={() => decide(false)}
          disabled={resolve.isPending}
          style={styles.flex}
        />
        <Button
          label={isListing ? "Take down for changes" : "Mark actioned"}
          variant="danger"
          size="sm"
          onPress={() => decide(true)}
          loading={resolve.isPending}
          style={styles.flex}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  count: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  item: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kind: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  target: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  details: {
    fontSize: typography.size.md,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  meta: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  open: {
    alignSelf: "flex-start",
    paddingHorizontal: 0,
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
