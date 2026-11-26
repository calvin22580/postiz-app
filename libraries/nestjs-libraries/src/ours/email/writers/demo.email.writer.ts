// OURS: a deterministic stand-in for the AI email writer (email campaigns
// EM3), used when no ANTHROPIC_API_KEY is set (local development, tests,
// demos). Like the demo caption writer, it fills fixed templates with values
// from the business profile and adds no facts of its own, so its emails pass
// the same checks. Emails written with it are labelled as demos in the app.
import { CaptionFact, isSeasonalFact } from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import { CaptionWriterError } from '@gitroom/nestjs-libraries/ours/captions/writers/caption.writer';
import {
  EmailRewriteInput,
  EmailWriter,
  EmailWriterInput,
  EmailWriterOutput,
  RawEmail,
} from '@gitroom/nestjs-libraries/ours/email/writers/email.writer';

const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

// The versions this profile can fill, in a fixed order.
export const demoEmails = (facts: CaptionFact[]): RawEmail[] => {
  const profile = facts.filter((f) => !isSeasonalFact(f));
  const all = (field: string) => profile.filter((f) => f.field === field);
  const one = (field: string) => all(field)[0];
  const name = one('businessName');
  const about = one('whatTheyDo') || one('services');
  if (!name || !about) {
    return [];
  }
  const services = all('services').slice(0, 3);
  const place = one('location') || one('serviceArea');
  const highlight = one('highlights');
  const hours = one('openingHours');
  const phone = one('phone');
  const ids = (...used: (CaptionFact | undefined)[]) =>
    used.filter((f): f is CaptionFact => !!f).map((f) => f.id);
  // a gentle next step, only with contact details the profile has
  const nextStep = phone
    ? `If you have a question, just reply to this email or call us on ${phone.value}.`
    : 'If you have a question, just reply to this email.';
  const signOff = `Warm wishes,\n${name.value}`;

  const emails: RawEmail[] = [
    {
      subject: `A quick hello from ${name.value}`,
      previewText: `What we’ve been up to, and how we can help.`,
      body: [
        'Hello,',
        `Thank you for being part of the ${name.value} community. We wanted to drop you a short note to say hello.`,
        `A little about us, for anyone new. ${sentence(about.value)}${place ? ` You’ll find us in ${sentence(place.value)}` : ''}`,
        nextStep,
        signOff,
      ].join('\n\n'),
      factIds: ids(name, about, place, phone),
    },
  ];
  if (services.length) {
    emails.push({
      subject: `How ${name.value} can help`,
      previewText: `A reminder of what we do for our customers.`,
      body: [
        'Hello,',
        `We thought it might be useful to share a reminder of what we can help with at ${name.value}.`,
        services.map((s) => `- ${s.value.trim()}`).join('\n'),
        highlight ? sentence(highlight.value) : `${sentence(about.value)}`,
        nextStep,
        signOff,
      ].join('\n\n'),
      factIds: ids(name, ...services, highlight || about, phone),
    });
  }
  if (hours || highlight) {
    emails.push({
      subject: `News from ${name.value}`,
      previewText: hours ? `When you can find us, and a little about what we do.` : `A little about what we do.`,
      body: [
        'Hello,',
        `A short update from all of us at ${name.value}.`,
        sentence(about.value),
        ...(highlight ? [sentence(highlight.value)] : []),
        ...(hours ? [`Our opening hours: ${sentence(hours.value)}`] : []),
        nextStep,
        signOff,
      ].join('\n\n'),
      factIds: ids(name, about, highlight, hours, phone),
    });
  }
  return emails;
};

export class DemoEmailWriter implements EmailWriter {
  readonly name = 'demo' as const;

  async write(input: EmailWriterInput): Promise<EmailWriterOutput> {
    const emails = demoEmails(input.facts);
    if (!emails.length) {
      throw new CaptionWriterError('Add your business name and what you do to your profile first.');
    }
    // a different version each week, while there are versions to choose from
    const fresh = emails.filter((e) => !input.recentSubjects.includes(e.subject || ''));
    return { raw: (fresh.length ? fresh : emails)[0], usages: [] };
  }

  async rewrite(input: EmailRewriteInput): Promise<EmailWriterOutput> {
    const others = demoEmails(input.facts).filter((e) => e.body?.trim() !== input.current.body.trim());
    if (!others.length) {
      throw new CaptionWriterError(
        'Demo mode has no other version of this email. Edit it yourself, or connect the AI service.'
      );
    }
    return { raw: others[input.attempt % others.length], usages: [] };
  }
}
