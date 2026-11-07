import { useLocalSearchParams, useRouter } from "expo-router";
import { EmptyState } from "../../components/EmptyState";
import { Screen } from "../../components/Screen";
import { getLegalDocument, legalSlugs } from "../../features/legal/documents";
import { LegalDocumentView } from "../../features/legal/components/LegalDocumentView";

// Lets a static web export pre-render every document (e.g. the public
// /legal/account-deletion page Google Play links to).
export function generateStaticParams() {
  return legalSlugs.map((doc) => ({ doc }));
}

/** One legal document. Reachable signed out (see useProtectedRoute). */
export default function LegalDocumentScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const router = useRouter();
  const document = getLegalDocument(doc);

  if (!document) {
    return (
      <EmptyState
        icon="document-text-outline"
        title="We couldn't find that page"
        description="It may have moved. All our legal documents are listed on one page."
        actionLabel="See all documents"
        onAction={() => router.replace("/legal")}
      />
    );
  }

  return (
    <Screen>
      <LegalDocumentView document={document} />
    </Screen>
  );
}
