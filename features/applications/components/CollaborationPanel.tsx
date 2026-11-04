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
            onPress={() => Linking.openURL(`mailto:${contact.data!.email}`).catch(() => {})}
            style={styles.emailButton}
          />
        </View>
      ) : contact.isPending ? null : (
        <Text style={styles.muted}>Contact details aren't available.</Text>
      )}

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
