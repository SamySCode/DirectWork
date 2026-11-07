import { env } from "../../lib/env";

/*
 * Versions of the documents people accept at sign-up (recorded in
 * public.legal_acceptances via the sign-up metadata trigger, or by
 * record_legal_acceptance from the re-acceptance screen).
 *
 * Versions are ISO dates, optionally with a suffix, and compare as plain
 * strings: anything that sorts below the current version must be accepted
 * again. Bump the date whenever the text of the Terms (including the
 * Community & Listing Guidelines, which they incorporate) or the Privacy
 * Notice changes in a way people should agree to or be told about.
 *
 * The Privacy Notice describes Stripe only while billing is switched on, so
 * switching billing on changes the notice - the "+billing" suffix makes
 * everyone see the updated notice again. Before switching billing on, also
 * publish Pro subscription terms (see docs/LAUNCH.md).
 */
export const TERMS_VERSION = "2026-11-07";
export const PRIVACY_VERSION = env.EXPO_PUBLIC_BILLING_ENABLED
  ? "2026-11-07+billing"
  : "2026-11-07";

/** Shown as "Last updated" on the documents. */
export const LEGAL_UPDATED = "7 November 2026";

export type LegalStatus = { terms_version: string | null; privacy_version: string | null };

/** True when the person's latest accepted Terms or Privacy version is older than the current one. */
export function needsLegalAcceptance(status: LegalStatus): boolean {
  const outdated = (accepted: string | null, current: string) => !accepted || accepted < current;
  return (
    outdated(status.terms_version, TERMS_VERSION) ||
    outdated(status.privacy_version, PRIVACY_VERSION)
  );
}
