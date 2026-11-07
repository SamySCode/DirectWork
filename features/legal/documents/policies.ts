import { env } from "../../../lib/env";
import { operator } from "../operator";
import { LEGAL_UPDATED } from "../versions";
import { list, p, rows, section, type LegalDocument } from "./types";

// These documents aren't accepted at sign-up, so they version by date only.
const VERSION = "2026-11-06";

export const references: LegalDocument = {
  slug: "references",
  title: "References Policy",
  summary: "How references and track records work, and what to do about one that's wrong.",
  version: VERSION,
  updated: LEGAL_UPDATED,
  sections: [
    section(
      "How references work",
      list(
        "A reference can be written only after both people confirm that a collaboration was completed. Work can be marked completed only after at least 7 days of working together.",
        "Each person can write one reference for each collaboration.",
        "References appear on the profile of the person they're about, with the author's name and photo, to everyone signed in.",
      ),
    ),
    section(
      'What "confirmed by both sides" means',
      p(
        "Track records count the different people you've completed work with, where both of you confirmed it was completed. We don't check the work itself, and we don't verify what a reference says. Use references as one signal among others.",
      ),
    ),
    section(
      "What isn't allowed",
      list(
        "References can't be bought. Don't offer, ask for or accept money, discounts or favours for a reference.",
        "Don't swap references (\"I'll write you a good one if you write me one\").",
        "References can't be edited once posted.",
        "References must be about the work you did together, honest, and free of abuse, contact details and sensitive personal details.",
      ),
      p(
        "We don't hide references because they're negative. We remove references that break these rules.",
      ),
    ),
    section(
      "If a reference is wrong",
      p(
        `If a reference about you is fake, untrue, abusive or was paid for, report the author's profile (choose "Misleading or fake") and say which reference you mean, or email ${operator.supportEmail}. We'll look into it and may remove the reference.`,
      ),
      p(
        "If either person deletes their account, the collaboration and the references between them are deleted too.",
      ),
    ),
  ],
};

export const complaints: LegalDocument = {
  slug: "complaints",
  title: "Complaints & Appeals",
  summary: "How to complain about content, appeal a decision, or raise a data protection concern.",
  version: VERSION,
  updated: LEGAL_UPDATED,
  intro: ["Anyone can use this procedure, whether or not they have a DirectWork account."],
  sections: [
    section(
      "What you can raise",
      list(
        "Content: something on DirectWork you think is illegal or breaks our Community & Listing Guidelines.",
        "Appeals: a decision we made about you, such as removing content, declining a listing, or restricting, suspending or closing your account.",
        "Data protection: how we've handled your personal data.",
        "Anything else about our service, including how we meet our duties under the Online Safety Act.",
      ),
    ),
    section(
      "How to raise it",
      list(
        "For a profile or listing, the quickest route is Report on that page.",
        `Otherwise email ${operator.complaintsEmail}. For data protection, you can also use ${operator.privacyEmail}.`,
        "Tell us what it's about, where it is (a link or the name of the listing or person), and what you'd like us to do. For an appeal, tell us why you think our decision was wrong.",
      ),
    ),
    section(
      "What happens next",
      list(
        "We'll acknowledge your complaint within 30 days, and usually much sooner.",
        "A person looks into it. For an appeal, where possible it's someone who wasn't involved in the original decision.",
        "We'll tell you the outcome and our reasons. If an appeal succeeds, we'll put things right, for example by restoring content or your account.",
        "You can ask us to look again once if you're unhappy with the outcome.",
        "We keep a record of complaints for 2 years after we close them.",
      ),
    ),
    section(
      "If you're still not satisfied",
      list(
        "Data protection: you can complain to the Information Commissioner's Office at ico.org.uk/make-a-complaint or on 0303 123 1113.",
        "Online safety: Ofcom regulates online safety. It doesn't resolve individual complaints, but you can tell it about a concern at ofcom.org.uk.",
        "We don't use an alternative dispute resolution scheme. You can also seek independent advice, for example from Citizens Advice.",
      ),
    ),
  ],
};

const billing = env.EXPO_PUBLIC_BILLING_ENABLED;

export const cookies: LegalDocument = {
  slug: "cookies",
  title: "Cookies & Storage",
  summary: "What DirectWork stores on your device and why. Strictly necessary only.",
  version: VERSION,
  updated: LEGAL_UPDATED,
  intro: [
    "DirectWork sets no cookies of its own and uses no analytics, advertising or tracking technology. We store only what's strictly necessary to provide the service you asked for, so we don't ask for consent.",
  ],
  sections: [
    section(
      "What we store",
      rows(
        [
          "Website",
          "Your sign-in session, in your browser's local storage, so you stay signed in. It's removed when you sign out.",
        ],
        [
          "Apps",
          "Your sign-in session, encrypted, with the key kept in your device's secure keychain or keystore. Images you view are cached on your device to make the app faster.",
        ],
      ),
    ),
    section(
      "Other services",
      list(
        "Our web host, Cloudflare, may set a strictly necessary security cookie to protect the website from attacks.",
        ...(billing ? ["Stripe's payment pages (on stripe.com) use their own cookies."] : []),
      ),
    ),
    section(
      "Clearing it",
      p(
        "Signing out removes your session. You can also clear this website's data in your browser settings, or uninstall the app.",
      ),
    ),
  ],
};
