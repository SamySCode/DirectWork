import { env } from "../../../lib/env";
import { companyNumber, operator, vatNumber } from "../operator";
import { LEGAL_UPDATED } from "../versions";
import { list, p, rows, section, type LegalDocument } from "./types";

const VERSION = "2026-11-07";
const billing = env.EXPO_PUBLIC_BILLING_ENABLED;

/** What account deletion removes - shared with the in-app delete screen. */
export const DELETED_ON_ACCOUNT_DELETION = [
  "Your profile, photo, skills and portfolio",
  "Your listings, their images and the applications to them",
  "Your applications, answers and work samples",
  "Your collaborations, outcomes, references, Deal Sheets and payment reports, on both sides, so they disappear from the other person's profile too",
  "The people you've blocked",
  "Any Pro subscription, cancelled straight away",
];

/** What's kept after deletion, and why - shared with the in-app delete screen. */
export const KEPT_AFTER_ACCOUNT_DELETION: [what: string, why: string][] = [
  [
    "Reports you made, or that were made about you",
    "Kept without the link to your account, for safety: 3 years after we resolve them if we acted, 12 months if we dismissed them.",
  ],
  ...(billing
    ? ([
        [
          "Billing records, if you paid for Pro",
          "Kept by Stripe and us for 6 years, because tax and accounting law requires it.",
        ],
      ] as [string, string][])
    : []),
  ["Backups and security logs", "Roll off within 7 days."],
  ["Public image caches", "Images can stay in delivery caches for up to an hour."],
  [
    "Information the law requires us to preserve",
    "For example for a report to the National Crime Agency. If this applies, we can't delete the account until the legal hold ends.",
  ],
  [
    "Copies other people have",
    "Someone you worked with may still have your name and email, for example in their own email.",
  ],
];

export const accountDeletion: LegalDocument = {
  slug: "account-deletion",
  title: "Deleting your account",
  summary: "How to delete your DirectWork account and data, and what we keep afterwards.",
  version: VERSION,
  updated: LEGAL_UPDATED,
  sections: [
    section(
      "Delete it in the app",
      list(
        "Sign in to the DirectWork app or website.",
        "Go to Profile, then Delete account.",
        "Enter your password and choose Delete my account permanently.",
      ),
      p(
        "Deletion happens straight away and can't be undone. If you want a copy of your data, download it first from Profile, then Help & legal, then Download my data.",
      ),
    ),
    section(
      "Can't sign in?",
      p(
        `If you've forgotten your password, use "Forgot password" on the sign-in screen first. If you still can't get in, email ${operator.supportEmail} from the email address on your account and ask us to delete it. We'll check the request is from you and delete the account within one month.`,
      ),
    ),
    section("What's deleted", list(...DELETED_ON_ACCOUNT_DELETION)),
    section("What we keep, and for how long", rows(...KEPT_AFTER_ACCOUNT_DELETION)),
  ],
};

export const contact: LegalDocument = {
  slug: "contact",
  title: "Contact & company details",
  summary: "Who runs DirectWork and how to reach us.",
  version: VERSION,
  updated: LEGAL_UPDATED,
  sections: [
    section(
      "Who we are",
      rows(
        ["Service", operator.tradingName],
        ["Run by", operator.legalName],
        ["Type of business", operator.entityType],
        ...(companyNumber ? ([["Company number", companyNumber]] as [string, string][]) : []),
        ["Address", operator.address],
        ...(vatNumber ? ([["VAT number", vatNumber]] as [string, string][]) : []),
        ["ICO registration", operator.icoRegistrationNumber],
      ),
    ),
    section(
      "How to reach us",
      rows(
        ["Support", operator.supportEmail],
        ["Privacy and your data", operator.privacyEmail],
        ["Complaints and appeals", operator.complaintsEmail],
      ),
      p(
        "To report a profile or listing, use Report on that page - it reaches our moderators fastest. If someone is in immediate danger, call 999.",
      ),
    ),
  ],
};
