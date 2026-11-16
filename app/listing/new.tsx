import { ListingForm } from "../../features/listings/components/ListingForm";
import { useListingEditor } from "../../features/listings/useListingEditor";

export default function NewListingScreen() {
  const { onSave, saving, error } = useListingEditor();
  return <ListingForm saving={saving} error={error} onSave={onSave} />;
}

// A crash here shows a retry prompt in place of this screen only.
export { RouteErrorBoundary as ErrorBoundary } from "../../components/RouteErrorBoundary";
