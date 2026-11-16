// OURS: a deterministic stand-in for the AI, used when no ANTHROPIC_API_KEY is
// set (local development, tests, demos). It fills fixed templates with values
// from the business profile and adds no facts of its own, so its captions pass
// the same checks. Weeks written with it are labelled as demos in the app.
// Each idea has a few versions, so "rewrite" can offer a different one.
import {
  CaptionFact,
  isSeasonalFact,
} from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import {
  CaptionRewriteInput,
  CaptionWriter,
  CaptionWriterError,
  CaptionWriterInput,
  CaptionWriterOutput,
  RawCaptionPlan,
} from '@gitroom/nestjs-libraries/ours/captions/writers/caption.writer';
import { postKind } from '@gitroom/nestjs-libraries/ours/performance/performance.insights';

type Captions = { facebook: string; instagram: string; linkedin: string };
interface Idea {
  theme: string;
  facts: CaptionFact[];
  // the first version is used for the week; the others for rewrites
  versions: Captions[];
}

const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const hashtag = (s: string) =>
  `#${s.replace(/&/g, 'and').replace(/[^A-Za-z]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toUpperCase())}`;

const ideasFrom = (facts: CaptionFact[]): Idea[] => {
  const all = (field: string) => facts.filter((f) => f.field === field);
  const one = (field: string) => all(field)[0];
  const name = one('businessName');
  const tag = name ? hashtag(name.value) : '';
  if (!name) {
    return [];
  }

  const ideas: Idea[] = [];
  const intro = one('whatTheyDo');

  // Milestone 6: the nearest UK date, tied to what the business does. It
  // never says the business is open or has anything on for the date.
  const date = facts.find(isSeasonalFact);
  const about = intro || one('services');
  if (date?.label && about) {
    const label = date.label.replace(/\s*\(.*?\)/g, '');
    ideas.push({
      theme: `Coming up: ${label}`,
      facts: [name, about, date],
      versions: [
        {
          facebook: `With ${label} coming up, a quick hello from ${name.value}. ${sentence(about.value)}`,
          instagram: `${label} is on its way.\n\n${sentence(about.value)}\n\n${tag} ${hashtag(label.replace(/['’]/g, ''))}`,
          linkedin: `${label} is coming up. A reminder of what ${name.value} does: ${sentence(about.value)}`,
        },
        {
          facebook: `${label} is nearly here. From all of us at ${name.value}: ${sentence(about.value)}`,
          instagram: `Thinking ahead to ${label}.\n\n${sentence(about.value)}\n\n${tag}`,
          linkedin: `As ${label} approaches, a note from ${name.value}. ${sentence(about.value)}`,
        },
      ],
    });
  }

  if (intro) {
    ideas.push({
      theme: 'Introducing the business',
      facts: [name, intro],
      versions: [
        {
          facebook: `Hello from ${name.value}! ${sentence(intro.value)} If you have any questions, just send us a message.`,
          instagram: `${sentence(intro.value)}\n\nSay hello in the comments, we would love to hear from you.\n\n${tag}`,
          linkedin: `A quick introduction to ${name.value}. ${sentence(intro.value)} We are always happy to talk to new customers and local businesses.`,
        },
        {
          facebook: `New here? Welcome! This is ${name.value}. ${sentence(intro.value)}`,
          instagram: `Nice to meet you, we are ${name.value}.\n\n${sentence(intro.value)}\n\n${tag}`,
          linkedin: `For anyone who has not come across ${name.value} yet: ${sentence(intro.value)} Do get in touch if you would like to know more.`,
        },
        {
          facebook: `In case you were wondering what ${name.value} is all about: ${sentence(intro.value)} Send us a message any time.`,
          instagram: `A little about us.\n\n${sentence(intro.value)}\n\nFollow along to see more from ${name.value}.\n\n${tag}`,
          linkedin: `What we do at ${name.value}: ${sentence(intro.value)} We would be glad to hear from you.`,
        },
      ],
    });
  }

  for (const service of all('services')) {
    ideas.push({
      theme: `Spotlight: ${service.value}`,
      facts: [name, service],
      versions: [
        {
          facebook: `In the spotlight this week at ${name.value}: ${service.value}. Get in touch to find out more.`,
          instagram: `Spotlight on ${service.value}.\n\nAsk us anything about it in the comments or by message.\n\n${tag}`,
          linkedin: `Something you can come to ${name.value} for: ${service.value}. If this could help you or your business, we would be glad to hear from you.`,
        },
        {
          facebook: `From ${name.value}: ${service.value}. Send us a message and we will tell you all about it.`,
          instagram: `${sentence(service.value)}\n\nOne of the things we love doing at ${name.value}. Questions? Drop us a message.\n\n${tag}`,
          linkedin: `A reminder of something ${name.value} can help with: ${service.value}. Get in touch to talk it through.`,
        },
        {
          facebook: `Asking about ${service.value}? ${name.value} can help. Just get in touch.`,
          instagram: `Today we are talking about ${service.value}.\n\nMessage ${name.value} to find out more.\n\n${tag}`,
          linkedin: `${sentence(service.value)} It is part of what ${name.value} does every day. We would be happy to tell you more.`,
        },
      ],
    });
  }

  for (const highlight of all('highlights')) {
    ideas.push({
      theme: 'What sets us apart',
      facts: [name, highlight],
      versions: [
        {
          facebook: `Something we are proud of at ${name.value}: ${sentence(highlight.value)}`,
          instagram: `${sentence(highlight.value)}\n\nThanks for supporting ${name.value}.\n\n${tag}`,
          linkedin: `A little about ${name.value}: ${sentence(highlight.value)}`,
        },
        {
          facebook: `Why ${name.value}? ${sentence(highlight.value)}`,
          instagram: `What makes ${name.value} a bit different.\n\n${sentence(highlight.value)}\n\n${tag}`,
          linkedin: `One thing that matters to us at ${name.value}: ${sentence(highlight.value)}`,
        },
      ],
    });
  }

  const where = one('location') || one('serviceArea');
  if (where) {
    ideas.push({
      theme: 'Where to find us',
      facts: [name, where],
      versions: [
        {
          facebook: `${name.value} is here for you in ${where.value}. Pop in or get in touch.`,
          instagram: `Local and proud: ${name.value}, ${where.value}.\n\n${tag}`,
          linkedin: `${name.value} works with customers in ${where.value}. Get in touch if you are nearby.`,
        },
        {
          facebook: `Looking for us? You will find ${name.value} in ${where.value}. We would love to see you.`,
          instagram: `Find us in ${where.value}.\n\nCome and say hello to ${name.value}.\n\n${tag}`,
          linkedin: `Based in ${where.value}? ${name.value} is close by. We would be happy to hear from you.`,
        },
      ],
    });
  }

  const contact = [one('phone'), one('email'), one('openingHours')].filter(
    (f): f is CaptionFact => !!f
  );
  if (contact.length) {
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
      versions: [
        {
          facebook: `Want to get in touch with ${name.value}?\n${lines}`,
          instagram: `Here is how to reach ${name.value}:\n${lines}\n\n${tag}`,
          linkedin: `Planning ahead? Here is how to reach ${name.value}:\n${lines}`,
        },
        {
          facebook: `We are always happy to hear from you. Here is how to reach ${name.value}:\n${lines}`,
          instagram: `Save this for later.\n${lines}\n\n${tag}`,
          linkedin: `Getting in touch with ${name.value} is easy:\n${lines}`,
        },
      ],
    });
  }
  return ideas;
};

const planFor = (day: number, idea: Idea, captions: Partial<Captions>): RawCaptionPlan => ({
  posts: [
    {
      day,
      theme: idea.theme,
      captions: (Object.keys(captions) as (keyof Captions)[]).map((platform) => ({
        platform,
        text: captions[platform],
        factIds: idea.facts.map((f) => f.id),
      })),
    },
  ],
});

// Milestone 8: ideas of the kinds that did better come first and those that
// did worse go last, so with more ideas than days the week leans towards what
// worked. The idea that ends the week stays last unless it is one to avoid.
const isAvoided = (idea: Idea | undefined, prefs?: CaptionWriterInput['preferences']) =>
  !!idea && !!prefs?.avoid.some((k) => k.key === postKind(idea.facts));

const byPreference = (ideas: Idea[], prefs?: CaptionWriterInput['preferences']): Idea[] => {
  if (!prefs || (!prefs.favour.length && !prefs.avoid.length)) {
    return ideas;
  }
  const rank = (idea: Idea) => {
    const kind = postKind(idea.facts);
    if (prefs.favour.some((k) => k.key === kind)) return 0;
    if (prefs.avoid.some((k) => k.key === kind)) return 2;
    return 1;
  };
  const end = ideas[ideas.length - 1];
  const keepEnd = !!end && !isAvoided(end, prefs);
  const ranked = (keepEnd ? ideas.slice(0, -1) : ideas)
    .map((idea, i) => ({ idea, i }))
    .sort((a, b) => rank(a.idea) - rank(b.idea) || a.i - b.i)
    .map(({ idea }) => idea);
  return keepEnd ? [...ranked, end] : ranked;
};

export class DemoCaptionWriter implements CaptionWriter {
  readonly name = 'demo' as const;

  async write(input: CaptionWriterInput): Promise<CaptionWriterOutput> {
    const ideas = byPreference(ideasFrom(input.facts), input.preferences);

    // Contact details make a good end to the week; fill the days in order.
    // An idea of a kind to use less isn't kept for the end (Milestone 8).
    const end = ideas[ideas.length - 1];
    const last =
      ideas.length > input.days.length && !isAvoided(end, input.preferences) ? ideas.pop() : undefined;
    const picked = ideas.slice(0, input.days.length - (last ? 1 : 0));
    if (last) picked.push(last);

    const raw: RawCaptionPlan = {
      posts: picked.flatMap((idea, day) => planFor(day, idea, idea.versions[0]).posts || []),
    };
    return { raw, usages: [] };
  }

  // Another version of the same idea. The demo writer can't follow the
  // owner's note; the screen says so in demo mode.
  async rewrite(input: CaptionRewriteInput): Promise<CaptionWriterOutput> {
    const idea = ideasFrom(input.facts).find((i) => i.theme === input.theme);
    const others = (idea?.versions || [])
      .map((v) => v[input.platform])
      .filter((text) => text.trim() !== input.current.trim());
    if (!idea || !others.length) {
      throw new CaptionWriterError(
        'Demo mode has no other version of this post. Edit it yourself, or connect the AI service.'
      );
    }
    const text = others[input.attempt % others.length];
    return { raw: planFor(0, idea, { [input.platform]: text }), usages: [] };
  }
}
