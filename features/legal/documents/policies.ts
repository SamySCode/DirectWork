import { env } from "../../../lib/env";
import { operator } from "../operator";
import { LEGAL_UPDATED, PRIVACY_UPDATED } from "../versions";
import { list, p, rows, section, type LegalDocument } from "./types";

// These documents aren't accepted at sign-up, so they version by date only.
const VERSION = "2026-11-07";

export const references: LegalDocument = {
  slug: "references",
  title: "Reviews, References & Payment Records Policy",
  summary:
    "How references, track records and payment records are collected, checked and disputed, and what to do about one that's wrong.",
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
    section(
      "How payment records are collected",
      list(
        "Payment records come only from Deal Sheets that both the owner and the professional confirmed.",
        "After each payment due date, the professional can report the payment as paid on time, paid late (with the date) or not paid yet. One report per milestone, or one for the deal.",
        "The professional can correct their own report within 14 days.",
        'Owners see a count on their profile and listings, such as "Paid on time on 4 of 5 reported payments · reported by professionals". It\'s shown only to signed-in users, only once at least 3 reports count, and never with labels, scores or rankings.',
      ),
    ),
    section(
      "How we check them",
      list(
        "A report counts only if it's on an agreed Deal Sheet, the payment's due date has passed, and the professional's account was at least 14 days old when the Deal Sheet was agreed.",
        "The collaboration must also have a confirmed outcome, or a reported payment whose due date has passed.",
        "We don't see your bank account or check whether money moved. A record is what professionals reported, not a finding by DirectWork.",
      ),
    ),
    section(
      "Disputing a payment record",
      list(
        "Owners can dispute a report from the Deal Sheet within 14 days of it being made, with a reason. While a moderator reviews it, it isn't counted.",
        "A person decides every dispute. Upheld: the report is removed. Rejected: it counts. Both sides are told in their Activity inbox.",
        `After 14 days, or if you aren't a member, email ${operator.complaintsEmail}. We act promptly on credible complaints that a record is false or defamatory, following our notice procedure.`,
        "Disputing a record is also how you can ask us to correct personal data about you that's inaccurate.",
      ),
    ),
    section(
      "Never paid for, never suppressed",
      list(
        "Nobody can pay for, or be offered anything for, a reference, a payment report or a change to one. That includes discounts, favours and refunds.",
        "We don't remove or hide genuine negative records, and we don't let anyone pay to improve their record.",
        "Payment records aren't sold, shared outside DirectWork or offered through an API, and aren't for credit decisions.",
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
        "Payment records: a payment report you think is false. Dispute it from the Deal Sheet within 14 days, or complain here at any time.",
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
  summary:
    "What DirectWork stores on your device and why: what's strictly necessary, plus your email only if you ask us to remember it.",
  version: "2026-11-17",
  updated: PRIVACY_UPDATED,
  intro: [
    'DirectWork sets no cookies of its own and uses no analytics, advertising or tracking technology. Almost everything we store is strictly necessary to provide the service you asked for, so it doesn\'t need your consent. The one exception is optional: your email address, which we keep on your device only if you tick "Remember my email on this device" when you sign in.',
  ],
  sections: [
    section(
      "What we store",
      rows(
        [
          "Website",
          "Your sign-in session, in your browser's local storage, so you stay signed in. It's removed when you sign out. A copy of Deal Sheet terms you proposed or confirmed, so we can show you what changed in a later version. Only if you tick \"Remember my email on this device\": your email address, so the sign-in form is filled in next time. It stays after you sign out, and it never leaves your device.",
        ],
        [
          "Apps",
          "Your sign-in session, encrypted, with the key kept in your device's secure keychain or keystore. Images you view are cached on your device to make the app faster. A copy of Deal Sheet terms you proposed or confirmed, so we can show you what changed in a later version. Only if you tick \"Remember my email on this device\": your email address, in your device's secure keychain or keystore, so the sign-in form is filled in next time. It stays after you sign out, and it never leaves your device. If you turn vibration off (Profile, On this phone): that choice, so it stays off.",
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
        "Signing out removes your session. To forget a remembered email, untick \"Remember my email on this device\" on the sign-in screen: it's deleted straight away. Deleting your account also deletes it from the device you delete it on. You can also clear this website's data in your browser settings, or uninstall the app.",
      ),
    ),
  ],
};
