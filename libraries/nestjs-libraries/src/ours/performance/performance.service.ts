// OURS: Milestone 8, learning from post performance. Results come from
// upstream's own post analytics (PostsService.checkPostAnalytics, the same
// call upstream's statistics window makes), so every platform that reports
// post analytics works without changes here. The Sandbox channel reports
// simulated results, which are labelled everywhere and never mixed with real
// ones.
import { Injectable, Logger } from '@nestjs/common';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { captionTimezone } from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import { isSandboxEnabled } from '@gitroom/nestjs-libraries/ours/sandbox/sandbox.config';
import { PerformanceRepository } from '@gitroom/nestjs-libraries/ours/performance/performance.repository';
import {
  kindLabel,
  MeasuredPost,
  MIN_GROUP_POSTS,
  MIN_MEASURED_POSTS,
  postKind,
  preferencesFrom,
  readMetrics,
  summarise,
  WriterPreferences,
} from '@gitroom/nestjs-libraries/ours/performance/performance.insights';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// posts older than this are left out of the summary
const LOOK_BACK_MS = 90 * DAY;
// how far back upstream's analytics are asked for, in days
const ANALYTICS_DAYS = 30;
// ask again: soon while nothing is reported, less often once it is, and stop
// once a post's numbers have settled
const RECHECK_EMPTY_MS = HOUR;
const RECHECK_MEASURED_MS = 6 * HOUR;
const SETTLED_AFTER_MS = 30 * DAY;
// platform calls per visit to the results screen; the rest wait for the next
const MAX_CHECKS_PER_VISIT = 10;

type ApprovedPost = Awaited<ReturnType<PerformanceRepository['approvedPosts']>>[number];

@Injectable()
export class PerformanceService {
  private _logger = new Logger(PerformanceService.name);

  constructor(
    private _performanceRepository: PerformanceRepository,
    private _postsService: PostsService
  ) {}

  // The results screen: fetch what is due, then summarise.
  async overview(orgId: string) {
    await this.collect(orgId);
    return this.summary(orgId);
  }

  // What the caption writer may lean on for the next week, or null. Simulated
  // results only count while the Sandbox is switched on, and real results
  // always win over simulated ones. Never throws: captions are written
  // without preferences if results can't be read.
  async writerPreferences(orgId: string): Promise<WriterPreferences | null> {
    try {
      const { preferences } = await this.summary(orgId);
      return preferences?.applied ? preferences : null;
    } catch (e) {
      this._logger.error(`Could not read post results for org=${orgId}: ${(e as Error)?.message}`);
      return null;
    }
  }

  async collect(orgId: string, now = Date.now()) {
    const posts = await this._performanceRepository.approvedPosts(orgId, new Date(now - LOOK_BACK_MS));
    if (!posts.length) {
      return;
    }
    const results = new Map(
      (await this._performanceRepository.results(orgId, posts.map((p) => p.id))).map((r) => [r.draftId, r])
    );
    // A post planned for later can still have gone out (the owner can move it
    // in the calendar), so it is asked about too, but after the ones whose
    // time has come.
    const isPast = (p: ApprovedPost) => p.scheduledFor.getTime() <= now;
    const due = posts
      .filter((p) => {
        // numbers settle (or a post never reports anything): stop asking
        if (now - p.scheduledFor.getTime() >= SETTLED_AFTER_MS) return false;
        const r = results.get(p.id);
        if (!r) return true;
        const age = now - r.checkedAt.getTime();
        return age >= (r.measuredAt ? RECHECK_MEASURED_MS : RECHECK_EMPTY_MS);
      })
      // due ones first, then never asked, then the longest since asked
      .sort(
        (a, b) =>
          Number(isPast(b)) - Number(isPast(a)) ||
          (results.get(a.id)?.checkedAt.getTime() ?? 0) - (results.get(b.id)?.checkedAt.getTime() ?? 0)
      )
      .slice(0, MAX_CHECKS_PER_VISIT);

    // one at a time, to stay well inside platform rate limits
    for (const post of due) {
      await this.check(orgId, post);
    }
  }

  private async check(orgId: string, post: ApprovedPost) {
    const postId = post.postId!;
    try {
      const data = await this._postsService.checkPostAnalytics(orgId, postId, ANALYTICS_DAYS);
      const metrics = Array.isArray(data) ? readMetrics(data) : null;
      if (!metrics) {
        // not published yet, deleted, or nothing reported so far
        await this._performanceRepository.markChecked(orgId, post.id, postId);
        return;
      }
      await this._performanceRepository.saveResult(orgId, post.id, postId, metrics);
    } catch (e) {
      this._logger.warn(`Could not read results for post=${postId} org=${orgId}: ${(e as Error)?.message}`);
      try {
        await this._performanceRepository.markChecked(orgId, post.id, postId);
      } catch {
        // checked again on the next visit
      }
    }
  }

  async summary(orgId: string, now = Date.now()) {
    const tz = captionTimezone();
    const posts = await this._performanceRepository.approvedPosts(orgId, new Date(now - LOOK_BACK_MS));
    const results = new Map(
      (posts.length ? await this._performanceRepository.results(orgId, posts.map((p) => p.id)) : []).map((r) => [
        r.draftId,
        r,
      ])
    );
    const measured: MeasuredPost[] = posts.flatMap((p) => {
      const r = results.get(p.id);
      if (!r || r.interactions === null) return [];
      return [
        {
          draftId: p.id,
          platform: p.platform,
          scheduledFor: p.scheduledFor,
          theme: p.theme,
          facts: (p.facts || []) as { field?: string }[],
          graphicLayout: p.graphicLayout,
          hadGraphic: !!p.graphicPath,
          reach: r.reach,
          interactions: r.interactions,
          simulated: r.simulated,
        },
      ];
    });

    // Real results only, as soon as there are any. Simulated results are only
    // used while nothing real exists, and are labelled as such.
    const real = measured.filter((p) => !p.simulated);
    const simulated = real.length === 0 && measured.length > 0;
    const used = real.length ? real : measured;
    const insights = summarise(used, tz);
    const preferences = preferencesFrom(insights, simulated, used.length);

    return {
      source: used.length ? (simulated ? 'simulated' : 'real') : null,
      timezone: tz,
      approvedPosts: posts.length,
      measuredPosts: used.length,
      // simulated results left out because real ones exist
      simulatedLeftOut: real.length ? measured.length - real.length : 0,
      minPosts: MIN_MEASURED_POSTS,
      minGroupPosts: MIN_GROUP_POSTS,
      enough: insights.enough,
      dimensions: insights.dimensions,
      platforms: insights.platforms,
      preferences: preferences
        ? { ...preferences, applied: !preferences.simulated || isSandboxEnabled() }
        : null,
      recent: used.slice(0, 10).map((p) => ({
        draftId: p.draftId,
        scheduledFor: p.scheduledFor,
        platform: p.platform,
        theme: p.theme,
        kind: kindLabel(postKind(p.facts)),
        reach: p.reach,
        interactions: p.interactions,
        simulated: p.simulated,
      })),
    };
  }
}
