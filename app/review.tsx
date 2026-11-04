import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { TextField } from "../components/TextField";
import { useIsAdmin } from "../features/admin/hooks";
import type { ListingDetail } from "../features/listings/api";
import { ListingDetailView } from "../features/listings/components/ListingDetailView";
import { useReviewListing, useReviewQueue } from "../features/listings/hooks";
import { timeAgo } from "../features/listings/labels";
import { errorMessage } from "../lib/functions";
import { colors, spacing, typography } from "../lib/theme";

// The operator's curation queue (docs/PRODUCT_STRATEGY.md Phase 0/1). The
// screen is hidden from non-admins, but the real gate is private.is_admin in
// private.review_listing - this page grants nothing on its own.
export default function ReviewScreen() {
  const isAdmin = useIsAdmin();
  const queue = useReviewQueue(!!isAdmin.data);

  if (isAdmin.isPending) return <LoadingState />;
  if (!isAdmin.data) {
    return <EmptyState icon="lock-closed-outline" title="Reviewers only" />;
  }
  if (queue.isPending) return <LoadingState />;
  if (queue.isError) return <ErrorState onRetry={() => queue.refetch()} />;
  if (queue.data.length === 0) {
    return (
      <EmptyState
        icon="checkmark-done-outline"
        title="Queue is clear"
        description="New submissions show up here oldest first."
      />
    );
  }

  return (
    <Screen onRefresh={() => queue.refetch()} refreshing={queue.isRefetching}>
      <Text style={styles.count}>{queue.data.length} waiting · oldest first</Text>
      {queue.data.map((listing) => (
        <ReviewItem key={listing.id} listing={listing} />
      ))}
    </Screen>
  );
}

function ReviewItem({ listing }: { listing: ListingDetail }) {
  const review = useReviewListing();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const decide = (approve: boolean) => {
    if (!approve && !note.trim()) {
      setError("Tell the owner what to change.");
      return;
    }
    setError(null);
    review.mutate(
      { projectId: listing.id, approve, note: approve ? undefined : note.trim() },
      { onError: (err) => setError(errorMessage(err)) },
    );
  };

  return (
    <Card style={styles.item}>
      <Text style={styles.submitted}>Submitted {timeAgo(listing.updated_at)}</Text>
      <ListingDetailView listing={listing} />
      <View style={styles.checklist}>
        <Text style={styles.checklistTitle}>Before approving, check</Text>
        <Text style={styles.checklistItem}>
          • It's real work with a clear outcome, not a vague idea
        </Text>
        <Text style={styles.checklistItem}>• Pay or terms are stated and plausible</Text>
        <Text style={styles.checklistItem}>
          • No contact details, links to off-platform payment, or discriminatory requirements
        </Text>
      </View>
      <TextField
        label="Note to the owner (required to request changes)"
        value={note}
        onChangeText={setNote}
        autoCapitalize="sentences"
        multiline
        numberOfLines={3}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.buttons}>
        <Button
          label="Request changes"
          variant="secondary"
          onPress={() => decide(false)}
          disabled={review.isPending}
          style={styles.flex}
        />
        <Button
          label="Approve"
          icon="checkmark"
          onPress={() => decide(true)}
          loading={review.isPending}
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
    gap: spacing.lg,
    padding: spacing.lg,
  },
  submitted: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  checklist: {
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.surfaceSunken,
    borderRadius: 12,
  },
  checklistTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  checklistItem: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  error: {
    fontSize: typography.size.sm,
    color: colors.danger,
  },
  buttons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
});
