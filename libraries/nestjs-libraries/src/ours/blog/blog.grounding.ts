// OURS: "never invent facts", for blog posts (B1). The same hard rules as
// captions (caption.grounding.ts): whatever the writer (or the Checker's fix)
// returns, a post is kept only if it relies on a profile fact and every
// specific detail in its title, description and body (numbers, prices,
// emails, links, handles, offer or award words) is in the facts.
import { unsupportedDetails } from '@gitroom/nestjs-libraries/ours/captions/caption.grounding';
import { bodyFromSections, cleanBlogText, wordCount } from '@gitroom/nestjs-libraries/ours/blog/blog.text';
import {
  BlogContent,
  BlogFact,
  NEWS_FIELD,
  RawBlogPost,
} from '@gitroom/nestjs-libraries/ours/blog/writers/blog.writer';

// Lengths in characters, except the body, in words. Generous on purpose:
// they catch a broken answer, not a style choice, and also hold the owner's
// own edits.
export const BLOG_LIMITS = {
  title: { min: 10, max: 120 },
  description: { min: 40, max: 300 },
  bodyWords: { min: 80, max: 2500 },
} as const;

export interface CheckedBlogPost extends BlogContent {
  facts: BlogFact[];
}

// A template tag ("{business name}", "[Your name]"): it would reach the
// website as written.
const PLACEHOLDER = /\{[^}]*\}|\[[^\]]*\]/;

const oneLine = (s: string) => cleanBlogText(s).replace(/\s+/g, ' ');

// The owner's (or writer's) words, tidied.
export const cleanBlogContent = (input: Partial<BlogContent>): BlogContent => ({
  title: oneLine(String(input.title || '')),
  description: oneLine(String(input.description || '')),
  body: cleanBlogText(String(input.body || '')),
});

// Why the words can't be kept as a post, in plain English, or ''.
export const blogShapeProblem = (post: BlogContent) => {
  const words = wordCount(post.body);
  if (post.title.length < BLOG_LIMITS.title.min) return 'Give the post a title.';
  if (post.title.length > BLOG_LIMITS.title.max) return `Keep the title under ${BLOG_LIMITS.title.max} characters.`;
  if (post.description.length < BLOG_LIMITS.description.min) return 'Write a sentence or two for the search description.';
  if (post.description.length > BLOG_LIMITS.description.max) return `Keep the search description under ${BLOG_LIMITS.description.max} characters.`;
  if (words < BLOG_LIMITS.bodyWords.min) return `The post is very short. Write at least ${BLOG_LIMITS.bodyWords.min} words.`;
  if (words > BLOG_LIMITS.bodyWords.max) return `The post is too long. Keep it under ${BLOG_LIMITS.bodyWords.max.toLocaleString('en-GB')} words.`;
  if (PLACEHOLDER.test(`${post.title}\n${post.description}\n${post.body}`)) return 'Fill in or remove the text in brackets.';
  return '';
};

// Details in a post that the facts don't support (all of it is checked:
// title, description and body).
export const unsupportedBlogDetails = (post: BlogContent, facts: BlogFact[]) =>
  unsupportedDetails([post.title, post.description, post.body].join('\n'), facts);

// The writer's sections as the words we store.
export const blogContentFromRaw = (raw: RawBlogPost): BlogContent =>
  cleanBlogContent({
    title: raw?.title,
    description: raw?.description,
    body: bodyFromSections(raw?.sections || []),
  });

// factIds: the facts the writer says the post relies on
export const groundBlogContent = (content: BlogContent, factIds: unknown[] | undefined, facts: BlogFact[]) => {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const post = cleanBlogContent(content);
  const used = Array.from(
    new Map(
      (factIds || [])
        .map((id) => byId.get(String(id)))
        .filter((f): f is BlogFact => !!f)
        .map((f) => [f.id, f])
    ).values()
  );
  const shape = blogShapeProblem(post);
  const problems = unsupportedBlogDetails(post, facts);
  const reason = shape
    ? `shape: ${shape}`
    : !used.some((f) => f.field !== NEWS_FIELD)
    ? 'no profile facts'
    : problems.length
    ? `not in profile: ${problems.join(', ')}`
    : '';
  return reason
    ? { post: null, reason }
    : { post: { ...post, facts: used } as CheckedBlogPost, reason: '' };
};

export const groundBlogPost = (raw: RawBlogPost, facts: BlogFact[]) =>
  groundBlogContent(blogContentFromRaw(raw), raw?.factIds, facts);
