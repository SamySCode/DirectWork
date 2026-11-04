import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Chip } from "../../../components/Chip";
import { Text } from "../../../components/Text";
import { TextField } from "../../../components/TextField";
import { confirm } from "../../../lib/confirm";
import { errorMessage } from "../../../lib/functions";
import { colors, spacing, typography } from "../../../lib/theme";
import { reportReasons, type ReportReason, type ReportTarget } from "../api";
import { useBlock, useBlockedIds, useReport, useUnblock } from "../hooks";

type SafetyActionsProps = {
  target: ReportTarget;
  /** The person to block: the profile itself, or the listing's owner. */
  person: { id: string; name: string };
};

/** Quiet report/block controls for the bottom of a profile or listing. */
export function SafetyActions({ target, person }: SafetyActionsProps) {
  const blockedIds = useBlockedIds();
  const blockMutation = useBlock();
  const unblockMutation = useUnblock();
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = !!blockedIds.data?.includes(person.id);
  const firstName = person.name.split(" ")[0];

  const onBlock = async () => {
    if (blocked) {
      setError(null);
      unblockMutation.mutate(person.id, { onError: (err) => setError(errorMessage(err)) });
      return;
    }
    const ok = await confirm({
      title: `Block ${firstName}?`,
      message:
        "You won't see their listings, and neither of you can apply to the other's. They aren't told.",
      confirmLabel: "Block",
      destructive: true,
    });
    if (!ok) return;
    setError(null);
    blockMutation.mutate(person.id, { onError: (err) => setError(errorMessage(err)) });
  };

  return (
    <View style={styles.wrap}>
      {reporting ? (
        <ReportForm
          target={target}
          onDone={() => {
            setReporting(false);
            setReported(true);
          }}
          onCancel={() => setReporting(false)}
        />
      ) : reported ? (
        <View style={styles.thanks}>
          <Ionicons name="checkmark-circle" size={18} color={colors.mintInk} />
          <Text style={styles.thanksText}>
            Thanks - a reviewer will look at it. Reports are private.
          </Text>
        </View>
      ) : null}
      <View style={styles.row}>
        {!reporting && !reported ? (
          <Button
            label={target.kind === "listing" ? "Report listing" : "Report"}
            icon="flag-outline"
            variant="ghost"
            size="sm"
            onPress={() => setReporting(true)}
          />
        ) : null}
        <Button
          label={blocked ? `Unblock ${firstName}` : `Block ${firstName}`}
          icon={blocked ? "eye-outline" : "eye-off-outline"}
          variant="ghost"
          size="sm"
          onPress={onBlock}
          loading={blockMutation.isPending || unblockMutation.isPending}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function ReportForm({
  target,
  onDone,
  onCancel,
}: {
  target: ReportTarget;
  onDone: () => void;
  onCancel: () => void;
}) {
  const submitReport = useReport();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!reason) {
      setError("Pick a reason");
      return;
    }
    setError(null);
    submitReport.mutate(
      { target, reason, details },
      { onSuccess: onDone, onError: (err) => setError(errorMessage(err)) },
    );
  };

  return (
    <Card style={styles.form}>
      <Text style={styles.title}>What's wrong?</Text>
      <View style={styles.reasons} accessibilityRole="radiogroup">
        {(Object.keys(reportReasons) as ReportReason[]).map((key) => (
          <Chip
            key={key}
            label={reportReasons[key]}
            selected={reason === key}
            onPress={() => setReason(key)}
          />
        ))}
      </View>
      <TextField
        label="Details (optional)"
        hint="Only reviewers see this. Who you are isn't shared with them."
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={500}
        showCount
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.row}>
        <Button
          label="Cancel"
          variant="secondary"
          size="sm"
          onPress={onCancel}
          style={styles.flex}
        />
        <Button
          label="Send report"
          variant="danger"
          size="sm"
          onPress={submit}
          loading={submitReport.isPending}
          style={styles.flex}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  form: {
    gap: spacing.md,
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  reasons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  thanks: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  thanksText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.mintInk,
  },
  flex: {
    flex: 1,
  },
  error: {
    fontSize: typography.size.sm,
    color: colors.danger,
  },
});
