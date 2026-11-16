// OURS: what goes on a post's graphic. A small set of fixed layouts, sized for
// each platform, coloured with the business's own brand colour. Every word on
// a graphic is either a fixed label ("Our services") or a fact from the
// business profile, copied as it is: graphics never say anything the profile
// doesn't.
import { CaptionPlatform } from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import {
  ProfileFieldKey,
  ProfileFields,
} from '@gitroom/nestjs-libraries/ours/profile/business.profile.fields';

// Feed image sizes. Instagram and Facebook show 4:5 portrait images largest in
// the mobile feed; LinkedIn's feed is safest with a square.
export const GRAPHIC_SIZES: Record<CaptionPlatform, { width: number; height: number }> = {
  instagram: { width: 1080, height: 1350 },
  facebook: { width: 1080, height: 1350 },
  linkedin: { width: 1200, height: 1200 },
};

export const GRAPHIC_LAYOUTS = [
  { key: 'statement', label: 'Statement' },
  { key: 'card', label: 'Card' },
  { key: 'details', label: 'Contact details' },
  { key: 'name', label: 'Name and logo' },
] as const;

export type GraphicLayout = (typeof GRAPHIC_LAYOUTS)[number]['key'];
// stored on a caption when the owner wants no graphic at all
export const NO_GRAPHIC = 'none';

export const isGraphicLayout = (key: string): key is GraphicLayout =>
  GRAPHIC_LAYOUTS.some((l) => l.key === key);

// A neutral slate until the owner picks their own colour. Never our product's
// brand colour: the graphic belongs to their business.
export const DEFAULT_BRAND_COLOUR = '#2F3B45';
export const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

// Long facts don't fit a graphic, and cutting one short could change what it
// says, so a fact that is too long is never used.
export const MAX_HEADLINE_LENGTH = 110;
const MAX_DETAIL_LENGTH = 80;

export interface GraphicFact {
  field: string;
  value: string;
}

export interface GraphicContent {
  layout: GraphicLayout;
  businessName: string;
  label: string | null;
  headline: string | null;
  details: { label: string; value: string }[];
}

const HEADLINE_FIELDS: ProfileFieldKey[] = ['services', 'highlights', 'whatTheyDo'];
const HEADLINE_LABELS: Partial<Record<ProfileFieldKey, string>> = {
  services: 'Our services',
  highlights: 'About us',
  whatTheyDo: 'About us',
};
const DETAIL_FIELDS: { field: ProfileFieldKey; label: string }[] = [
  { field: 'address', label: 'Visit' },
  { field: 'location', label: 'Where' },
  { field: 'openingHours', label: 'Open' },
  { field: 'phone', label: 'Call' },
  { field: 'email', label: 'Email' },
];
// a contact card with fewer rows than this looks empty
const MIN_DETAILS = 2;
const MAX_DETAILS = 3;

const first = (fields: ProfileFields, key: ProfileFieldKey) =>
  fields[key]?.claims?.[0]?.value?.trim() || '';

const fits = (value: string, max: number) =>
  !!value && value.length <= max;

// The caption's own facts first (so the graphic matches the words), then
// what the business does.
const pickHeadline = (facts: GraphicFact[], fields: ProfileFields) => {
  for (const field of HEADLINE_FIELDS) {
    const fact = facts.find(
      (f) => f.field === field && fits(f.value.trim(), MAX_HEADLINE_LENGTH)
    );
    if (fact) {
      return { label: HEADLINE_LABELS[field]!, headline: fact.value.trim() };
    }
  }
  const whatTheyDo = first(fields, 'whatTheyDo');
  if (fits(whatTheyDo, MAX_HEADLINE_LENGTH)) {
    return { label: 'About us', headline: whatTheyDo };
  }
  return null;
};

// The full address when there is one, otherwise the town; then hours and
// ways to get in touch.
const contactDetails = (fields: ProfileFields) => {
  const rows = DETAIL_FIELDS.map((d) => ({ field: d.field, label: d.label, value: first(fields, d.field) })).filter(
    (d) => fits(d.value, MAX_DETAIL_LENGTH)
  );
  const hasAddress = rows.some((r) => r.field === 'address');
  return rows
    .filter((r) => !(hasAddress && r.field === 'location'))
    .slice(0, MAX_DETAILS)
    .map(({ label, value }) => ({ label, value }));
};

// One layout a day, the same on every platform, so a day's posts match.
const ROTATION: GraphicLayout[] = ['statement', 'card', 'details', 'name', 'card'];

export const automaticLayout = (dayIndex: number): GraphicLayout =>
  ROTATION[((dayIndex % ROTATION.length) + ROTATION.length) % ROTATION.length];

// What the graphic says, or null when the profile has too little for it (no
// business name). A layout without what it needs falls back to one that has
// it, rather than showing empty boxes.
export const graphicContent = (
  wanted: GraphicLayout,
  facts: GraphicFact[],
  fields: ProfileFields
): GraphicContent | null => {
  const businessName = first(fields, 'businessName');
  if (!fits(businessName, MAX_DETAIL_LENGTH)) {
    return null;
  }
  const headline = pickHeadline(facts, fields);
  const details = contactDetails(fields);

  let layout = wanted;
  if (layout === 'details' && details.length < MIN_DETAILS) layout = 'card';
  if ((layout === 'statement' || layout === 'card') && !headline) layout = 'name';

  return {
    layout,
    businessName,
    label: layout === 'details' ? 'Find us' : headline?.label || null,
    headline: layout === 'details' ? null : headline?.headline || null,
    details: layout === 'details' ? details : [],
  };
};

// Readable text on a background: white or near-black, whichever contrasts
// more (WCAG relative luminance). All graphic text is large (24px and up), so
// this always meets WCAG AA for large text (3:1), and 4.5:1 for most colours.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrastRatio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

export const DARK_TEXT = '#14181C';
export const LIGHT_TEXT = '#FFFFFF';
export const PAPER = '#F6F4EF';

export const textColourOn = (background: string) =>
  contrastRatio(background, LIGHT_TEXT) >= contrastRatio(background, DARK_TEXT)
    ? LIGHT_TEXT
    : DARK_TEXT;

// The brand colour as text on paper, if it is readable there; otherwise dark.
export const accentOnPaper = (brand: string) =>
  contrastRatio(brand, PAPER) >= 4.5 ? brand : DARK_TEXT;
