import { Gallery } from "../../../components/Gallery";
import type { Application } from "../api";
import { useAttachmentUrls } from "../hooks";

/** Private work samples - visible only to the applicant and the listing owner (signed URLs). */
export function AttachmentGallery({ attachments }: { attachments: Application["attachments"] }) {
  const urls = useAttachmentUrls(attachments.map((attachment) => attachment.storage_path));
  if (!urls.data) return null;
  return (
    <Gallery
      height={110}
      images={attachments
        .filter((attachment) => urls.data[attachment.storage_path])
        .map((attachment) => ({ key: attachment.id, uri: urls.data[attachment.storage_path]! }))}
    />
  );
}
