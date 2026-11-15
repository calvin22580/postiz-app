// OURS: the fields of a business profile. Every claim carries the page it
// came from and a quote copied from that page, or is marked as entered by the
// owner. A field with no claims is "not found".

export const PROFILE_FIELDS = [
  {
    key: 'businessName',
    multiple: false,
    hint: 'The name of the business, exactly as the site gives it.',
  },
  {
    key: 'whatTheyDo',
    multiple: false,
    hint: 'One or two plain sentences on what the business does, supported by the quote.',
  },
  {
    key: 'services',
    multiple: true,
    hint: 'Each service or product the site names. One item per service.',
  },
  {
    key: 'location',
    multiple: false,
    hint: 'Where the business is based (town or city, and county if given).',
  },
  {
    key: 'serviceArea',
    multiple: false,
    hint: 'The area the business serves or delivers to, only if the site says so.',
  },
  {
    key: 'audience',
    multiple: false,
    hint: 'Who the customers are, only as the site describes them.',
  },
  {
    key: 'toneOfVoice',
    multiple: false,
    hint: 'How the site writes, in three to six words (for example "warm, friendly and informal"). Quote a sentence that shows it.',
  },
  {
    key: 'highlights',
    multiple: true,
    hint: 'Facts the site states that set the business apart (years trading, awards, accreditations). Only what is written.',
  },
  {
    key: 'phone',
    multiple: false,
    hint: 'The main phone number, exactly as written.',
  },
  {
    key: 'email',
    multiple: false,
    hint: 'The main contact email address.',
  },
  {
    key: 'address',
    multiple: false,
    hint: 'The postal address, exactly as written.',
  },
  {
    key: 'openingHours',
    multiple: false,
    hint: 'Opening hours, as written.',
  },
  {
    key: 'socialLinks',
    multiple: true,
    hint: 'Links to the business’s social media profiles (full URLs).',
  },
] as const;

export type ProfileFieldKey = (typeof PROFILE_FIELDS)[number]['key'];

export const PROFILE_FIELD_KEYS = PROFILE_FIELDS.map(
  (f) => f.key
) as ProfileFieldKey[];

export const isProfileFieldKey = (key: string): key is ProfileFieldKey =>
  (PROFILE_FIELD_KEYS as string[]).includes(key);

export interface ClaimSource {
  url: string;
  quote: string;
}

export interface ProfileClaim {
  value: string;
  origin: 'website' | 'owner';
  sources: ClaimSource[];
}

export interface ProfileField {
  claims: ProfileClaim[];
  ownerEdited?: boolean;
}

export type ProfileFields = Record<ProfileFieldKey, ProfileField>;

// What an extractor returns before grounding: unchecked claims.
export type RawExtraction = Partial<
  Record<string, { value?: string; sources?: { url?: string; quote?: string }[] }[]>
>;

export const emptyFields = (): ProfileFields =>
  PROFILE_FIELD_KEYS.reduce((all, key) => {
    all[key] = { claims: [] };
    return all;
  }, {} as ProfileFields);
