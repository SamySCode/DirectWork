import { accountDeletion, contact } from "./account";
import { guidelines } from "./guidelines";
import { complaints, cookies, references } from "./policies";
import { privacy } from "./privacy";
import { terms } from "./terms";
import type { LegalDocument, LegalSlug } from "./types";

export { TERMS_VERSION, PRIVACY_VERSION } from "../versions";
export type { LegalBlock, LegalDocument, LegalSection, LegalSlug } from "./types";

/** Every public legal page, in the order the Help & legal screen lists them. */
export const legalDocuments: LegalDocument[] = [
  terms,
  privacy,
  guidelines,
  references,
  complaints,
  cookies,
  accountDeletion,
  contact,
];

export function getLegalDocument(slug: string | undefined): LegalDocument | undefined {
  return legalDocuments.find((doc) => doc.slug === slug);
}

export const legalSlugs = legalDocuments.map((doc) => doc.slug) satisfies LegalSlug[];
