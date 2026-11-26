// OURS: blog posts B1. A deterministic stand-in for the AI, used when no
// ANTHROPIC_API_KEY is set (local development, tests, demos). It fills fixed
// templates with values from the business profile (and the owner's news) and
// adds no facts of its own, so its posts pass the same checks. Posts written
// with it are labelled as demos in the app. It has two versions of a post,
// so "rewrite" can offer the other one.
import { CaptionWriterError } from '@gitroom/nestjs-libraries/ours/captions/writers/caption.writer';
import {
  BlogFact,
  BlogRewriteInput,
  BlogWriter,
  BlogWriterInput,
  BlogWriterOutput,
  NEWS_FIELD,
  RawBlogPost,
  RawBlogSection,
} from '@gitroom/nestjs-libraries/ours/blog/writers/blog.writer';

const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

// Search descriptions are kept short; a long fact value is left out rather
// than cut, so nothing is changed from how the profile says it.
const fits = (s: string, max: number) => (s.length <= max ? s : '');

const versionsFrom = (facts: BlogFact[]): RawBlogPost[] => {
  const all = (field: string) => facts.filter((f) => f.field === field);
  const one = (field: string) => all(field)[0];
  const name = one('businessName');
  const about = one('whatTheyDo');
  const services = all('services');
  if (!name || (!about && !services.length)) {
    return [];
  }
  const news = all(NEWS_FIELD);
  const where = one('location') || one('serviceArea');
  const hours = one('openingHours');
  const contact = [one('phone'), one('email'), one('address')].filter((f): f is BlogFact => !!f);
  const highlights = all('highlights');
  const audience = one('audience');

  const used = (list: (BlogFact | undefined)[]) =>
    Array.from(new Set(list.filter((f): f is BlogFact => !!f).map((f) => f.id)));

  const getInTouch: RawBlogSection = {
    heading: 'Get in touch',
    paragraphs: [
      [
        `If you would like to know more, we would be glad to hear from you.`,
        hours ? `Our opening hours are: ${sentence(hours.value)}` : '',
        contact.length ? `You can reach ${name.value} here: ${contact.map((c) => c.value).join(', ')}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
    ],
    bullets: [],
  };

  const aboutPost: RawBlogPost = {
    title: news.length ? `News from ${name.value}` : `Getting to know ${name.value}`,
    description:
      fits(`What's happening at ${name.value}${where ? ` in ${where.value}` : ''}, what we do and how to get in touch.`, 160) ||
      `What's happening at ${name.value}, what we do and how to get in touch with us.`,
    sections: [
      {
        heading: '',
        paragraphs: [
          news.length
            ? `We have some news to share from ${name.value}. ${news.map((n) => sentence(n.value)).join(' ')}`
            : `Welcome to the ${name.value} blog. ${about ? sentence(about.value) : ''}`.trim(),
          `This is where we will share our news and a closer look at what we do, so you know what to expect before you get in touch.`,
        ],
        bullets: [],
      },
      ...(about && news.length
        ? [{ heading: 'Who we are', paragraphs: [sentence(about.value)], bullets: [] }]
        : []),
      ...(services.length
        ? [
            {
              heading: 'What we do',
              paragraphs: [
                `Here is what ${name.value} can help you with. If you would like to know more about any of it, just ask and we will explain how it works.`,
              ],
              bullets: services.map((s) => s.value),
            },
          ]
        : []),
      ...(where || audience
        ? [
            {
              heading: 'Who we work with',
              paragraphs: [
                [where ? `You will find us here: ${sentence(where.value)}` : '', audience ? sentence(audience.value) : '']
                  .filter(Boolean)
                  .join(' '),
              ],
              bullets: [],
            },
          ]
        : []),
      ...(highlights.length
        ? [{ heading: 'What sets us apart', paragraphs: [highlights.map((h) => sentence(h.value)).join(' ')], bullets: [] }]
        : []),
      getInTouch,
    ],
    factIds: used([name, about, ...services, where, audience, ...highlights, ...news, hours, ...contact]),
  };

  const guidePost: RawBlogPost = {
    title: `A guide to what ${name.value} offers`,
    description:
      fits(`A short guide to the services ${name.value} provides${where ? ` in ${where.value}` : ''}, and how to get started with us.`, 160) ||
      `A short guide to the services ${name.value} provides, and how to get started with us.`,
    sections: [
      {
        heading: '',
        paragraphs: [
          `Thinking about getting in touch with ${name.value}? This short guide explains what we do, so you know what to expect.`,
        ],
        bullets: [],
      },
      ...(about ? [{ heading: 'About us', paragraphs: [sentence(about.value)], bullets: [] }] : []),
      ...services.map((s) => ({
        heading: s.value,
        paragraphs: [`${s.value} is one of the services ${name.value} provides. Ask us about it and we will talk you through it.`],
        bullets: [],
      })),
      ...(news.length ? [{ heading: 'What is new', paragraphs: [news.map((n) => sentence(n.value)).join(' ')], bullets: [] }] : []),
      getInTouch,
    ],
    factIds: used([name, about, ...services, where, ...news, hours, ...contact]),
  };

  return [aboutPost, guidePost];
};

export class DemoBlogWriter implements BlogWriter {
  readonly name = 'demo' as const;

  async write(input: BlogWriterInput): Promise<BlogWriterOutput> {
    const [first] = versionsFrom(input.facts);
    if (!first) {
      throw new CaptionWriterError('Add your business name and what you do or offer to your profile first.');
    }
    // a different version from the latest post, when there is one
    const versions = versionsFrom(input.facts);
    const fresh = versions.find((v) => !input.recentTitles.includes(v.title || '')) || first;
    return { raw: fresh, usages: [] };
  }

  async rewrite(input: BlogRewriteInput): Promise<BlogWriterOutput> {
    const fresh = versionsFrom(input.facts).find((v) => v.title !== input.current.title);
    if (!fresh) {
      throw new CaptionWriterError('Demo mode has no other version of this post. You can edit it yourself.');
    }
    return { raw: fresh, usages: [] };
  }
}
