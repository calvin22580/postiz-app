// OURS: a deterministic stand-in for the AI, used when no ANTHROPIC_API_KEY is
// set (local development, tests, demos). It fills fixed templates with values
// from the business profile and adds no facts of its own, so its captions pass
// the same checks. Weeks written with it are labelled as demos in the app.
import { CaptionFact } from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import {
  CaptionWriter,
  CaptionWriterInput,
  CaptionWriterOutput,
  RawCaptionPlan,
} from '@gitroom/nestjs-libraries/ours/captions/writers/caption.writer';

type Captions = { facebook: string; instagram: string; linkedin: string };
interface Idea {
  theme: string;
  facts: CaptionFact[];
  captions: Captions;
}

const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const hashtag = (s: string) =>
  `#${s.replace(/&/g, 'and').replace(/[^A-Za-z]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toUpperCase())}`;

export class DemoCaptionWriter implements CaptionWriter {
  readonly name = 'demo' as const;

  async write(input: CaptionWriterInput): Promise<CaptionWriterOutput> {
    const all = (field: string) => input.facts.filter((f) => f.field === field);
    const one = (field: string) => all(field)[0];
    const name = one('businessName');
    const tag = name ? hashtag(name.value) : '';

    const ideas: Idea[] = [];
    const intro = one('whatTheyDo');
    if (name && intro) {
      ideas.push({
        theme: 'Introducing the business',
        facts: [name, intro],
        captions: {
          facebook: `Hello from ${name.value}! ${sentence(intro.value)} If you have any questions, just send us a message.`,
          instagram: `${sentence(intro.value)}\n\nSay hello in the comments, we would love to hear from you.\n\n${tag}`,
          linkedin: `A quick introduction to ${name.value}. ${sentence(intro.value)} We are always happy to talk to new customers and local businesses.`,
        },
      });
    }

    for (const service of all('services')) {
      if (!name) break;
      ideas.push({
        theme: `Spotlight: ${service.value}`,
        facts: [name, service],
        captions: {
          facebook: `In the spotlight this week at ${name.value}: ${service.value}. Get in touch to find out more.`,
          instagram: `Spotlight on ${service.value}.\n\nAsk us anything about it in the comments or by message.\n\n${tag}`,
          linkedin: `Something you can come to ${name.value} for: ${service.value}. If this could help you or your business, we would be glad to hear from you.`,
        },
      });
    }

    for (const highlight of all('highlights')) {
      if (!name) break;
      ideas.push({
        theme: 'What sets us apart',
        facts: [name, highlight],
        captions: {
          facebook: `Something we are proud of at ${name.value}: ${sentence(highlight.value)}`,
          instagram: `${sentence(highlight.value)}\n\nThanks for supporting ${name.value}.\n\n${tag}`,
          linkedin: `A little about ${name.value}: ${sentence(highlight.value)}`,
        },
      });
    }

    const where = one('location') || one('serviceArea');
    if (name && where) {
      ideas.push({
        theme: 'Where to find us',
        facts: [name, where],
        captions: {
          facebook: `${name.value} is here for you in ${where.value}. Pop in or get in touch.`,
          instagram: `Local and proud: ${name.value}, ${where.value}.\n\n${tag}`,
          linkedin: `${name.value} works with customers in ${where.value}. Get in touch if you are nearby.`,
        },
      });
    }

    const contact = [one('phone'), one('email'), one('openingHours')].filter(
      (f): f is CaptionFact => !!f
    );
    if (name && contact.length) {
      const lines = contact
        .map((f) =>
          f.field === 'phone'
            ? `Call us on ${f.value}`
            : f.field === 'email'
            ? `Email ${f.value}`
            : sentence(f.value)
        )
        .join('\n');
      ideas.push({
        theme: 'How to get in touch',
        facts: [name, ...contact],
        captions: {
          facebook: `Want to get in touch with ${name.value}?\n${lines}`,
          instagram: `Here is how to reach ${name.value}:\n${lines}\n\n${tag}`,
          linkedin: `Planning ahead? Here is how to reach ${name.value}:\n${lines}`,
        },
      });
    }

    // Contact details make a good end to the week; fill the days in order.
    const last = ideas.length > input.days.length ? ideas.pop() : undefined;
    const picked = ideas.slice(0, input.days.length - (last ? 1 : 0));
    if (last) picked.push(last);

    const raw: RawCaptionPlan = {
      posts: picked.map((idea, day) => ({
        day,
        theme: idea.theme,
        captions: (Object.keys(idea.captions) as (keyof Captions)[]).map((platform) => ({
          platform,
          text: idea.captions[platform],
          factIds: idea.facts.map((f) => f.id),
        })),
      })),
    };
    return { raw, usages: [] };
  }
}
