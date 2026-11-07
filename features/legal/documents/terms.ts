import { operator, operatorIdentity } from "../operator";
import { LEGAL_UPDATED, TERMS_VERSION } from "../versions";
import { list, p, section, type LegalDocument } from "./types";

export const terms: LegalDocument = {
  slug: "terms",
  title: "Terms of Service",
  summary:
    "The agreement between you and DirectWork: who can use it, what we do and don't do, and the rules.",
  version: TERMS_VERSION,
  updated: LEGAL_UPDATED,
  sections: [
    section(
      "1. About these terms",
      p(
        `These terms are a contract between you and ${operatorIdentity} ("DirectWork", "we", "us"). They apply whenever you use the DirectWork apps or website. Our Community & Listing Guidelines and References Policy are part of these terms. Our Privacy Notice explains how we use your personal data.`,
      ),
      p("Please read them. If you don't agree, don't use DirectWork."),
    ),
    section(
      "2. Who can use DirectWork",
      list(
        "You must be 18 or over. You confirm this when you sign up.",
        "DirectWork is designed for people and businesses in the UK.",
        "Use one account, in your own name, with accurate details. Don't create an account for someone else or to get around a suspension.",
        "Keep your password safe. You're responsible for what happens on your account unless someone else got in without it being your fault. Tell us straight away if you think your account has been misused.",
      ),
    ),
    section(
      "3. What DirectWork is, and what it isn't",
      p(
        "DirectWork is a place for professionals to find paid projects and partnerships, and for owners to list them. We provide the tools to post listings, apply, and share contact details once both of you agree to work together.",
      ),
      p(
        "Any deal you make is between you and the other member. DirectWork is not a party to it, and is not either side's agent, employer, client or payer. We don't guarantee that any listing will be filled or that any application will succeed.",
      ),
      p(
        "We review listings before they go live. That review checks quality and our rules; it doesn't check that a listing is true or lawful, or that the person behind it is who they say. We don't check members' identity, qualifications or right to work. Do your own checks before you commit, for example looking up a business on Companies House.",
      ),
    ),
    section(
      "4. Fees",
      p(
        "DirectWork is free for professionals. We'll never charge you to find work, to apply, or to be paid. If anyone asks you for money to get work through DirectWork, it's a scam: report it.",
      ),
      p(
        "If we offer paid features for listing owners, we'll show the price and their terms before you pay, and you'll pay only if you choose to.",
      ),
    ),
    section(
      "5. If you post listings",
      p("When you post a listing, you confirm that:"),
      list(
        "the work is real, described accurately, and lawful;",
        "the listing doesn't discriminate, directly or indirectly, on age, disability, gender reassignment, marriage or civil partnership, pregnancy or maternity, race, religion or belief, sex or sexual orientation, and complies with the Equality Act 2010;",
        "you won't ask applicants about their health or disability before offering them work, except where the law allows;",
        "you won't ask applicants for money, for any reason.",
      ),
      p("You are responsible for everything that follows from your listing, including:"),
      list(
        "deciding whether someone is an employee, worker or self-employed, and meeting the obligations that come with it, including IR35 (off-payroll working rules) where it applies;",
        "paying at least the National Minimum Wage to anyone who is a worker or employee;",
        "right-to-work checks, tax, National Insurance, insurance, and health and safety;",
        "looking after applicants' personal data (such as their email address once shared) under data protection law. For that data you are a separate controller, not us.",
      ),
      p(
        "Partnership listings must offer a genuine partnership: shared ownership of, and say in, a venture. They must not be a way to get work done without paying for it. Partnership offers must never ask anyone to invest money or promise financial returns.",
      ),
    ),
    section(
      "6. If you apply for work",
      list(
        "Be honest about your skills and experience. Portfolio images and work samples must be your own work, or work you have permission to show.",
        'Never pay anyone to get work, for "admin fees", training, equipment or deposits.',
        "Agree pay, equity, intellectual property and what's expected in writing before you start.",
      ),
    ),
    section(
      "7. Contact details and working together",
      p(
        "Don't put emails, phone numbers or links in profiles, listings, questions, answers or applications. When an owner accepts an application, both of you see each other's name and email address. What happens after that is between you, but our Guidelines still apply to anything that started on DirectWork.",
      ),
    ),
    section(
      "8. Your content",
      p(
        "You keep ownership of what you post: your profile, images, listings, applications and references. You give us a non-exclusive, royalty-free, worldwide licence to host, store, copy, display and format that content (for example resizing images) so we can run DirectWork and show it to the people described in our Privacy Notice. The licence ends when you delete the content or your account, except for content others have already received (such as applications sent to an owner, until they're deleted), backups that roll off within 7 days, and anonymised reports we keep for safety.",
      ),
      p(
        "You confirm that you have the right to post your content, and that it doesn't infringe anyone's copyright, trade mark or other rights or break the law.",
      ),
    ),
    section(
      "9. Rules",
      p(
        "Follow our Community & Listing Guidelines. In particular, don't post anything illegal, misleading, discriminatory, abusive or that asks for money. Also don't:",
      ),
      list(
        "scrape, copy or collect data from DirectWork by automated means, or use bots;",
        "try to get around our limits, safety features or reviews, or access accounts or data that aren't yours;",
        "interfere with how DirectWork works, or reverse engineer it, except where the law allows;",
        "use DirectWork to send spam or advertise unrelated products.",
      ),
    ),
    section(
      "10. How we keep DirectWork safe",
      p(
        "Anyone can report a profile or listing from the Report option on it, or by emailing us. We review reports and listings and, where something breaks the law or these terms, we may remove or hide content, ask for changes, decline a listing, restrict features, or suspend or close an account. We act quickly on illegal content once we know about it, and we report it to the authorities where the law requires, for example child sexual abuse material to the National Crime Agency.",
      ),
      p(
        "When we act on your content or account, we'll tell you what we did and why, unless the law or someone's safety prevents it, and you can appeal under our Complaints & Appeals procedure. Our decisions are made by people, not automatically.",
      ),
    ),
    section(
      "11. References and track records",
      p(
        "References can be written only after both people confirm a collaboration was completed. \"Confirmed by both sides\" means both of you said the work was completed; it doesn't mean we checked the work or the reference. References can't be bought, swapped or edited. Our References Policy has the details.",
      ),
    ),
    section(
      "12. Ending your account",
      p(
        "You can delete your account at any time in the app (Profile, then Delete account). We may suspend or close your account if you seriously or repeatedly break these terms, if we must for legal reasons, or to protect other members. Where it's reasonable, we'll warn you first and give you our reasons. If you think we got it wrong, you can appeal.",
      ),
    ),
    section(
      "13. Our responsibility to you",
      list(
        "We provide DirectWork with reasonable care and skill. We'll try to keep it running, but we can't promise it will always be available or free of faults.",
        "We're not responsible for what other members say or do, for the work you agree with them, or for whether you're paid. Those are between you and the other member.",
        "We're not responsible for losses we couldn't reasonably have foreseen, or for losses caused by events outside our control.",
        "If you use DirectWork for business, we're not responsible for loss of profit, business, contracts or opportunity.",
        "Nothing in these terms limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else the law doesn't allow us to limit. Nothing affects your legal rights as a consumer.",
      ),
    ),
    section(
      "14. Changes",
      p(
        "We may change DirectWork and these terms, for example to add features, reflect changes in the law, or improve safety. If we make a significant change to these terms, we'll tell you in the app before it takes effect and ask you to accept the new version. If you don't agree, you can delete your account.",
      ),
    ),
    section(
      "15. Law and disputes",
      p(
        `These terms are governed by the law of ${operator.governingLaw}. If you have a problem, please use our Complaints & Appeals procedure first. Disputes go to the courts of ${operator.governingLaw}, but if you live in Scotland or Northern Ireland you can also bring proceedings in your home courts.`,
      ),
    ),
    section(
      "16. Contact",
      p(
        `Questions about these terms: ${operator.supportEmail}. Complaints and appeals: ${operator.complaintsEmail}. Post: ${operator.address}.`,
      ),
    ),
  ],
};
