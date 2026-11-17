import { useState } from "react";
import { Platform, Share, StyleSheet, View } from "react-native";
import { Badge } from "../../../components/Badge";
import { Button } from "../../../components/Button";
import { Text } from "../../../components/Text";
import { TextField } from "../../../components/TextField";
import { confirm } from "../../../lib/confirm";
import { errorMessage } from "../../../lib/functions";
import {
  calculateLatePayment,
  GOV_UK_LATE_PAYMENT,
  lateLetter,
  NOT_LEGAL_ADVICE,
} from "../../../lib/latePayment";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import type { DealSheet, PaymentOutcome, PaymentReport } from "../api";
import { useDisputePayment, useReportPayment } from "../hooks";
import { paymentOutcomeLabels } from "../labels";
import {
  canCorrect,
  canDispute,
  paidOnProblem,
  reportablePayments,
  shortDate,
  type ReportablePayment,
  type Side,
} from "../logic";
import { disputeReasonSchema } from "../schemas";

type PaymentReportsProps = {
  sheet: DealSheet;
  side: Side;
  projectTitle: string;
  ownerName: string;
  memberName: string;
};

const disputeLabels = {
  none: null,
  disputed: { label: "Disputed - not counted while we review it", tone: "warning" as const },
  upheld: { label: "Dispute upheld - removed from the record", tone: "neutral" as const },
  rejected: { label: "Dispute rejected - counts on the record", tone: "neutral" as const },
};

/** After due dates: the professional records payment; the owner can dispute a report. */
export function PaymentReports(props: PaymentReportsProps) {
  const items = reportablePayments(props.sheet);
  if (items.length === 0) {
    return (
      <Text style={styles.muted}>
        {props.side === "member"
          ? "You can record payment for each milestone once its due date has passed."
          : "The professional can record payment for each milestone once its due date has passed."}
      </Text>
    );
  }
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <PaymentItem key={item.index ?? "deal"} item={item} {...props} />
      ))}
    </View>
  );
}

type Item = ReportablePayment;

function PaymentItem({ item, sheet, side, ...names }: PaymentReportsProps & { item: Item }) {
  const report = item.report;
  const [editing, setEditing] = useState(false);
  const dispute = report ? disputeLabels[report.dispute_status] : null;

  return (
    <View style={styles.item}>
      <Text style={styles.itemTitle}>{item.label}</Text>
      {item.dueDate ? <Text style={styles.muted}>Due {shortDate(item.dueDate)}</Text> : null}
      {report ? (
        <View style={styles.row}>
          <Badge
            label={reportLabel(report)}
            tone={report.outcome === "on_time" ? "mint" : "neutral"}
          />
          {dispute ? <Badge label={dispute.label} tone={dispute.tone} /> : null}
        </View>
      ) : null}

      {side === "member" && (!report || editing) ? (
        <RecordPayment
          dealId={sheet.id}
          milestoneIndex={item.index}
          dueDate={item.dueDate}
          onDone={() => setEditing(false)}
        />
      ) : null}
      {side === "member" && report && !editing && canCorrect(report) ? (
        <Button
          label="Correct this report"
          variant="ghost"
          size="sm"
          onPress={() => setEditing(true)}
          style={styles.start}
        />
      ) : null}
      {side === "member" && report?.outcome === "unpaid" ? (
        <LatePaymentLetter sheet={sheet} item={item} {...names} />
      ) : null}

      {side === "owner" && report && canDispute(report) ? <DisputeReport report={report} /> : null}
    </View>
  );
}

const reportLabel = (report: PaymentReport) =>
  report.outcome === "late" && report.paid_on
    ? `Paid late (on ${shortDate(report.paid_on)})`
    : paymentOutcomeLabels[report.outcome];

function RecordPayment({
  dealId,
  milestoneIndex,
  dueDate,
  onDone,
}: {
  dealId: string;
  milestoneIndex: number | null;
  dueDate: string | null;
  onDone: () => void;
}) {
  const report = useReportPayment();
  const [late, setLate] = useState(false);
  const [paidOn, setPaidOn] = useState("");
  const [error, setError] = useState<string | null>(null);

  const send = async (outcome: PaymentOutcome) => {
    const problem = outcome === "unpaid" ? null : paidOnProblem(outcome, paidOn.trim(), dueDate);
    if (problem) {
      setError(problem);
      return;
    }
    const ok = await confirm({
      title: "Record this payment?",
      message:
        "Your report is shown, as part of a count, on the owner's profile and listings. It must be true and accurate - the owner can dispute it within 14 days.",
      confirmLabel: "Record",
    });
    if (!ok) return;
    setError(null);
    report.mutate(
      {
        dealId,
        milestoneIndex,
        outcome,
        paidOn: outcome === "late" ? paidOn.trim() : undefined,
      },
      { onSuccess: onDone, onError: (err) => setError(errorMessage(err)) },
    );
  };

  return (
    <View style={styles.record}>
      <Text style={styles.label}>Record payment</Text>
      {late ? (
        <TextField
          label="Date you were paid (YYYY-MM-DD)"
          value={paidOn}
          onChangeText={setPaidOn}
          autoCapitalize="none"
        />
      ) : null}
      <View style={styles.buttons}>
        {late ? (
          <>
            <Button label="Back" variant="secondary" size="sm" onPress={() => setLate(false)} />
            <Button
              label="Record paid late"
              size="sm"
              onPress={() => send("late")}
              loading={report.isPending}
            />
          </>
        ) : (
          <>
            <Button
              label="Paid on time"
              size="sm"
              onPress={() => send("on_time")}
              disabled={report.isPending}
            />
            <Button label="Paid late" variant="secondary" size="sm" onPress={() => setLate(true)} />
            <Button
              label="Not paid yet"
              variant="secondary"
              size="sm"
              onPress={() => send("unpaid")}
              disabled={report.isPending}
            />
          </>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function DisputeReport({ report }: { report: PaymentReport }) {
  const dispute = useDisputePayment();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button
        label="Dispute"
        variant="ghost"
        size="sm"
        icon="flag-outline"
        onPress={() => setOpen(true)}
        style={styles.start}
      />
    );
  }
  const send = () => {
    const parsed = disputeReasonSchema.safeParse(reason);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the reason.");
      return;
    }
    setError(null);
    dispute.mutate(
      { reportId: report.id, reason: parsed.data },
      { onError: (err) => setError(errorMessage(err)) },
    );
  };
  return (
    <View style={styles.record}>
      <TextField
        label="What's wrong with this report?"
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={500}
        showCount
        hint="A moderator reviews it. While they do, it isn't counted on your record."
        error={error ?? undefined}
      />
      <View style={styles.buttons}>
        <Button label="Cancel" variant="secondary" size="sm" onPress={() => setOpen(false)} />
        <Button label="Send dispute" size="sm" onPress={send} loading={dispute.isPending} />
      </View>
    </View>
  );
}

async function shareText(text: string) {
  if (Platform.OS === "web") {
    await navigator.clipboard?.writeText(text);
    return;
  }
  await Share.share({ message: text });
}

function LatePaymentLetter({
  sheet,
  item,
  projectTitle,
  ownerName,
  memberName,
}: {
  sheet: DealSheet;
  item: Item;
  projectTitle: string;
  ownerName: string;
  memberName: string;
}) {
  const b2b = sheet.owner_business && sheet.member_business;
  const [open, setOpen] = useState(false);
  const [debt, setDebt] = useState(item.amount != null ? String(item.amount) : "");
  const [dueDate, setDueDate] = useState(item.dueDate ?? "");
  const [copied, setCopied] = useState(false);

  if (!b2b) {
    return (
      <Text style={styles.muted}>
        A polite reminder is usually the best first step. Late payment interest under the 1998 Act
        only applies when you both confirmed you're acting in the course of business.
      </Text>
    );
  }
  if (sheet.currency !== "GBP") {
    return (
      <Text style={styles.muted}>
        The late payment letter works in pounds only. See {GOV_UK_LATE_PAYMENT} for how to claim.
      </Text>
    );
  }
  if (!open) {
    return (
      <Button
        label="Late payment letter"
        variant="secondary"
        size="sm"
        icon="mail-outline"
        onPress={() => setOpen(true)}
        style={styles.start}
      />
    );
  }

  const asOf = new Date().toISOString().slice(0, 10);
  const result = calculateLatePayment({
    debt: Number(debt),
    dueDate: dueDate.trim(),
    asOf,
    ownerBusiness: sheet.owner_business,
    memberBusiness: sheet.member_business,
  });
  const letter = result.ok
    ? lateLetter(
        {
          to: ownerName,
          from: memberName,
          projectTitle,
          debt: Number(debt),
          dueDate: dueDate.trim(),
          asOf,
          paymentFor: item.index === null ? "the work" : item.label,
          agreedAt: sheet.agreed_at ?? sheet.updated_at,
        },
        result,
      )
    : null;
  const problem = result.ok
    ? null
    : result.reason === "not_late"
      ? "The payment date hasn't passed yet."
      : result.reason === "missing_rate"
        ? "We don't have the Bank of England rate for that date yet. Check gov.uk for the current rate."
        : "Enter the amount owed and the date payment was due.";

  return (
    <View style={styles.record}>
      <Text style={styles.label}>Late payment letter</Text>
      <Text style={styles.muted}>{NOT_LEGAL_ADVICE} Check the figures before you send it.</Text>
      <TextField
        label="Amount owed (£)"
        value={debt}
        onChangeText={setDebt}
        keyboardType="decimal-pad"
      />
      <TextField
        label="Payment was due on (YYYY-MM-DD)"
        value={dueDate}
        onChangeText={setDueDate}
        autoCapitalize="none"
        hint="The agreed due date. Change it if your invoice gave a later one."
      />
      {letter ? (
        <>
          <Text style={styles.letter} selectable>
            {letter}
          </Text>
          <Button
            label={Platform.OS === "web" ? (copied ? "Copied" : "Copy letter") : "Share letter"}
            size="sm"
            icon={Platform.OS === "web" ? "copy-outline" : "share-outline"}
            onPress={() =>
              shareText(letter)
                .then(() => setCopied(true))
                .catch(() => {})
            }
            style={styles.start}
          />
        </>
      ) : (
        <Text style={styles.error}>{problem}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  item: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  record: {
    gap: spacing.sm,
  },
  buttons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  start: {
    alignSelf: "flex-start",
  },
  letter: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textPrimary,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
  },
  muted: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  error: {
    fontSize: typography.size.sm,
    color: colors.danger,
  },
});
