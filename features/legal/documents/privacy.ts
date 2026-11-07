import { env } from "../../../lib/env";
import { operator, operatorIdentity } from "../operator";
import { LEGAL_UPDATED, PRIVACY_VERSION } from "../versions";
import { list, p, rows, section, type LegalDocument } from "./types";

// Stripe appears only while billing is switched on (PRIVACY_VERSION changes
// with it, so people are shown the updated notice).
const billing = env.EXPO_PUBLIC_BILLING_ENABLED;

export const privacy: LegalDocument = {
  slug: "privacy",
  title: "Privacy Notice",
  summary: "What personal data we collect, why, who sees it, how long we keep it and your rights.",
  version: PRIVACY_VERSION,
  updated: LEGAL_UPDATED,
  sections: [
    section(
      "1. Who we are",
      p(
        `DirectWork is run by ${operatorIdentity}. We decide how your personal data is used for the DirectWork apps and website, which makes us the "controller".`,
      ),
      p(
        `Contact us about privacy, your rights or a complaint at ${operator.privacyEmail}, or write to us at ${operator.address}. We're registered with the Information Commissioner's Office (ICO), registration number ${operator.icoRegistrationNumber}. We haven't appointed a Data Protection Officer because the law doesn't require one for us; ${operator.dataProtectionLead} is responsible for data protection.`,
      ),
    ),
    section(
      "2. The short version",
      list(
        "Your profile is visible to everyone signed in to DirectWork. Profile photos, portfolio images and listing images can be opened by anyone who has the image link, even without an account.",
        "Your email address is shared with one other member only once you both agree to work together (when an owner accepts an application).",
        "We don't show ads, sell your data, use analytics or tracking cookies, or make automated decisions about you that have legal or similarly significant effects.",
        ...(billing
          ? ["Pro subscription payments are handled by Stripe. We never see your card details."]
          : []),
        "You can download your data and delete your account in the app at any time. Section 10 explains what we keep afterwards and why.",
      ),
    ),
    section(
      "3. What we collect and where it comes from",
      p("You give us:"),
      list(
        "Account: your email address and password. We store only a scrambled (hashed) version of your password. We also record your confirmation that you're 18 or over, and which version of our Terms of Service and this notice you accepted and when.",
        "Profile: name, headline, bio, location, working preference, availability, current role, experience, what you're here for (paid work, partnerships, hiring), skills, a portfolio link, a profile photo and up to 6 portfolio images with captions.",
        "Listings (if you post work): title, description, location, commitment, duration, pay range or partnership terms, required skills, questions for applicants and up to 4 images.",
        "Applications: your cover note, up to 3 work-sample images, and your answers to the owner's questions.",
        "Working together: whether a collaboration was completed or ended early, an optional summary, and references you write.",
        "Deal Sheets: the terms you propose or confirm (scope, pay basis and amount, payment terms, milestones, intellectual property, and for partnerships equity, vesting and decision rights), whether you act in the course of business, and which version you confirmed and when.",
        "Payment reports (professionals): whether each payment due under an agreed Deal Sheet was paid on time, paid late (and when) or not paid, and any correction.",
        "Disputes (owners): your reason for disputing a payment report.",
        "Safety: reports you make (a reason and optional details) and people you block.",
        ...(billing
          ? ["Billing (Pro only): your subscription status. Card details go straight to Stripe."]
          : []),
        "Contacting us: whatever you send us.",
      ),
      p("Created when you use DirectWork:"),
      list(
        "Account and security data: when you signed up and last signed in; sign-in sessions (IP address, device or browser type); technical logs of requests to our servers (IP address, device or browser type, what was requested including search terms, and the time).",
        "Your activity: applications and listings and their status history; notifications in your Activity inbox; when you last confirmed your availability.",
      ),
      p("From other people and organisations:"),
      list(
        "Listing owners: questions they ask you and any note they add when deciding on your application.",
        "People you worked with: their confirmation of how the work went, references they write about you, Deal Sheet terms they propose, and (if you're the owner) payment reports they make about payments due from you.",
        "Our moderators: the outcome of a payment dispute.",
        "Other members and our moderators: reports about you or your listings, and our decisions on them.",
        ...(billing ? ["Stripe: whether your subscription is active, and its renewal date."] : []),
      ),
      p(
        "Please don't include health details, religious or political beliefs, ethnicity, sexual orientation, trade-union membership or anything about criminal matters in your profile, listings, applications or references. If you put any of this on your profile, other signed-in members will see it.",
      ),
    ),
    section(
      "4. Why we use your data and our lawful basis",
      rows(
        [
          "Create and secure your account; send account emails (confirming your address, resetting your password)",
          "Contract: we need it to provide the service you signed up for",
        ],
        [
          "Show your profile and listings to members; let you browse, post, apply, ask and answer",
          "Contract",
        ],
        [
          "Review listings before they go live",
          "Contract (curation is part of the service in our Terms)",
        ],
        ["Share both people's name and email when an application is accepted", "Contract"],
        [
          "Record collaboration outcomes; show references and track records to members",
          "Contract, and our legitimate interests in helping members judge who to work with",
        ],
        [
          "Record Deal Sheets the two of you propose and confirm; let either of you save a PDF; take payment reports and disputes",
          "Contract: it's a feature of the service you choose to use",
        ],
        [
          "Show owners' payment records (a count of reported payments) to signed-in members, and decide disputes",
          "Legitimate interests: helping professionals choose owners who pay as agreed, and keeping records accurate and fair. We've balanced this against owners' interests: only reports on Deal Sheets the owner confirmed count, disputed reports are excluded until a person decides, and only a count is shown",
        ],
        [
          "Show owners' reply records and members' availability dates",
          "Legitimate interests: helping professionals choose responsive owners and keeping availability accurate",
        ],
        [
          "Keep DirectWork safe: daily limits, blocking contact details in text before acceptance, reports, blocks, moderation, fraud and abuse prevention, security logs",
          "Legitimate interests in safety, security and fraud prevention. Reports that allege a crime (for example a scam) are handled with the extra protections the Data Protection Act 2018 requires for that kind of information, set out in our appropriate policy document",
        ],
        [
          "Keep a record that you accepted our Terms and confirmed you're 18 or over",
          "Legitimate interests in being able to show what was agreed, and legal obligation",
        ],
        ...(billing
          ? ([
              [
                "Pro subscriptions",
                "Contract. We keep billing records because the law requires it (legal obligation)",
              ],
            ] as [string, string][])
          : []),
        [
          "Respond to your requests and complaints; meet our legal duties, including preserving and reporting information when the law requires it",
          "Legal obligation",
        ],
        [
          "Backups and fixing faults",
          "Legitimate interests in keeping the service reliable and secure",
        ],
      ),
      p(
        "You must give an email address and password to have an account, and a name, headline, at least one skill and a reason for joining to create a profile. Without them we can't provide the service. Everything else is optional. We don't rely on your consent for anything, and we don't send marketing emails.",
      ),
    ),
    section(
      "5. Who can see what on DirectWork",
      p("Anyone signed in can see:"),
      list(
        "your whole profile, including when you last confirmed your availability and when you last updated it;",
        "your skills and portfolio;",
        "references written about you, with the author's name and photo;",
        "your track record (how many different people you've completed work with, as confirmed by both sides);",
        "your published listings and, if you post work, your reply record;",
        "if you're an owner with at least 3 counting payment reports, your payment record: how many reported payments were paid on time, out of how many, reported by professionals.",
      ),
      p(
        "A Deal Sheet, and the individual payment reports and disputes on it, are seen only by the two people in that collaboration. Moderators see them only when handling a dispute or a complaint.",
      ),
      p(
        "Anyone who has an image link, signed in or not, can open profile photos, portfolio images and listing images. Links contain long random codes and your account ID, so they can't be guessed, but anyone a link is passed to can open it.",
      ),
      p(
        "The owner of a listing you apply to sees your application, your work samples (through links that expire after an hour), your answers and the application's status. If you withdraw an application, the owner can still see it, marked as withdrawn.",
      ),
      p(
        "Your email address is shown only to the other person, once an application between you is accepted. They may keep a copy of it, for example in their own email, which we can't recall.",
      ),
      p(
        "DirectWork moderators see listings under review, reports, and what they need to act on them. Moderators don't read applications. We never tell a reported person who reported them, and blocks are private.",
      ),
    ),
    section(
      "6. Who we share it with",
      p('Service providers acting on our instructions ("processors"):'),
      list(
        "Supabase: database, sign-in, file storage and server hosting.",
        "Amazon Web Services (Amazon SES, London region): sending account emails.",
        "Cloudflare: hosting and delivering our website.",
        "Expo: building our apps and delivering app updates. When the app checks for an update, Expo receives technical information such as your IP address, device type and app version.",
      ),
      p("Other recipients:"),
      list(
        "Apple and Google run the app stores you download our apps from. They handle your store account and downloads under their own privacy policies.",
        ...(billing
          ? [
              "Stripe processes payments for us. For fraud prevention and its own legal duties (such as anti-money-laundering checks) Stripe is an independent controller under its own privacy policy: stripe.com/privacy.",
            ]
          : []),
        "Other members, as Section 5 describes.",
        "Authorities, courts or professional advisers, where the law requires it (for example reporting child sexual abuse material to the National Crime Agency), to prevent or detect crime, to protect someone's safety, or to establish or defend legal claims.",
        "A buyer or successor, if the business is sold or reorganised, who must keep to this notice.",
      ),
    ),
    section(
      "7. Profiling and automatic rules",
      p(
        "We don't make decisions about you based solely on automated processing that have legal or similarly significant effects. Owners decide on applications themselves, and people review listings and reports.",
      ),
      p("Members can see a few signals we calculate automatically:"),
      list(
        "Reply record (owners): how many applications you received and replied to in the last 180 days, and your typical reply time. Withdrawn applications, ones under 7 days old, and ones declined automatically when a listing closed don't count against you.",
        "Track record: the number of different people you've completed work with, where both of you confirmed it was completed.",
        "Payment record (owners): the number of payments professionals reported as paid on time, out of the reports that count. A report counts only if it's on an agreed Deal Sheet, isn't under dispute or upheld, and the professional's account was at least 14 days old when the Deal Sheet was agreed. It's shown only once at least 3 reports count. It isn't a credit reference: we don't sell it, share it outside DirectWork or use it to make decisions about you.",
        "Availability: if you're open to work and haven't confirmed it for 30 days, your profile says so and you're left out of \"available\" counts.",
      ),
      p('"Best match" ordering is worked out on your device from your own skills.'),
      p("Some automatic rules apply to everyone:"),
      list(
        "at most 20 applications, 10 reports and 50 new skills a day;",
        "emails, phone numbers and links are blocked in text before both people agree to work together;",
        "pending applications are declined when an owner closes their listing;",
        "work can be marked completed only after 7 days.",
      ),
      p("You can object to these signals (Section 11)."),
    ),
    section(
      "8. Transfers outside the UK",
      list(
        "Supabase keeps our database, files and backups in Ireland (EU), which UK law treats as adequate. Its logs are stored in EU data centres, and images may be delivered through a worldwide content delivery network. Supabase's contracting company is in Singapore and some support staff are in the US. Those transfers are protected by the UK International Data Transfer Addendum to the EU Standard Contractual Clauses.",
        'Amazon SES sends our emails from its London region. Amazon Web Services, Cloudflare and Expo are US companies, and Cloudflare delivers our website through a worldwide network. Where data reaches the US, it\'s protected by the UK Extension to the EU-US Data Privacy Framework (the "UK-US data bridge") or by Standard Contractual Clauses with the UK Addendum.',
        ...(billing
          ? [
              "Stripe's US parent is certified to the UK Extension to the EU-US Data Privacy Framework.",
            ]
          : []),
      ),
      p("Contact us for a copy of the safeguards."),
    ),
    section(
      "9. How long we keep your data",
      rows(
        [
          "Account and profile",
          "Until you delete your account. Photos and images you remove are deleted straight away.",
        ],
        ["Listings", "Until you delete them or your account. You can delete drafts at any time."],
        [
          "Declined and withdrawn applications",
          "12 months after the application last changed, then deleted with their work samples, questions and answers.",
        ],
        [
          "Accepted applications, collaborations, outcomes and references",
          "While both people have accounts. If either of you deletes your account, the collaboration, its outcome and the references between you are deleted, so they disappear from the other person's profile too.",
        ],
        [
          "Deal Sheets, payment reports and disputes",
          "While both people have accounts, with the collaboration. If either of you deletes your account, they are deleted, and drop out of the owner's payment record. A report removed after an upheld dispute is deleted.",
        ],
        [
          "Activity notifications",
          "Read notifications for 180 days; any notification for at most 365 days.",
        ],
        [
          "Reports",
          "Open reports until they're resolved. Then 3 years if we acted on the report, or 12 months if we dismissed it. If the reporter or the reported person deletes their account, the report is kept without the link to that account.",
        ],
        [
          "Record of the Terms and Privacy versions you accepted, and your 18+ confirmation",
          "While you have an account.",
        ],
        ...(billing
          ? ([
              [
                "Billing records",
                "6 years after the end of the financial year of the payment (tax and accounting law), kept by Stripe and us.",
              ],
            ] as [string, string][])
          : []),
        ["Security logs", "Up to 7 days."],
        ["Backups", "Up to 7 days, after which deleted data is gone from backups too."],
        ["Requests and complaints you send us", "2 years after we close them."],
      ),
      p(
        "If the law requires us to preserve information, for example to report child sexual abuse material to the National Crime Agency, we keep it for as long as the law requires, even if you ask us to delete it.",
      ),
    ),
    section(
      "10. When you delete your account",
      p(
        `We delete your profile, photos and files, listings, applications, collaborations, Deal Sheets, payment reports, references and blocks${billing ? ", and your Stripe customer record (which cancels any subscription)" : ""}. Reports you made, and reports about you, are kept without the link to your account, for the periods in Section 9. We keep only what that table says we must or may keep.`,
      ),
      p("Some copies outlast deletion for a short time:"),
      list(
        "logs for up to 7 days;",
        "backups for up to 7 days;",
        "images in delivery caches for up to an hour.",
      ),
    ),
    section(
      "11. Your rights",
      p("You have the right to:"),
      list(
        "access your data and get a copy;",
        "correct it;",
        "delete it;",
        "restrict how we use it;",
        "object to processing based on legitimate interests, including the signals in Section 7 and your payment record;",
        "move data you gave us to another service, in a machine-readable format.",
      ),
      p("How to use them:"),
      list(
        "In the app: edit your profile; download a copy of your data from Profile, then Help & legal, then Download my data; or delete your account from Profile, then Delete account.",
        `Otherwise, including to change your email address: email ${operator.privacyEmail}.`,
      ),
      p("How we respond:"),
      list(
        "We reply within one month. If a request is complex, or you've sent several, we can take up to two more months and will tell you why within the first month.",
        "If we need to check your identity, the month starts once we can. If we need you to clarify what you're asking for, the clock pauses until you reply.",
        "We search for your information in ways that are reasonable and proportionate.",
        "It's free. We may refuse or charge for requests that are manifestly unfounded or excessive.",
        "Some rights have limits. For example, we keep records the law requires, and we won't reveal who reported you.",
        "If a payment report about you is inaccurate, dispute it from the Deal Sheet within 14 days, or email us at any time. Disputing is also how you ask us to correct it.",
      ),
    ),
    section(
      "12. Complaints",
      p(
        `If you're unhappy with how we've handled your data, tell us first at ${operator.privacyEmail}. We'll acknowledge your complaint within 30 days, look into it, keep you updated and tell you the outcome without undue delay.`,
      ),
      p(
        "You can also complain to the Information Commissioner's Office: ico.org.uk/make-a-complaint, 0303 123 1113, Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF.",
      ),
    ),
    section(
      "13. What we store on your device",
      p(
        "We store only what's strictly necessary to keep you signed in, so we don't ask for consent. DirectWork sets no cookies of its own and uses no analytics or advertising trackers. Our Cookies & Storage notice has the details.",
      ),
    ),
    section(
      "14. Age",
      p(
        "DirectWork is only for people aged 18 or over. You confirm this when you sign up. If we learn an account belongs to someone under 18, we'll close it and delete its data.",
      ),
    ),
    section(
      "15. Keeping your data safe",
      p(
        "Data is encrypted in transit. Access is restricted by user, role and record, so members can see only what this notice describes. Sensitive actions are checked on our servers. We limit what staff can access and keep processes for handling security incidents, including telling the ICO and affected people where the law requires.",
      ),
    ),
    section(
      "16. Changes to this notice",
      p(
        "We'll post updates here with a new date, and ask you to read significant changes in the app before you carry on.",
      ),
    ),
  ],
};
