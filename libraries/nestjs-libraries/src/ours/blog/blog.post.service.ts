// OURS: blog posts B1. A blog post for the business's own website, written
// in the background like a week of captions: profile facts (plus the owner's
// answer to "Anything new to tell customers?") → writer (AI or demo) → the
// Checker, when on → hard rules → saved, waiting for the owner. The owner
// approves, edits, rewrites or rejects it, and copies an approved post into
// their website. Nothing is published from here (that is B2). Writing a post
// takes one unit of the plan's monthly `blogPosts` allowance; a post that
// couldn't be written gives it back. Off unless OURS_BLOG_POSTS=true.
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { OursBlogPostStatus, Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { AiUsageService } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import { BusinessProfileService } from '@gitroom/nestjs-libraries/ours/profile/business.profile.service';
import { ProfileFields } from '@gitroom/nestjs-libraries/ours/profile/business.profile.fields';
import {
  captionTimezone,
  factsFromProfile,
  hasEnoughToWrite,
  toneFromProfile,
} from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import {
  CaptionWriterError,
  CaptionWriterWithUsageError,
} from '@gitroom/nestjs-libraries/ours/captions/writers/caption.writer';
import { CaptionCheckerError } from '@gitroom/nestjs-libraries/ours/captions/checkers/caption.checker';
import { PlanService, UsageTicket } from '@gitroom/nestjs-libraries/ours/plans/plan.service';
import { BrandSignalService } from '@gitroom/nestjs-libraries/ours/memory/brand.signal.service';
import { BrandMemoryService } from '@gitroom/nestjs-libraries/ours/memory/brand.memory.service';
import { RejectReason } from '@gitroom/nestjs-libraries/ours/memory/brand.signal';
import {
  BlogPostRepository,
  BlogPostWords,
  StoredBlogPost,
} from '@gitroom/nestjs-libraries/ours/blog/blog.post.repository';
import {
  blogContentFromRaw,
  blogShapeProblem,
  CheckedBlogPost,
  cleanBlogContent,
  groundBlogContent,
  groundBlogPost,
  unsupportedBlogDetails,
} from '@gitroom/nestjs-libraries/ours/blog/blog.grounding';
import { wordCount } from '@gitroom/nestjs-libraries/ours/blog/blog.text';
import {
  BlogContent,
  BlogFact,
  BlogWriter,
  NEWS_FIELD,
  RawBlogPost,
} from '@gitroom/nestjs-libraries/ours/blog/writers/blog.writer';
import { AnthropicBlogWriter } from '@gitroom/nestjs-libraries/ours/blog/writers/anthropic.blog.writer';
import { DemoBlogWriter } from '@gitroom/nestjs-libraries/ours/blog/writers/demo.blog.writer';
import { applyBlogCheck, BlogChecker } from '@gitroom/nestjs-libraries/ours/blog/checkers/blog.checker';
import { AnthropicBlogChecker } from '@gitroom/nestjs-libraries/ours/blog/checkers/anthropic.blog.checker';
import { DemoBlogChecker } from '@gitroom/nestjs-libraries/ours/blog/checkers/demo.blog.checker';

dayjs.extend(utc);
dayjs.extend(timezone);

// AI cost features (ours_ai_usage.feature), named like the caption ones
export const BLOG_POST_FEATURE = 'blog-post';
export const BLOG_REWRITE_FEATURE = 'blog-rewrite';
export const BLOG_CHECK_FEATURE = 'blog-check';
// A long post costs more to rewrite than a caption, so fewer rewrites each;
// the owner can still edit the words themselves.
export const MAX_BLOG_REWRITES = 3;
export const NEWS_MAX = 600;
const STALE_AFTER_MS = 10 * 60 * 1000;
// the posts the screen lists
const SHOWN = 6;
const RECENT_TITLES = 10;

export const blogPostsOn = (env: NodeJS.ProcessEnv = process.env) => env.OURS_BLOG_POSTS === 'true';

export const blogWriterName = (): BlogWriter['name'] =>
  process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'demo';

export const createBlogWriter = (): BlogWriter =>
  blogWriterName() === 'anthropic' ? new AnthropicBlogWriter() : new DemoBlogWriter();

// The blog Checker runs only when switched on, and stays off until the
// long-post test set shows it helps (ours/eval/blog).
export const createBlogChecker = (): BlogChecker | null =>
  process.env.OURS_BLOG_CHECKER !== 'true'
    ? null
    : blogWriterName() === 'anthropic'
    ? new AnthropicBlogChecker()
    : new DemoBlogChecker();

// The owner's news as facts for this post: one per line they wrote.
export const newsFacts = (news: string | null | undefined): BlogFact[] =>
  String(news || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((value, i) => ({ id: `${NEWS_FIELD}.${i}`, field: NEWS_FIELD, value }));

// What a post keeps of each fact it relies on.
const storedFact = (f: BlogFact) => ({ id: f.id, field: f.field, value: f.value });

const wordsOf = (p: Pick<StoredBlogPost, 'title' | 'description' | 'body'>): BlogPostWords => ({
  title: p.title,
  description: p.description,
  body: p.body,
});

// Content engine E1: which post an owner signal is about, and its words as
// one text, as the keeper reads them. Only the title and search description:
// the keeper reads blog signals next to captions, and whole posts would
// swamp its prompt (and its cost). Learning from body edits can come later.
const signalTarget = (p: Pick<StoredBlogPost, 'id' | 'title'>) => ({
  draftId: p.id,
  platform: 'blog',
  theme: p.title.slice(0, 120),
});
const asText = (p: Pick<BlogContent, 'title' | 'description'>) => `${p.title}\n\n${p.description}`;

@Injectable()
export class BlogPostService {
  private _logger = new Logger(BlogPostService.name);

  constructor(
    private _blogPostRepository: BlogPostRepository,
    private _businessProfileService: BusinessProfileService,
    private _aiUsageService: AiUsageService,
    private _planService: PlanService,
    private _brandSignalService: BrandSignalService,
    private _brandMemoryService: BrandMemoryService
  ) {}

  private assertOn() {
    if (!blogPostsOn()) {
      throw new HttpException('Not found', 404);
    }
  }

  async overview(orgId: string) {
    if (!blogPostsOn()) {
      return { on: false as const };
    }
    let posts = await this._blogPostRepository.latest(orgId, SHOWN);
    const stale = posts.find(
      (p) => p.status === OursBlogPostStatus.WRITING && Date.now() - p.startedAt.getTime() > STALE_AFTER_MS
    );
    if (stale) {
      await this._blogPostRepository.fail(orgId, stale.id, 'Writing your blog post took too long. Please try again.');
      posts = await this._blogPostRepository.latest(orgId, SHOWN);
    }
    const [{ profile }, allowance] = await Promise.all([
      this._businessProfileService.getProfile(orgId),
      this._planService.allowance(orgId, 'blogPosts'),
    ]);
    const profileFacts = profile?.fields ? factsFromProfile(profile.fields as ProfileFields) : [];
    // the question is asked each month: this month's answer is offered again
    const tz = captionTimezone();
    const thisMonth = dayjs().tz(tz).format('YYYY-MM');
    const latestNews = posts.find((p) => p.news);
    return {
      on: true as const,
      // posts and rewrites come from the demo writer when no AI service is connected
      demo: blogWriterName() === 'demo',
      allowance,
      maxRewrites: MAX_BLOG_REWRITES,
      newsMax: NEWS_MAX,
      news:
        latestNews && dayjs(latestNews.startedAt).tz(tz).format('YYYY-MM') === thisMonth ? latestNews.news : null,
      posts: posts.map((p) => this.present(p, profileFacts)),
    };
  }

  async startWriting(orgId: string, news?: string) {
    this.assertOn();
    const { profile } = await this._businessProfileService.getProfile(orgId);
    if (!profile || profile.status !== 'READY') {
      throw new HttpException('Set up your business profile first, so we know what to write about.', 400);
    }
    const fields = profile.fields as ProfileFields;
    const facts = factsFromProfile(fields);
    if (!hasEnoughToWrite(facts)) {
      throw new HttpException('Add your business name and what you do or offer to your profile first.', 400);
    }
    const cleanNews = String(news || '').replace(/\r\n?/g, '\n').trim().slice(0, NEWS_MAX) || null;
    const open = await this._blogPostRepository.open(orgId);
    if (open?.status === OursBlogPostStatus.WRITING) {
      return this.overview(orgId);
    }
    if (open) {
      throw new HttpException('Approve or reject the blog post that’s waiting for you first.', 400);
    }

    // one post from the plan's monthly allowance
    const ticket = await this._planService.claim(orgId, 'blogPosts');
    let post: StoredBlogPost | null;
    let recentTitles: string[];
    try {
      recentTitles = await this._blogPostRepository.recentTitles(orgId, RECENT_TITLES);
      post = await this._blogPostRepository.start(orgId, cleanNews);
    } catch (e) {
      await this._planService.giveBack(orgId, ticket);
      throw e;
    }
    if (!post) {
      // another request started a post a moment ago (a double click)
      await this._planService.giveBack(orgId, ticket);
      return this.overview(orgId);
    }
    // background: the request returns now, the screen polls for progress
    this.runWriting(orgId, post.id, [...facts, ...newsFacts(cleanNews)], toneFromProfile(fields), recentTitles, ticket).catch((e) =>
      this._logger.error(`Blog writing crashed for org=${orgId}: ${e?.message}`)
    );
    return this.overview(orgId);
  }

  async runWriting(
    orgId: string,
    postId: string,
    facts: BlogFact[],
    tone: string,
    recentTitles: string[],
    ticket?: UsageTicket,
    writer: BlogWriter = createBlogWriter(),
    checker: BlogChecker | null = createBlogChecker()
  ) {
    try {
      // Content engine E4: the brand brief as it stands (the keeper learns
      // when a week is written, not here)
      const brief = await this._brandMemoryService.brief(orgId);
      let output;
      try {
        output = await writer.write({
          facts,
          tone,
          month: dayjs().tz(captionTimezone()).format('MMMM YYYY'),
          recentTitles,
          ...(brief ? { brief } : {}),
        });
      } catch (e) {
        if (e instanceof CaptionWriterWithUsageError) {
          await this.logUsages(orgId, e.usages, BLOG_POST_FEATURE);
        }
        throw e;
      }
      await this.logUsages(orgId, output.usages, BLOG_POST_FEATURE);
      const checked = await this.checkAndGround(orgId, output.raw, facts, checker);
      if (!checked.post) {
        this._logger.log(`Blog post for org=${orgId} not kept (${checked.reason})`);
        throw new CaptionWriterError(
          'We couldn’t write a blog post we were sure about. Add more detail to your profile, or tell us what’s new, and try again.'
        );
      }
      const saved = await this._blogPostRepository.finish(orgId, postId, {
        title: checked.post.title,
        description: checked.post.description,
        body: checked.post.body,
        facts: checked.post.facts.map(storedFact),
        writer: writer.name,
      });
      if (!saved) {
        this._logger.warn(`Blog post ${postId} for org=${orgId} was no longer being written; result discarded`);
      }
    } catch (e) {
      // a post that wasn't written doesn't count towards the plan
      await this._planService.giveBack(orgId, ticket);
      const known = e instanceof CaptionWriterError;
      if (!known) {
        this._logger.error(`Blog writing failed for org=${orgId}: ${(e as Error)?.stack}`);
      }
      await this._blogPostRepository.fail(
        orgId,
        postId,
        known ? (e as Error).message : 'Something went wrong while writing your blog post. Please try again.'
      );
    }
  }

  async approve(orgId: string, id: string) {
    this.assertOn();
    const post = await this.waitingPost(orgId, id);
    if (!(await this._blogPostRepository.approve(orgId, id, wordsOf(post)))) {
      throw new HttpException('This post was changed a moment ago. Please check it and try again.', 409);
    }
    // Content engine E1: approved as written, or after the owner's own changes
    await this._brandSignalService.record(orgId, {
      kind: 'approved',
      ...signalTarget(post),
      after: asText(post),
      edited: !!post.editedAt,
    });
    return this.overview(orgId);
  }

  // The owner's own words are their claims about their own business, so they
  // are kept, but the screen points out details the facts don't have.
  async editWords(orgId: string, id: string, input: Partial<BlogContent>) {
    this.assertOn();
    const post = await this.waitingPost(orgId, id);
    const words = cleanBlogContent(input);
    const problem = blogShapeProblem(words);
    if (problem) {
      throw new HttpException(problem, 400);
    }
    if (!(await this._blogPostRepository.editWords(orgId, id, words))) {
      throw new HttpException('This post can only be changed while it is waiting for your approval.', 400);
    }
    if (asText(words) !== asText(post)) {
      await this._brandSignalService.record(orgId, {
        kind: 'edited',
        ...signalTarget(post),
        before: asText(post),
        after: asText(words),
        edited: !!post.editedAt,
      });
    }
    return this.overview(orgId);
  }

  async reject(orgId: string, id: string) {
    this.assertOn();
    const post = await this.waitingPost(orgId, id);
    if (!(await this._blogPostRepository.reject(orgId, id))) {
      throw new HttpException('This post can only be rejected while it is waiting for your approval.', 400);
    }
    await this._brandSignalService.record(orgId, {
      kind: 'rejected',
      ...signalTarget(post),
      before: asText(post),
      edited: !!post.editedAt,
    });
    return this.overview(orgId);
  }

  async setRejectReason(orgId: string, id: string, reason: RejectReason) {
    this.assertOn();
    const post = await this.findPost(orgId, id);
    if (!(await this._blogPostRepository.setRejectReason(orgId, id, reason))) {
      throw new HttpException('You can only say why for a post you rejected.', 400);
    }
    await this._brandSignalService.record(orgId, { kind: 'reject-reason', ...signalTarget(post), reason });
    return this.overview(orgId);
  }

  async restore(orgId: string, id: string) {
    this.assertOn();
    const post = await this.findPost(orgId, id);
    const open = await this._blogPostRepository.open(orgId);
    if (open && open.id !== id) {
      throw new HttpException('Approve or reject the blog post that’s waiting for you first.', 400);
    }
    if (!(await this._blogPostRepository.restore(orgId, id))) {
      throw new HttpException('Only a rejected post can be brought back.', 400);
    }
    await this._brandSignalService.record(orgId, { kind: 'restored', ...signalTarget(post) });
    return this.overview(orgId);
  }

  // A new version, from the profile as it is now and the news the post was
  // written with. It goes through the same checks; if it fails them the
  // current version is kept. Rewrites come from the plan's monthly rewrites.
  async rewrite(
    orgId: string,
    id: string,
    note?: string,
    writer: BlogWriter = createBlogWriter(),
    checker: BlogChecker | null = createBlogChecker()
  ) {
    this.assertOn();
    const post = await this.waitingPost(orgId, id);
    const { profile } = await this._businessProfileService.getProfile(orgId);
    if (!profile || profile.status !== 'READY') {
      throw new HttpException('Your business profile is being updated. Try again when it is ready.', 400);
    }
    const fields = profile.fields as ProfileFields;
    const facts = [...factsFromProfile(fields), ...newsFacts(post.news)];
    const ticket = await this._planService.claim(orgId, 'rewrites');
    if (!(await this._blogPostRepository.claimRewrite(orgId, id, MAX_BLOG_REWRITES))) {
      await this._planService.giveBack(orgId, ticket);
      throw new HttpException(
        `This post has already been rewritten ${MAX_BLOG_REWRITES} times. You can still edit it yourself.`,
        400
      );
    }
    const brief = await this._brandMemoryService.brief(orgId);
    let output;
    try {
      output = await writer.rewrite({
        facts,
        tone: toneFromProfile(fields),
        month: dayjs().tz(captionTimezone()).format('MMMM YYYY'),
        recentTitles: [],
        current: wordsOf(post),
        note,
        attempt: post.rewriteCount,
        ...(brief ? { brief } : {}),
      });
    } catch (e) {
      if (e instanceof CaptionWriterWithUsageError) {
        await this.logUsages(orgId, e.usages, BLOG_REWRITE_FEATURE);
      } else {
        // nothing was billed, so the owner keeps this rewrite
        await this._blogPostRepository.giveBackRewrite(orgId, id).catch(() => undefined);
        await this._planService.giveBack(orgId, ticket);
      }
      if (e instanceof CaptionWriterError) {
        throw new HttpException(e.message, 400);
      }
      this._logger.error(`Blog rewrite failed for org=${orgId} post=${id}: ${(e as Error)?.stack}`);
      throw new HttpException('Something went wrong while writing a new version. Please try again.', 400);
    }
    await this.logUsages(orgId, output.usages, BLOG_REWRITE_FEATURE);
    const checked = await this.checkAndGround(orgId, output.raw, facts, checker);
    const fresh = checked.post;
    const signal = (after: string | null) =>
      this._brandSignalService.record(orgId, {
        kind: 'rewrite',
        ...signalTarget(post),
        before: asText(post),
        after,
        note: note?.trim() || null,
        edited: !!post.editedAt,
      });
    if (!fresh || asText(fresh) === asText(post)) {
      await signal(null);
      this._logger.log(`Blog rewrite for org=${orgId} post=${id} not kept${checked.reason ? ` (${checked.reason})` : ''}`);
      throw new HttpException(
        'We couldn’t write a new version we were sure about, so we kept the current one. Try again, or edit it yourself.',
        400
      );
    }
    const saved = await this._blogPostRepository.saveRewrite(orgId, id, {
      ...wordsOf(fresh),
      facts: fresh.facts.map(storedFact) as Prisma.InputJsonValue,
    });
    await signal(saved ? asText(fresh) : null);
    if (!saved) {
      throw new HttpException('This post was approved or rejected while we were writing, so it was left as it is.', 409);
    }
    return this.overview(orgId);
  }

  // The Checker passes, fixes or drops the post before the hard rules. If the
  // check itself fails, the post goes on to the hard rules unchanged: those
  // still run, and the owner still approves it.
  private async checkAndGround(
    orgId: string,
    raw: RawBlogPost,
    facts: BlogFact[],
    checker: BlogChecker | null
  ): Promise<{ post: CheckedBlogPost | null; reason: string }> {
    const first = groundBlogPost(raw, facts);
    if (!checker) {
      return first;
    }
    const written = blogContentFromRaw(raw);
    try {
      const brief = await this._brandMemoryService.brief(orgId, ['avoid', 'phrases']);
      const output = await checker.check({ facts, post: written, ...(brief ? { brief } : {}) });
      await this.logUsages(orgId, output.usages, BLOG_CHECK_FEATURE);
      const applied = applyBlogCheck(written, output.result);
      this._logger.log(
        `Blog check for org=${orgId} (${checker.name}): ${output.result.verdict}${applied.edits ? `, ${applied.edits} edits` : ''}`
      );
      if (!applied.post) {
        return { post: null, reason: `checker: ${output.result.verdict}` };
      }
      // the fixed words, with the facts the writer cited, through the hard rules
      return groundBlogContent(applied.post, raw?.factIds, facts);
    } catch (e) {
      if (e instanceof CaptionCheckerError) {
        await this.logUsages(orgId, e.usages, BLOG_CHECK_FEATURE);
      }
      this._logger.error(`Blog check skipped for org=${orgId}: ${(e as Error)?.message}`);
      return first;
    }
  }

  private async findPost(orgId: string, id: string) {
    const post = await this._blogPostRepository.getPost(orgId, id);
    if (!post) {
      throw new HttpException('Blog post not found', 404);
    }
    return post;
  }

  private async waitingPost(orgId: string, id: string) {
    const post = await this.findPost(orgId, id);
    if (post.status === OursBlogPostStatus.APPROVED) {
      throw new HttpException('This post is already approved.', 400);
    }
    if (post.status === OursBlogPostStatus.REJECTED) {
      throw new HttpException('Bring this post back first.', 400);
    }
    if (post.status !== OursBlogPostStatus.PENDING_APPROVAL) {
      throw new HttpException('This post isn’t ready yet.', 400);
    }
    return post;
  }

  private async logUsages(orgId: string, usages: Parameters<AiUsageService['logCall']>[2][], feature: string) {
    for (const usage of usages) {
      await this._aiUsageService.logCall(orgId, feature, usage);
    }
  }

  private present(p: StoredBlogPost, profileFacts: BlogFact[]) {
    const facts = (p.facts || []) as Pick<BlogFact, 'field' | 'value'>[];
    return {
      id: p.id,
      status: p.status,
      news: p.news,
      title: p.title,
      description: p.description,
      body: p.body,
      words: wordCount(p.body),
      facts,
      demo: p.writer === 'demo',
      errorMessage: p.errorMessage,
      startedAt: p.startedAt,
      editedAt: p.editedAt,
      approvedAt: p.approvedAt,
      rejectedAt: p.rejectedAt,
      rejectReason: p.rejectReason,
      rewritesLeft: Math.max(0, MAX_BLOG_REWRITES - p.rewriteCount),
      // details in the owner's own words that the facts don't have: shown as
      // a reminder to check, never removed
      notInProfile:
        p.editedAt && p.status === OursBlogPostStatus.PENDING_APPROVAL
          ? unsupportedBlogDetails(wordsOf(p), [...profileFacts, ...newsFacts(p.news)])
          : [],
    };
  }
}
