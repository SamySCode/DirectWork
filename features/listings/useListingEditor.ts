import { useRouter } from "expo-router";
import { useState } from "react";
import { errorMessage, FunctionError } from "../../lib/functions";
import { useSaveListing, useSubmitListing } from "./hooks";
import type { ImageDraft } from "./api";
import type { ListingInput } from "./schemas";

/**
 * Save (and optionally submit) then land on the listing page. The draft is
 * saved even when submission is refused (e.g. plan limit reached), so the
 * reason travels to the listing page as a notice rather than being lost.
 */
export function useListingEditor(existingId?: string) {
  const router = useRouter();
  const save = useSaveListing(existingId);
  const submit = useSubmitListing();
  const [error, setError] = useState<string | null>(null);

  const onSave = async (input: ListingInput, images: ImageDraft, andSubmit: boolean) => {
    setError(null);
    let id: string;
    try {
      id = await save.mutateAsync({ input, images });
    } catch (err) {
      setError(errorMessage(err));
      return;
    }
    let notice: string | undefined;
    if (andSubmit) {
      try {
        await submit.mutateAsync(id);
        notice = "submitted";
      } catch (err) {
        // Only a known key travels in the URL - never free text, which anyone
        // could put in a link to make the app display a message of their choosing.
        notice =
          err instanceof FunctionError && err.code === "LISTING_LIMIT" ? "limit" : "submit_failed";
      }
    } else {
      notice = "saved";
    }
    router.replace({ pathname: "/listing/[id]", params: { id, notice } });
  };

  return { onSave, saving: save.isPending || submit.isPending, error };
}
