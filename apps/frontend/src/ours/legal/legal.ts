// OURS: the facts our legal pages print about the company behind the service.
// Every value can be overridden with an environment variable, like the brand.
// An empty value is shown on the page as a visible [FILL IN] marker, never
// guessed. See ours/README.md ("Legal pages").
import defaults from './legal.defaults.json';

export type LegalFacts = {
  companyName: string;
  companyNumber: string;
  registeredAddress: string;
  icoNumber: string;
  contactEmail: string;
  jurisdiction: string;
  lastUpdated: string;
  effectiveDate: string;
  // The pages are published and in force. While false, a "Draft" notice shows.
  inForce: boolean;
  // A solicitor has reviewed the pages. A record only; nothing on the pages
  // depends on it.
  reviewed: boolean;
};

export const legalFacts = (
  env: Record<string, string | undefined> = process.env
): LegalFacts => ({
  companyName: env.NEXT_PUBLIC_LEGAL_COMPANY_NAME || defaults.companyName,
  companyNumber: env.NEXT_PUBLIC_LEGAL_COMPANY_NUMBER || defaults.companyNumber,
  registeredAddress:
    env.NEXT_PUBLIC_LEGAL_REGISTERED_ADDRESS || defaults.registeredAddress,
  icoNumber: env.NEXT_PUBLIC_LEGAL_ICO_NUMBER || defaults.icoNumber,
  contactEmail: env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL || defaults.contactEmail,
  jurisdiction: env.NEXT_PUBLIC_LEGAL_JURISDICTION || defaults.jurisdiction,
  lastUpdated: env.NEXT_PUBLIC_LEGAL_LAST_UPDATED || defaults.lastUpdated,
  effectiveDate:
    env.NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE || defaults.effectiveDate,
  inForce:
    (env.NEXT_PUBLIC_LEGAL_IN_FORCE || String(defaults.inForce)) === 'true',
  reviewed:
    (env.NEXT_PUBLIC_LEGAL_REVIEWED || String(defaults.reviewed)) === 'true',
});

// The values a published page must not go out without. The ICO registration
// number is optional: the privacy policy only mentions it once it is set.
const REQUIRED: Array<keyof LegalFacts> = [
  'companyName',
  'companyNumber',
  'registeredAddress',
  'contactEmail',
  'jurisdiction',
  'lastUpdated',
  'effectiveDate',
];

export const missingFacts = (facts: LegalFacts) =>
  REQUIRED.filter((key) => !facts[key]);

// Where the pages live. Top-level paths ending in .html are skipped by the
// frontend proxy, so signed-in and signed-out visitors (and Meta's crawler)
// all reach them without an upstream change.
export const legalPaths = {
  about: '/about.html',
  privacy: '/privacy.html',
  terms: '/terms.html',
  dataDeletion: '/data-deletion.html',
};
