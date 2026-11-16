import { useLocalSearchParams } from "expo-router";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { ListingForm } from "../../../features/listings/components/ListingForm";
import { useListing } from "../../../features/listings/hooks";
import { useListingEditor } from "../../../features/listings/useListingEditor";

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listing = useListing(id);
  const { onSave, saving, error } = useListingEditor(id);

  if (listing.isPending) return <LoadingState />;
  if (listing.data === undefined) return <ErrorState onRetry={() => listing.refetch()} />;
  if (!listing.data || !["draft", "changes_requested"].includes(listing.data.status)) {
    return (
      <EmptyState
        icon="lock-closed-outline"
        title="This listing can't be edited right now"
        description="Only drafts and listings with requested changes can be edited. Move it back to draft from the listing page first."
      />
    );
  }

  return <ListingForm initial={listing.data} saving={saving} error={error} onSave={onSave} />;
}

// A crash here shows a retry prompt in place of this screen only.
export { RouteErrorBoundary as ErrorBoundary } from "../../../components/RouteErrorBoundary";
