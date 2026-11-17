import details from "./operator.json";

/**
 * Who runs DirectWork. Every legal document reads these details from
 * operator.json, so they're filled in once. Values in [SQUARE BRACKETS] are
 * placeholders the owner must replace before launch: `npm run check:launch`
 * fails while any remain.
 */
export const operator = details;

export type Operator = typeof details;

const notApplicable = (value: string) => /^not (applicable|registered)$/i.test(value.trim());

/** Company number, or null for a sole trader ("not applicable"). */
export const companyNumber = notApplicable(details.companyNumber) ? null : details.companyNumber;

/** VAT number, or null when not VAT-registered ("not registered"). */
export const vatNumber = notApplicable(details.vatNumber) ? null : details.vatNumber;

/** "Acme Ltd (company number 123), 1 High St" - for the start of documents. */
export const operatorIdentity =
  [details.legalName, companyNumber ? `(company number ${companyNumber})` : null]
    .filter(Boolean)
    .join(" ") + `, ${details.address}`;

export type ContactRoute = {
  key: "support" | "privacy" | "complaints";
  label: string;
  email: string;
  use: string;
};

export const contactRoutes: ContactRoute[] = [
  {
    key: "support",
    label: "Support",
    email: details.supportEmail,
    use: "Questions about your account, listings or applications, and anything that isn't working.",
  },
  {
    key: "privacy",
    label: "Privacy",
    email: details.privacyEmail,
    use: "Your data and your rights: getting a copy, correcting it, deleting it or objecting.",
  },
  {
    key: "complaints",
    label: "Complaints and appeals",
    email: details.complaintsEmail,
    use: "Complaints about content, about a decision we made, or about how we've handled your data.",
  },
];
