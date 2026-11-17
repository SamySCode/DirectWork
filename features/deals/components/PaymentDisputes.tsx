import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Badge } from "../../../components/Badge";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Text } from "../../../components/Text";
import { TextField } from "../../../components/TextField";
import { errorMessage } from "../../../lib/functions";
import { colors, spacing, typography } from "../../../lib/theme";
import { timeAgo } from "../../listings/labels";
import type { DisputeCase, Milestone, PaymentReport } from "../api";
import { useDisputeCase, useOpenDisputes, useResolvePaymentDispute } from "../hooks";
import { paymentOutcomeLabels } from "../labels";
import { shortDate } from "../logic";

/** Moderators: owners' disputes of payment reports, oldest first. */
export function PaymentDisputes({ enabled }: { enabled: boolean }) {
  const disputes = useOpenDisputes(enabled);
  if (disputes.isPending) return null;
  if (disputes.data === undefined) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment disputes</Text>
        <Text style={styles.meta}>Couldn't load payment disputes.</Text>
        <Button
          label="Try again"
          variant="secondary"
          size="sm"
          onPress={() => disputes.refetch()}
          style={styles.start}
        />
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Payment disputes · {disputes.data.length} open</Text>
      {disputes.data.length === 0 ? (
        <Text style={styles.meta}>No payment reports are disputed.</Text>
      ) : (
        disputes.data.map((report) => <DisputeItem key={report.id} report={report} />)
      )}
    </View>
  );
}

/** get_deal_for_dispute may return the sheet flat or nested; read either. */
function field<T>(data: DisputeCase | null | undefined, key: string): T | undefined {
  if (!data) return undefined;
  const nested = (data.deal ?? data.deal_sheet) as Record<string, unknown> | undefined;
  return (data[key] ?? nested?.[key]) as T | undefined;
}

function DisputeItem({ report }: { report: PaymentReport }) {
  const [open, setOpen] = useState(false);
  const details = useDisputeCase(report.id, open);
  const resolve = useResolvePaymentDispute();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const milestones = field<Milestone[]>(details.data, "milestones") ?? [];
  const milestone = report.milestone_index !== null ? milestones[report.milestone_index] : null;
  const scope = field<string>(details.data, "scope");
  const title = field<string>(details.data, "project_title");
  const agreedAt = field<string>(details.data, "agreed_at");

  const decide = (uphold: boolean) => {
    setError(null);
    resolve.mutate(
      { reportId: report.id, uphold, note: note.trim() || undefined },
      { onError: (err) => setError(errorMessage(err)) },
    );
  };

  return (
    <Card style={styles.item}>
      <View style={styles.row}>
        <Badge label={paymentOutcomeLabels[report.outcome]} tone="warning" />
        <Text style={styles.meta}>
          disputed {report.disputed_at ? timeAgo(report.disputed_at) : ""}
        </Text>
      </View>
      <Text style={styles.label}>
        {report.milestone_index === null ? "Whole deal" : `Milestone ${report.milestone_index + 1}`}
        {report.paid_on ? ` · paid on ${shortDate(report.paid_on)}` : ""} · reported{" "}
        {shortDate(report.created_at)}
      </Text>
      {report.dispute_reason ? (
        <Text style={styles.body}>Owner says: {report.dispute_reason}</Text>
      ) : null}

      {!open ? (
        <Button
          label="Open the Deal Sheet"
          variant="ghost"
          size="sm"
          icon="document-text-outline"
          onPress={() => setOpen(true)}
          style={styles.start}
        />
      ) : details.isPending ? (
        <Text style={styles.meta}>Loading…</Text>
      ) : details.data ? (
        <View style={styles.details}>
          {title ? <Text style={styles.label}>{title}</Text> : null}
          {agreedAt ? <Text style={styles.meta}>Agreed {shortDate(agreedAt)}</Text> : null}
          {milestone ? (
            <Text style={styles.body}>
              {milestone.title} · due {shortDate(milestone.due_date)}
            </Text>
          ) : null}
          {scope ? <Text style={styles.body}>{scope}</Text> : null}
        </View>
      ) : (
        <Text style={styles.meta}>Couldn't load the Deal Sheet.</Text>
      )}

      <TextField
        label="Note to both sides (optional)"
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={500}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.buttons}>
        <Button
          label="Reject dispute"
          variant="secondary"
          size="sm"
          onPress={() => decide(false)}
          disabled={resolve.isPending}
          style={styles.flex}
        />
        <Button
          label="Uphold - remove report"
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
  item: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  details: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  body: {
    fontSize: typography.size.md,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  meta: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  start: {
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
