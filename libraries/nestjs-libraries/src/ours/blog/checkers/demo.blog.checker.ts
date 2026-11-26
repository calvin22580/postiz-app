// OURS: blog posts B1. Used when the blog Checker is on but there is no
// ANTHROPIC_API_KEY: it passes every post unchanged and costs nothing, so the
// app and tests run. groundBlogPost() still checks every post.
import {
  BlogCheckInput,
  BlogCheckOutput,
  BlogChecker,
} from '@gitroom/nestjs-libraries/ours/blog/checkers/blog.checker';

export class DemoBlogChecker implements BlogChecker {
  readonly name = 'demo' as const;

  async check(_input: BlogCheckInput): Promise<BlogCheckOutput> {
    return { result: { verdict: 'pass', claims: [], edits: [] }, usages: [] };
  }
}
