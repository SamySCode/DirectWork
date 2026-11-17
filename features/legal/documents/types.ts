/*
 * Legal documents are structured content, not Markdown: the app renders
 * them with its own components (features/legal/components) on iOS, Android
 * and web, and tests can check what they say.
 *
 * Status: drafted from the team's legal reviews in plain English. They are
 * not legal advice - a UK solicitor should review them before launch.
 */

export type LegalBlock =
  /** A paragraph. */
  | { kind: "p"; text: string }
  /** A bulleted list. */
  | { kind: "list"; items: string[] }
  /** Label/value pairs: a two-column table on paper, stacked on a phone. */
  | { kind: "rows"; rows: { label: string; value: string }[] };

export type LegalSection = { heading: string; blocks: LegalBlock[] };

export type LegalSlug =
  | "terms"
  | "privacy"
  | "community-guidelines"
  | "references"
  | "complaints"
  | "cookies"
  | "account-deletion"
  | "contact";

export type LegalDocument = {
  slug: LegalSlug;
  title: string;
  /** One line for the documents list. */
  summary: string;
  version: string;
  /** Human-readable "Last updated" date. */
  updated: string;
  /** Optional opening paragraph(s) before the first heading. */
  intro?: string[];
  sections: LegalSection[];
};

export const p = (text: string): LegalBlock => ({ kind: "p", text });
export const list = (...items: string[]): LegalBlock => ({ kind: "list", items });
export const rows = (...pairs: [label: string, value: string][]): LegalBlock => ({
  kind: "rows",
  rows: pairs.map(([label, value]) => ({ label, value })),
});
export const section = (heading: string, ...blocks: LegalBlock[]): LegalSection => ({
  heading,
  blocks,
});
