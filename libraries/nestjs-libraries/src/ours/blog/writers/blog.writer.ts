// OURS: blog posts B1. The adapter between the blog service and whatever
// writes the post, like CaptionWriter for posts. Claude is used when
// ANTHROPIC_API_KEY is set; otherwise a deterministic demo writer runs and
// the post is labelled as a demo. Whatever comes back is checked (the
// Checker when on, then groundBlogPost) before the owner sees it.
import { AiCallUsage } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import { CaptionFact } from '@gitroom/nestjs-libraries/ours/captions/caption.plan';

// The owner's answer to "Anything new to tell customers?" is a fact for this
// post: their own claim about their own business, like an owner-entered
// profile value.
export const NEWS_FIELD = 'news';

export type BlogFact = Omit<CaptionFact, 'field'> & {
  field: CaptionFact['field'] | typeof NEWS_FIELD;
};

export interface BlogContent {
  title: string;
  description: string;
  body: string;
}

export interface BlogWriterInput {
  // profile facts, plus the owner's news when they gave some
  facts: BlogFact[];
  tone: string;
  // the month it is written in ("November 2026"), so the topic suits the time
  // of year; never a date to state in the post
  month: string;
  // titles of the business's recent posts, so the next one is different
  recentTitles: string[];
  // Content engine E4: what brand memory has learned about the owner's
  // style. A preference, never a fact.
  brief?: string;
}

// One post again, because the owner asked for a different version.
export interface BlogRewriteInput extends BlogWriterInput {
  current: BlogContent;
  // what the owner would like changed, in their own words (optional)
  note?: string;
  // how many times this post was rewritten before
  attempt: number;
}

export interface RawBlogSection {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
}

// What a writer returns before checking.
export interface RawBlogPost {
  title?: string;
  description?: string;
  sections?: RawBlogSection[];
  factIds?: string[];
}

export interface BlogWriterOutput {
  raw: RawBlogPost;
  usages: AiCallUsage[];
}

export interface BlogWriter {
  readonly name: 'anthropic' | 'demo';
  write(input: BlogWriterInput): Promise<BlogWriterOutput>;
  rewrite(input: BlogRewriteInput): Promise<BlogWriterOutput>;
}
