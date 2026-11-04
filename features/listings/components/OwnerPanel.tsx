import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Badge } from "../../../components/Badge";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Text } from "../../../components/Text";
import { confirm } from "../../../lib/confirm";
import { billingAvailable } from "../../billing/availability";
import { errorMessage, FunctionError } from "../../../lib/functions";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import type { ListingDetail } from "../api";
import { useDeleteDraft, useSetListingStatus, useSubmitListing } from "../hooks";
import { listingStatusMeta } from "../labels";

const notices: Record<string, { text: string; tone: "mint" | "warning" }> = {
  submitted: { text: "Submitted. We'll review it, usually within a day.", tone: "mint" },
  saved: { text: "Draft saved.", tone: "mint" },
  submit_failed: {
    text: "Saved as a draft, but it couldn't be submitted. Try Submit for review again.",
    tone: "warning",
  },
  limit: {
    text: "Saved as a draft. You've reached your plan's live listing limit - pause or close another listing to submit this one.",
    tone: "warning",
  },
};

type OwnerPanelProps = {
  listing: ListingDetail;
  notice?: string;
};

export function OwnerPanel({ listing, notice }: OwnerPanelProps) {
  const router = useRouter();
  const setStatus = useSetListingStatus();
  const submit = useSubmitListing();
  const remove = useDeleteDraft();
  const [error, setError] = useState<{ message: string; limit: boolean } | null>(null);
  const meta = listingStatusMeta[listing.status];
  const busy = setStatus.isPending || submit.isPending || remove.isPending;
  // Unknown keys are ignored: the notice comes from the URL, so free text
  // here would let anyone craft a link that shows their own message.
  const noticeMeta = notice && Object.hasOwn(notices, notice) ? notices[notice]! : null;

  const fail = (err: unknown) =>
    setError({
      message: errorMessage(err),
      limit: err instanceof FunctionError && err.code === "LISTING_LIMIT",
    });

  const move = async (
    status: "draft" | "published" | "paused" | "completed" | "abandoned",
    prompt?: { title: string; message: string; confirmLabel: string; destructive?: boolean },
  ) => {
    if (prompt && !(await confirm(prompt))) return;
    setError(null);
    setStatus.mutate({ projectId: listing.id, status }, { onError: fail });
  };

  const editLive = async () => {
    const ok = await confirm({
      title: "Edit this listing?",
      message:
        "It comes out of Discover while you edit, and goes back through review when you resubmit. Existing applicants keep their applications.",
      confirmLabel: "Move to draft",
    });
    if (!ok) return;
    setError(null);
    try {
      await setStatus.mutateAsync({ projectId: listing.id, status: "draft" });
      router.push(`/listing/${listing.id}/edit`);
    } catch (err) {
      fail(err);
    }
  };

  const close = (status: "completed" | "abandoned") =>
    move(status, {
      title: status === "completed" ? "Mark as completed?" : "Close this listing?",
      message: "Anyone still waiting for a reply will be told it's closed. This can't be reopened.",
      confirmLabel: status === "completed" ? "Mark completed" : "Close listing",
      destructive: status === "abandoned",
    });

  return (
    <Card style={styles.card}>
      <View style={styles.statusRow}>
        <Badge label={meta.label} tone={meta.tone} />
        <Text style={styles.hint}>{meta.hint}</Text>
      </View>

      {noticeMeta && !error ? (
        <View
          style={[
            styles.notice,
            noticeMeta.tone === "mint" ? styles.noticeMint : styles.noticeWarning,
          ]}
        >
          <Text style={styles.noticeText}>{noticeMeta.text}</Text>
        </View>
      ) : null}

      {listing.status === "changes_requested" && listing.review_note ? (
        <View style={[styles.notice, styles.noticeWarning]}>
          <Text style={styles.noticeLabel}>Reviewer's note</Text>
          <Text style={styles.noticeText}>{listing.review_note}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {listing.status === "draft" || listing.status === "changes_requested" ? (
          <>
            <Button
              label="Submit for review"
              onPress={() => {
                setError(null);
                submit.mutate(listing.id, { onError: fail });
              }}
              loading={submit.isPending}
            />
            <Button
              label="Edit"
              variant="secondary"
              onPress={() => router.push(`/listing/${listing.id}/edit`)}
              disabled={busy}
            />
            {listing.status === "draft" ? (
              <Button
                label="Delete draft"
                variant="danger"
                disabled={busy}
                onPress={async () => {
                  const ok = await confirm({
                    title: "Delete this draft?",
                    message: "This can't be undone.",
                    confirmLabel: "Delete",
                    destructive: true,
                  });
                  if (ok)
                    remove.mutate(listing.id, { onSuccess: () => router.back(), onError: fail });
                }}
              />
            ) : null}
          </>
        ) : null}

        {listing.status === "in_review" ? (
          <Button
            label="Withdraw from review"
            variant="secondary"
            onPress={() => move("draft")}
            loading={busy}
          />
        ) : null}

        {listing.status === "published" || listing.status === "paused" ? (
          <>
            {listing.status === "published" ? (
              <Button
                label="Pause"
                variant="secondary"
                onPress={() => move("paused")}
                loading={busy}
              />
            ) : (
              <Button label="Resume" onPress={() => move("published")} loading={busy} />
            )}
            <Button label="Edit" variant="secondary" onPress={editLive} disabled={busy} />
            <View style={styles.row}>
              <Button
                label="Mark completed"
                variant="secondary"
                size="sm"
                onPress={() => close("completed")}
                disabled={busy}
                style={styles.flex}
              />
              <Button
                label="Close"
                variant="danger"
                size="sm"
                onPress={() => close("abandoned")}
                disabled={busy}
                style={styles.flex}
              />
            </View>
          </>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error.message}</Text>
          {error.limit && billingAvailable ? (
            <Button label="See plans" size="sm" onPress={() => router.push("/billing")} />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  statusRow: {
    gap: spacing.sm,
  },
  hint: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  notice: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  noticeMint: {
    backgroundColor: colors.mintMuted,
  },
  noticeWarning: {
    backgroundColor: colors.warningMuted,
  },
  noticeLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.warning,
  },
  noticeText: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  actions: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  errorBox: {
    gap: spacing.sm,
  },
  error: {
    fontSize: typography.size.sm,
    color: colors.danger,
  },
});
