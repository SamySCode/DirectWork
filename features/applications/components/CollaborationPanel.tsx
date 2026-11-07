import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Badge } from "../../../components/Badge";
import { Button } from "../../../components/Button";
import { Text } from "../../../components/Text";
import { confirm } from "../../../lib/confirm";
import { errorMessage } from "../../../lib/functions";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import type { Application } from "../api";
import { useContact, useRecordOutcome } from "../hooks";
import { collaborationState } from "../labels";
import { DealSheetEntry } from "../../deals/components/DealSheetEntry";
import { ReferenceComposer } from "./ReferenceComposer";

type CollaborationPanelProps = {
  application: Application;
  viewerIsOwner: boolean;
};

/** Everything that happens after a yes: contact details, then the outcome both sides confirm. */
export function CollaborationPanel({ application, viewerIsOwner }: CollaborationPanelProps) {
  const accepted = application.status === "accepted";
  const contact = useContact(application.id, accepted);
  const record = useRecordOutcome();
  const [error, setError] = useState<string | null>(null);

  if (!accepted || !application.membership) return null;

  const membership = application.membership;
  const state = collaborationState(application, viewerIsOwner);
  const outcome = membership.outcome;
  const mine = viewerIsOwner ? outcome?.confirmed_by_owner_at : outcome?.confirmed_by_member_at;
  const theirs = viewerIsOwner ? outcome?.confirmed_by_member_at : outcome?.confirmed_by_owner_at;
  const settled = !!(mine && theirs);
  const partner = application.application_type === "partner";
  const title = application.project?.title;
  const mailto = (email: string) =>
    `mailto:${email}${title ? `?subject=${encodeURIComponent(`DirectWork: ${title}`)}` : ""}`;

  const recordOutcome = async (value: "completed" | "abandoned") => {
    const ok = await confirm({
      title: value === "completed" ? "Mark as completed?" : "Mark as ended early?",
      message:
        value === "completed"
          ? "The other side is asked to confirm. Once both of you do, it counts on both your track records."
          : "The other side is asked to confirm. Ended collaborations are recorded but don't count as completed.",
      confirmLabel: value === "completed" ? "Mark completed" : "Mark ended",
    });
    if (!ok) return;
    setError(null);
    record.mutate(
      { membershipId: membership.id, outcome: value },
      { onError: (err) => setError(errorMessage(err)) },
    );
  };

  return (
    <View style={styles.panel}>
      {contact.data ? (
        <View style={styles.contact}>
          <View style={styles.contactHeader}>
            <Ionicons name="sparkles" size={18} color={colors.mintInk} />
            <Text style={styles.contactTitle}>Contact details unlocked</Text>
          </View>
          <Text style={styles.contactName}>{contact.data.full_name}</Text>
          <Text style={styles.contactEmail} selectable>
            {contact.data.email}
          </Text>
          <Button
            label={`Email ${contact.data.full_name.split(" ")[0]}`}
            icon="mail-outline"
            size="sm"
            onPress={() => Linking.openURL(mailto(contact.data!.email)).catch(() => {})}
            style={styles.emailButton}
          />
          <Text style={styles.contactNote}>
            We don't email them for you. Write first - they can see your details here too.
          </Text>
        </View>
      ) : contact.isPending ? null : contact.isError ? (
        <View style={styles.retryRow} accessibilityLiveRegion="polite">
          <Text style={styles.muted}>Couldn't load contact details.</Text>
          <Button
            label="Try again"
            variant="secondary"
            size="sm"
            onPress={() => contact.refetch()}
            loading={contact.isRefetching}
          />
        </View>
      ) : (
        <Text style={styles.muted}>Contact details aren't available.</Text>
      )}

      {contact.data ? (
        <View style={styles.safety} accessibilityRole="summary">
          <View style={styles.contactHeader}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.safetyTitle}>Before you start</Text>
          </View>
          {[
            "DirectWork never asks for money and isn't a party to your deal.",
            'Never pay to get work - no "admin fees", deposits or paid "tests" - and don\'t send bank or ID documents before terms are agreed.',
            partner
              ? "Agree equity, vesting, IP and what happens if it ends in writing before you start."
              : "Agree pay, scope, deadlines and who owns the work (IP) in writing before you start.",
            "Working with a company? Check it on Companies House (find-and-update.company-information.service.gov.uk).",
            "Something feels off? Report it from the listing or their profile.",
          ].map((line) => (
            <View key={line} style={styles.safetyLine}>
              <Text style={styles.safetyBullet}>•</Text>
              <Text style={styles.safetyText}>{line}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <DealSheetEntry
        applicationId={application.id}
        membershipId={membership.id}
        side={viewerIsOwner ? "owner" : "member"}
      />

      {state ? (
        <View style={styles.outcome}>
          <Badge label={state.label} tone={state.tone} />
          {!settled ? (
            <>
              <Text style={styles.muted}>
                {outcome && !mine
                  ? "Confirm if you agree - or record what actually happened."
                  : "When the work wraps up, record how it went. It counts once you both agree."}
              </Text>
              <View style={styles.outcomeButtons}>
                {outcome?.outcome !== "completed" || !mine ? (
                  <Button
                    label={
                      outcome?.outcome === "completed" && !mine
                        ? "Confirm completed"
                        : "Mark completed"
                    }
                    size="sm"
                    onPress={() => recordOutcome("completed")}
                    loading={record.isPending}
                    style={styles.flex}
                  />
                ) : null}
                {outcome?.outcome !== "abandoned" || !mine ? (
                  <Button
                    label={
                      outcome?.outcome === "abandoned" && !mine ? "Confirm ended" : "Ended early"
                    }
                    variant="secondary"
                    size="sm"
                    onPress={() => recordOutcome("abandoned")}
                    disabled={record.isPending}
                    style={styles.flex}
                  />
                ) : null}
              </View>
            </>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : null}

      {settled && outcome?.outcome === "completed" ? (
        <ReferenceComposer
          membershipId={membership.id}
          otherName={
            contact.data?.full_name ??
            (viewerIsOwner ? (application.applicant?.full_name ?? "them") : "the owner")
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.md,
  },
  contact: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.mintMuted,
  },
  contactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  contactTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.mintInk,
  },
  contactName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  contactEmail: {
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  emailButton: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
  },
  contactNote: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  retryRow: {
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  safety: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  safetyTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  safetyLine: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  safetyBullet: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  safetyText: {
    flex: 1,
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  outcome: {
    gap: spacing.sm,
  },
  outcomeButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  muted: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  error: {
    fontSize: typography.size.sm,
    color: colors.danger,
  },
});
