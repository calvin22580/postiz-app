// OURS: "never invent facts", for list emails (email campaigns EM3). The
// same hard rules as captions (caption.grounding.ts): whatever the writer
// returns, an email is kept only if it relies on a profile fact and every
// specific detail in it is in the business profile.
import { CaptionFact, isSeasonalFact } from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import { unsupportedDetails, withoutCitedDates } from '@gitroom/nestjs-libraries/ours/captions/caption.grounding';
import { RawEmail } from '@gitroom/nestjs-libraries/ours/email/writers/email.writer';

// The subject, preview line and body are checked together.
export const EMAIL_LIMITS = {
  subject: { min: 5, max: 90 },
  previewText: { min: 0, max: 150 },
  body: { min: 80, max: 4000 },
} as const;

export interface CheckedEmail {
  subject: string;
  previewText: string;
  body: string;
  facts: CaptionFact[];
}

// Plain text as we store it: one blank line between paragraphs at most.
export const cleanEmailText = (s: string) =>
  s.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

// A mail-merge tag ("{first_name}", "[Name]", "*|FNAME|*"): we have no merge
// fields, so it would reach the customer as written.
const PLACEHOLDER = /\{[^}]*\}|\[[^\]]*name[^\]]*\]|\*\|[^|]*\|\*/i;

// Details in an email the facts don't support, with the UK dates the email
// cites taken out first (as for captions).
export const unsupportedEmailDetails = (
  email: Omit<CheckedEmail, 'facts'>,
  facts: CaptionFact[],
  cited: CaptionFact[] = facts.filter(isSeasonalFact)
) =>
  unsupportedDetails(
    withoutCitedDates([email.subject, email.previewText, email.body].join('\n'), cited.filter(isSeasonalFact)),
    facts.filter((f) => !isSeasonalFact(f))
  );

export const groundEmail = (raw: RawEmail, facts: CaptionFact[]) => {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const email = {
    subject: cleanEmailText(String(raw?.subject || '')).replace(/\s+/g, ' '),
    previewText: cleanEmailText(String(raw?.previewText || '')).replace(/\s+/g, ' '),
    body: cleanEmailText(String(raw?.body || '')),
  };
  const used = Array.from(
    new Map(
      (raw?.factIds || [])
        .map((id) => byId.get(String(id)))
        .filter((f): f is CaptionFact => !!f)
        .map((f) => [f.id, f])
    ).values()
  );
  const outside = (key: keyof typeof EMAIL_LIMITS) =>
    email[key].length < EMAIL_LIMITS[key].min || email[key].length > EMAIL_LIMITS[key].max;
  const problems = unsupportedEmailDetails(email, facts, used);
  const reason = outside('subject')
    ? 'subject length'
    : outside('previewText')
    ? 'preview length'
    : outside('body')
    ? 'body length'
    : PLACEHOLDER.test(`${email.subject}\n${email.previewText}\n${email.body}`)
    ? 'placeholder'
    : !used.some((f) => !isSeasonalFact(f))
    ? 'no profile facts'
    : problems.length
    ? `not in profile: ${problems.join(', ')}`
    : '';
  return reason
    ? { email: null, reason }
    : { email: { ...email, facts: used } as CheckedEmail, reason: '' };
};
