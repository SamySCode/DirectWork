import { operator } from "../operator";
import { LEGAL_UPDATED, TERMS_VERSION } from "../versions";
import { list, p, section, type LegalDocument } from "./types";

// Part of the Terms of Service, so it shares TERMS_VERSION.
export const guidelines: LegalDocument = {
  slug: "community-guidelines",
  title: "Community & Listing Guidelines",
  summary: "What's allowed on DirectWork, what isn't, and how to report a problem.",
  version: TERMS_VERSION,
  updated: LEGAL_UPDATED,
  intro: [
    "DirectWork works when people can trust what they read. These guidelines are part of our Terms of Service and apply to profiles, listings, questions, answers, applications, images, references, Deal Sheets and payment reports.",
  ],
  sections: [
    section(
      "Never allowed",
      list(
        'Scams, fraud and fake jobs, including "payment processing", "reshipping" or money-transfer roles.',
        'Asking professionals for money: fees to apply, "admin fees", deposits, training, equipment or buy-ins. DirectWork never asks for money, and nobody else may either.',
        "Exploitation, forced labour or trafficking, or work that breaks immigration law, such as selling visa sponsorship.",
        "Sexual services, or sexual or violent images.",
        "Anything that sexualises children. We report it to the National Crime Agency.",
        "Weapons, drugs or other illegal goods or services, and content supporting terrorism.",
        "Threats, harassment, hate or bullying.",
        "Sharing intimate images of anyone without their consent.",
        "Impersonating a person or business, or misleading people about who you are.",
        "Infringing someone's copyright, trade mark or other rights.",
        "Spam, or advertising unrelated products.",
      ),
    ),
    section(
      "Listings",
      p("Every listing must describe real work, honestly. Say:"),
      list(
        "what the work is and what you need;",
        "where it happens and the commitment (hours, and whether it's a one-off, ongoing or a set length);",
        "the pay, or for a partnership the terms on offer.",
      ),
      p("Listings must not:"),
      list(
        'discriminate. Don\'t state or imply preferences about age (for example "young" or "digital native"), sex, race, religion or belief, disability, sexual orientation, gender reassignment, marriage or civil partnership, or pregnancy or maternity;',
        "ask about health or disability before an offer is made;",
        "pay a worker or employee less than the National Minimum Wage;",
        'dress up a job as a "partnership" or offer only equity for what is really a job. A partnership means genuine shared ownership and say in the venture;',
        "ask anyone to invest money, or promise financial returns;",
        "include emails, phone numbers or links. Contact details are shared automatically once you both accept.",
      ),
    ),
    section(
      "Questions, answers and applications",
      list(
        "Keep questions about the work. Don't ask about health, family plans, religion or anything else covered by equality law.",
        "Don't ask for, or include, contact details or payment.",
        "Applicants: show only your own work, or work you have permission to share.",
      ),
    ),
    section(
      "References",
      list(
        "Write only about work you actually did together, honestly.",
        "Don't offer, ask for or accept anything in return for a reference, and don't swap references.",
        "Keep personal details out, including health and contact details.",
      ),
    ),
    section(
      "Deal Sheets and payment reports",
      list(
        "Write Deal Sheet terms you both understand, and confirm only what you've actually agreed.",
        "Report payments honestly: on time, late (with the date you were paid) or not paid yet. Report what happened, not how you feel about it.",
        "Correct a report straight away if you got it wrong. Don't report payments that weren't due under the Deal Sheet.",
        "Never use a payment report to pressure, punish or harass someone, and never offer or accept anything to make, change or withdraw one.",
        "Owners: dispute a report only if it's wrong, and say why.",
        "Keep contact details, bank details and personal information out of Deal Sheets and disputes.",
      ),
    ),
    section(
      "How to report something",
      list(
        "Use Report on the profile or listing. Choose the reason that fits best and add any details that will help us.",
        `For anything you can't report in the app (such as a reference, a question or an application), or if you don't have an account, email ${operator.supportEmail}.`,
        "If someone is in immediate danger, call 999.",
        "If you've lost money to a scam, report it to Action Fraud (0300 123 2040) in England, Wales and Northern Ireland, or to Police Scotland on 101.",
      ),
      p(
        "We never tell the person you reported who reported them. When we find a breach we may remove content, ask for changes, decline a listing, or suspend or close an account. If we act on your content, we'll tell you why and how to appeal.",
      ),
    ),
  ],
};
