// OURS: blog posts B1. The Checker for long posts: the step that reads a
// written blog post (title, search description and body) against the facts
// and passes it, fixes it with small exact edits, or drops it. Like the
// caption Checker (captions/checkers/caption.checker.ts) it runs after the
// writer and before the hard rules, which still check the post last. It is
// off unless OURS_BLOG_CHECKER=true, and stays off until the long-post test
// set (ours/eval/blog) shows it passes the same bar as captions.
import { AiCallUsage } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import { CheckVerdict } from '@gitroom/nestjs-libraries/ours/captions/checkers/caption.checker';
import { BlogContent, BlogFact } from '@gitroom/nestjs-libraries/ours/blog/writers/blog.writer';

export const BLOG_PARTS = ['title', 'description', 'body'] as const;
export type BlogPart = (typeof BLOG_PARTS)[number];

export interface BlogCheckInput {
  facts: BlogFact[];
  post: BlogContent;
  // Content engine E4: brand memory's "avoid" and "phrases" lessons
  brief?: string;
}

// A long post is fixed with small replacements rather than written out again,
// so nothing else in it can change by accident.
export interface BlogEdit {
  part: BlogPart;
  find: string;
  replace: string;
}

export interface BlogCheckResult {
  verdict: CheckVerdict;
  // the claims about the business found in the post, each matched to a fact
  // id, or to null when nothing in the facts supports it
  claims: { claim: string; factId: string | null }[];
  // when the verdict is fix
  edits: BlogEdit[];
}

export interface BlogCheckOutput {
  result: BlogCheckResult;
  usages: AiCallUsage[];
}

export interface BlogChecker {
  readonly name: 'anthropic' | 'demo';
  check(input: BlogCheckInput): Promise<BlogCheckOutput>;
}

const count = (text: string, find: string) => text.split(find).length - 1;

// The post with the Checker's verdict applied: a fixed post gets its edits, a
// dropped one is null. Every edit must match its text exactly once, or the
// fix can't be trusted and the post is dropped too. groundBlogPost() still
// checks whatever is left.
export const applyBlogCheck = (post: BlogContent, result: BlogCheckResult) => {
  if (result.verdict === 'pass') {
    return { post, edits: 0 };
  }
  if (result.verdict === 'drop' || !result.edits?.length) {
    return { post: null, edits: 0 };
  }
  const fixed = { ...post };
  for (const edit of result.edits) {
    const part = BLOG_PARTS.includes(edit?.part) ? edit.part : null;
    if (!part || !edit.find || count(fixed[part], edit.find) !== 1) {
      return { post: null, edits: 0 };
    }
    fixed[part] = fixed[part].replace(edit.find, () => edit.replace ?? '');
  }
  return { post: fixed, edits: result.edits.length };
};
