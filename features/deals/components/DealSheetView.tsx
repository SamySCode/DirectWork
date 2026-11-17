import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Badge } from "../../../components/Badge";
import { Button } from "../../../components/Button";
import { Text } from "../../../components/Text";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import type { DealSheet } from "../api";
import type { TermSnapshot } from "../logic";
import {
  changedTerms,
  dealEntryState,
  myConfirmedVersion,
  shortDate,
  snapshotTerms,
  termLines,
  type Side,
} from "../logic";
import { BusinessCheckbox } from "./DealSheetForm";

/** Shown at the moment someone confirms - the consent the Terms rely on. */
export const DEAL_CONSENT =
  "By confirming, you agree these terms with the other side. DirectWork isn't a party to your deal and this isn't legal advice. Payment outcomes reported on agreed Deal Sheets are shown to signed-in users, as a count on the owner's profile and listings, with dispute rights: the owner can dispute a report within 14 days. Reports must be true and accurate.";

type DealSheetViewProps = {
  sheet: DealSheet;
  side: Side;
  /** False once payments are reported, or if you've blocked them. */
  canPropose: boolean;
  /** False if you've blocked them - the server refuses it. */
  canConfirm: boolean;
  otherName: string;
  /** The terms this device last saw you propose or confirm, if any. */
  seen: { version: number; terms: TermSnapshot } | null;
  confirming: boolean;
  error: string | null;
  onConfirm: (business: boolean) => void;
  onEdit: () => void;
  onPdf: () => void;
  pdfBusy: boolean;
};

export function DealSheetView({
  sheet,
  side,
  canPropose,
  canConfirm,
  otherName,
  seen,
  confirming,
  error,
  onConfirm,
  onEdit,
  onPdf,
  pdfBusy,
}: DealSheetViewProps) {
  const state = dealEntryState(sheet, side);
  const mine = myConfirmedVersion(sheet, side);
  const myBusiness = side === "owner" ? sheet.owner_business : sheet.member_business;
  const [business, setBusiness] = useState(myBusiness);
  const needsMe = state.kind === "review";
  const changes =
    needsMe && seen && seen.version !== sheet.version
      ? changedTerms(seen.terms, snapshotTerms(sheet))
      : null;

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <Badge
          label={
            state.kind === "agreed"
              ? "Agreed"
              : state.kind === "waiting"
                ? `Waiting for ${otherName}`
                : "Needs your confirmation"
          }
          tone={state.kind === "agreed" ? "mint" : state.kind === "waiting" ? "neutral" : "warning"}
        />
        <Text style={styles.meta}>
          Version {sheet.version}
          {sheet.agreed_at && state.kind === "agreed"
            ? ` · agreed ${shortDate(sheet.agreed_at)}`
            : ` · updated ${shortDate(sheet.updated_at)}`}
        </Text>
      </View>

      {needsMe && mine !== null ? (
        <View style={styles.changes} accessibilityLiveRegion="polite">
          <View style={styles.row}>
            <Ionicons name="git-compare-outline" size={18} color={colors.warning} />
            <Text style={styles.changesTitle}>Changed since you confirmed version {mine}</Text>
          </View>
          {changes && changes.length > 0 ? (
            <Text style={styles.body}>{changes.join(", ")}</Text>
          ) : (
            <Text style={styles.body}>
              Read the whole sheet again before you confirm - we can't show the old version on this
              device.
            </Text>
          )}
        </View>
      ) : null}

      <View style={styles.terms}>
        {termLines(sheet).map((line) => (
          <View
            key={line.key}
            style={[styles.term, changes?.includes(line.label) ? styles.changed : null]}
          >
            <Text style={styles.termLabel}>
              {line.label}
              {changes?.includes(line.label) ? " · changed" : ""}
            </Text>
            <Text style={styles.termValue}>{line.value}</Text>
          </View>
        ))}
        <View style={styles.term}>
          <Text style={styles.termLabel}>Acting in the course of business</Text>
          <Text style={styles.termValue}>
            Owner: {sheet.owner_business ? "yes" : "no"} · Professional:{" "}
            {sheet.member_business ? "yes" : "no"}
          </Text>
        </View>
      </View>

      {needsMe && !canConfirm ? (
        <Text style={styles.meta}>You can't confirm while one of you has blocked the other.</Text>
      ) : null}
      {needsMe && canConfirm ? (
        <View style={styles.confirm}>
          <BusinessCheckbox checked={business} onChange={setBusiness} />
          <Text style={styles.consent}>{DEAL_CONSENT}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label={`Confirm version ${sheet.version}`}
            onPress={() => onConfirm(business)}
            loading={confirming}
          />
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      <View style={styles.buttons}>
        {canPropose ? (
          <Button
            label="Propose changes"
            variant="secondary"
            size="sm"
            icon="create-outline"
            onPress={onEdit}
            disabled={confirming}
            style={styles.flex}
          />
        ) : null}
        <Button
          label="Save or share PDF"
          variant="secondary"
          size="sm"
          icon="document-outline"
          onPress={onPdf}
          loading={pdfBusy}
          style={styles.flex}
        />
      </View>
      {state.kind === "agreed" ? (
        <Text style={styles.meta}>
          {canPropose
            ? "Changing agreed terms makes a new version that you both confirm again."
            : sheet.payment_reports.length > 0
              ? "Payments have been reported, so these terms are now fixed."
              : null}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  meta: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  changes: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningMuted,
  },
  changesTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.warning,
  },
  body: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  terms: {
    gap: spacing.sm,
  },
  term: {
    gap: 2,
    paddingVertical: spacing.xs,
  },
  changed: {
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    paddingLeft: spacing.sm,
  },
  termLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.accent,
  },
  termValue: {
    fontSize: typography.size.md,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  confirm: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  consent: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
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
