// OURS: a deterministic stand-in for the AI, used when no ANTHROPIC_API_KEY is
// set (local development, tests, demos). It only lifts text that is on the
// page, so its claims pass the same source checks. Profiles built with it are
// labelled as demo profiles in the app.
import { RawExtraction } from '@gitroom/nestjs-libraries/ours/profile/business.profile.fields';
import {
  ExtractionOutput,
  ExtractorPage,
  ProfileExtractor,
} from '@gitroom/nestjs-libraries/ours/profile/extractors/profile.extractor';

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const UK_PHONE = /(?:\+44\s?\(0\)\s?|\+44\s?|0)\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}/;
const POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/;
const SOCIAL = /https?:\/\/(?:www\.)?(?:facebook|instagram|linkedin|tiktok|youtube|x|twitter)\.com\/[^\s)]+/gi;

const claim = (value: string, url: string, quote: string) => ({
  value,
  sources: [{ url, quote }],
});

const lines = (page: ExtractorPage) => page.text.split('\n').map((l) => l.trim());

// Some sites run a link straight into the text before it ("…co.ukhttps://…"),
// which glued an email to "https" and two social links together. Split them
// apart before matching; each piece is still a substring of the page.
const unglue = (l: string) => l.replace(/(\S)(https?:\/\/)/g, '$1 $2');

// Headings that are calls to action or links, not the business's name.
const NOT_A_NAME = /https?:\/\/|www\.|\b(follow us|sign up|subscribe|contact us|get in touch|book now|order now|shop now|welcome to)\b/i;

export class DemoProfileExtractor implements ProfileExtractor {
  readonly name = 'demo' as const;

  async extract(pages: ExtractorPage[]): Promise<ExtractionOutput> {
    const raw: RawExtraction = {};
    const add = (key: string, c: ReturnType<typeof claim>) => {
      (raw[key] = raw[key] || []).push(c);
    };
    const home = pages[0];

    // name: the first heading, or the title before any separator
    const heading = home && lines(home).find((l) => l.startsWith('## ') && !NOT_A_NAME.test(l));
    if (heading) {
      const name = heading.replace(/^## /, '');
      add('businessName', claim(name, home.url, name));
    } else if (home?.title) {
      const name = home.title.split(/\s[|–—-]\s/)[0].trim();
      if (home.text.includes(name)) add('businessName', claim(name, home.url, name));
    }

    // what they do: the first proper sentence on the homepage
    const intro = home && lines(home).find(
      (l) => !l.startsWith('## ') && !l.startsWith('- ') && !l.startsWith('[') && l.length > 40 && !l.startsWith('Page description:')
    );
    if (intro) {
      const sentence = intro.match(/^.*?[.!?](\s|$)/)?.[0].trim() || intro;
      add('whatTheyDo', claim(sentence.slice(0, 200), home.url, sentence.slice(0, 200)));
    }

    for (const page of pages) {
      const ls = lines(page);
      // services: list items under a heading that mentions services
      let inServices = false;
      for (const l of ls) {
        if (l.startsWith('## ')) {
          inServices = /service|what we do|treatments|our menu|products/i.test(l);
          continue;
        }
        if (inServices && l.startsWith('- ')) {
          const item = l.replace(/^- /, '').slice(0, 120);
          add('services', claim(item, page.url, item));
        }
      }
      for (const l of ls.map(unglue)) {
        const email = l.match(EMAIL)?.[0];
        if (email) add('email', claim(email, page.url, email));
        const phone = l.match(UK_PHONE)?.[0];
        if (phone) add('phone', claim(phone, page.url, phone));
        if (POSTCODE.test(l) && l.length < 160) add('address', claim(l, page.url, l));
        if (/opening hours|open (mon|tue|wed|thu|fri|sat|sun|daily|every)/i.test(l) && l.length < 160) {
          add('openingHours', claim(l.replace(/^- /, ''), page.url, l.replace(/^- /, '')));
        }
        for (const s of l.match(SOCIAL) || []) add('socialLinks', claim(s, page.url, s));
      }
    }

    return { raw, usages: [] };
  }
}
