import { ListingForm } from "../../features/listings/components/ListingForm";
import { useListingEditor } from "../../features/listings/useListingEditor";

export default function NewListingScreen() {
  const { onSave, saving, error } = useListingEditor();
  return <ListingForm saving={saving} error={error} onSave={onSave} />;
}
