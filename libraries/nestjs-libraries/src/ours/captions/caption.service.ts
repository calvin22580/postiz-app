// OURS: a week of captions from the business profile. Writing runs in the
// background: profile facts → writer (AI or demo) → keep only captions whose
// details are all in the profile → save as drafts waiting for approval.
// Nothing is scheduled until the owner approves a caption, and in this
// milestone a caption can only be scheduled on a Sandbox channel.
import { HttpException, Injectable, Logger } from '@nestjs/common';
import {
  CreationMethod,
  OursCaptionStatus,
  OursCaptionWeekStatus,
  Prisma,
} from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { CreatePostDto } from '@gitroom/nestjs-libraries/dtos/posts/create.post.dto';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { AiUsageService } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import { BusinessProfileService } from '@gitroom/nestjs-libraries/ours/profile/business.profile.service';
import { ProfileFields } from '@gitroom/nestjs-libraries/ours/profile/business.profile.fields';
import {
  CaptionRepository,
  StoredCaptionDraft,
  StoredCaptionWeek,
} from '@gitroom/nestjs-libraries/ours/captions/caption.repository';
import {
  CAPTION_PLATFORMS,
  CaptionFact,
  CaptionPlatform,
  captionTimezone,
  factsFromProfile,
  hasEnoughToWrite,
  isSeasonalFact,
  nextWeekStart,
  POSTING_DAYS,
  scheduledFor,
  toneFromProfile,
  weekPlatforms,
} from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import {
  groundCaptions,
  unsupportedDetails,
  withoutCitedDates,
} from '@gitroom/nestjs-libraries/ours/captions/caption.grounding';
import {
  CaptionWriter,
  CaptionWriterError,
  CaptionWriterWithUsageError,
} from '@gitroom/nestjs-libraries/ours/captions/writers/caption.writer';
import { AnthropicCaptionWriter } from '@gitroom/nestjs-libraries/ours/captions/writers/anthropic.caption.writer';
import { DemoCaptionWriter } from '@gitroom/nestjs-libraries/ours/captions/writers/demo.caption.writer';
import {
  applyChecks,
  CaptionChecker,
  CaptionCheckerError,
  captionsToCheck,
} from '@gitroom/nestjs-libraries/ours/captions/checkers/caption.checker';
import { AnthropicCaptionChecker } from '@gitroom/nestjs-libraries/ours/captions/checkers/anthropic.caption.checker';
import { DemoCaptionChecker } from '@gitroom/nestjs-libraries/ours/captions/checkers/demo.caption.checker';
import { RawCaptionPlan } from '@gitroom/nestjs-libraries/ours/captions/writers/caption.writer';
import {
  isSandboxEnabled,
  SANDBOX_IDENTIFIER,
} from '@gitroom/nestjs-libraries/ours/sandbox/sandbox.config';
import { GraphicService } from '@gitroom/nestjs-libraries/ours/graphics/graphic.service';
import {
  GRAPHIC_SIZES,
  graphicContent,
  GraphicLayout,
  isGraphicLayout,
  layoutForDay,
  NO_GRAPHIC,
} from '@gitroom/nestjs-libraries/ours/graphics/graphic.content';
import { SeasonalService } from '@gitroom/nestjs-libraries/ours/seasonal/seasonal.service';
import { PlanService, UsageTicket } from '@gitroom/nestjs-libraries/ours/plans/plan.service';
import { PerformanceService } from '@gitroom/nestjs-libraries/ours/performance/performance.service';
import { WriterPreferences } from '@gitroom/nestjs-libraries/ours/performance/performance.insights';
import { BrandSignalService } from '@gitroom/nestjs-libraries/ours/memory/brand.signal.service';
import { RejectReason } from '@gitroom/nestjs-libraries/ours/memory/brand.signal';

dayjs.extend(utc);
dayjs.extend(timezone);

export const CAPTIONS_FEATURE = 'captions';
export const CAPTION_REWRITE_FEATURE = 'caption-rewrite';
// Content engine E2: the Checker's calls, for a week and for a rewrite
export const CAPTION_CHECK_FEATURE = 'captions.check';
// Each AI rewrite is a billed call, so a caption can be rewritten a few times
// only; after that the owner can still edit it themselves.
export const MAX_REWRITES = 5;
const STALE_AFTER_MS = 10 * 60 * 1000;
// Leave the scheduler a little time to pick a post up.
const MIN_LEAD_MS = 5 * 60 * 1000;

export const captionWriterName = (): CaptionWriter['name'] =>
  process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'demo';

export const createCaptionWriter = (): CaptionWriter =>
  captionWriterName() === 'anthropic'
    ? new AnthropicCaptionWriter()
    : new DemoCaptionWriter();

// Content engine E2: the Checker runs only when switched on, and stays off
// until the test set shows it helps (ours/docs/content-engine.md).
export const createCaptionChecker = (): CaptionChecker | null =>
  process.env.OURS_CAPTION_CHECKER !== 'true'
    ? null
    : captionWriterName() === 'anthropic'
    ? new AnthropicCaptionChecker()
    : new DemoCaptionChecker();

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The post editor stores HTML paragraphs; captions are plain text.
export const captionToHtml = (text: string) =>
  text
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');

// What a draft keeps of each fact it used: a UK date keeps its source, so the
// screen can link to it.
const storedFact = (f: CaptionFact) => ({
  id: f.id,
  field: f.field,
  value: f.value,
  ...(f.label ? { label: f.label } : {}),
  ...(f.date ? { date: f.date } : {}),
  ...(f.source ? { source: f.source } : {}),
});

// Content engine E1: which post a signal is about.
const signalTarget = (d: Pick<StoredCaptionDraft, 'id' | 'weekId' | 'platform' | 'theme'>) => ({
  draftId: d.id,
  weekId: d.weekId,
  platform: d.platform,
  theme: d.theme,
});

// The posting days of a week as dates, for the writer (YYYY-MM-DD).
const postingDates = (weekStart: string) =>
  POSTING_DAYS.map((_, i) => dayjs(weekStart).add(i, 'day').format('YYYY-MM-DD'));

@Injectable()
export class CaptionService {
  private _logger = new Logger(CaptionService.name);

  constructor(
    private _captionRepository: CaptionRepository,
    private _businessProfileService: BusinessProfileService,
    private _aiUsageService: AiUsageService,
    private _integrationService: IntegrationService,
    private _postsService: PostsService,
    private _graphicService: GraphicService,
    private _seasonalService: SeasonalService,
    private _planService: PlanService,
    private _performanceService: PerformanceService,
    private _brandSignalService: BrandSignalService
  ) {}

  async getWeek(orgId: string) {
    const nextWeek = nextWeekStart(captionTimezone());
    let week = await this._captionRepository.latestWeek(orgId);
    if (!week) {
      return { week: null, nextWeekStart: nextWeek };
    }
    if (
      week.status === OursCaptionWeekStatus.WRITING &&
      Date.now() - week.startedAt.getTime() > STALE_AFTER_MS
    ) {
      const errorMessage = 'Writing your captions took too long. Please try again.';
      await this._captionRepository.failWeek(orgId, week.id, errorMessage);
      week = { ...week, status: OursCaptionWeekStatus.FAILED, errorMessage };
    }
    const drafts =
      week.status === OursCaptionWeekStatus.READY
        ? await this._captionRepository.getDrafts(orgId, week.id)
        : [];
    // graphics fall back to a layout the profile can fill, so show that one
    const profile = drafts.length
      ? (await this._businessProfileService.getProfile(orgId)).profile
      : null;
    return { week: this.present(week, drafts, profile), nextWeekStart: nextWeek };
  }

  async startWriting(orgId: string) {
    const { profile } = await this._businessProfileService.getProfile(orgId);
    if (!profile || profile.status !== 'READY') {
      throw new HttpException(
        'Set up your business profile first, so we know what to write about.',
        400
      );
    }
    const facts = factsFromProfile(profile.fields);
    if (!hasEnoughToWrite(facts)) {
      throw new HttpException(
        'Add your business name and what you do or offer to your profile first.',
        400
      );
    }

    const tz = captionTimezone();
    const weekStart = nextWeekStart(tz);
    const current = (await this.getWeek(orgId)).week;
    if (current?.status === OursCaptionWeekStatus.WRITING) {
      return this.getWeek(orgId);
    }
    if (
      current?.status === OursCaptionWeekStatus.READY &&
      current.weekStart === weekStart
    ) {
      throw new HttpException('Next week’s captions are already written.', 400);
    }

    // Milestone 7: one week from the plan's monthly allowance
    const ticket = await this._planService.claim(orgId, 'captionWeeks');
    let week;
    let seasonal: CaptionFact[];
    let preferences: WriterPreferences | null = null;
    let platforms: CaptionPlatform[];
    try {
      platforms = await this.platformsForWeek(orgId);
      week = await this._captionRepository.claimWeek(orgId, weekStart, tz);
      // Milestone 6: UK dates that fit this week, if the owner wants them
      seasonal = week ? await this.seasonalFacts(orgId, weekStart) : [];
      // Milestone 8: kinds of post that clearly did better or worse before
      preferences = week ? await this._performanceService.writerPreferences(orgId) : null;
    } catch (e) {
      await this._planService.giveBack(orgId, ticket);
      throw e;
    }
    if (!week) {
      // another request started (or finished) this week first
      await this._planService.giveBack(orgId, ticket);
      return this.getWeek(orgId);
    }
    // background: the request returns now, the screen polls for progress
    this.runWriting(orgId, week, [...facts, ...seasonal], toneFromProfile(profile.fields), undefined, ticket, preferences, platforms).catch(
      (e) =>
        this._logger.error(`Caption writing crashed for org=${orgId}: ${e?.message}`)
    );
    return this.getWeek(orgId);
  }

  async runWriting(
    orgId: string,
    week: Pick<StoredCaptionWeek, 'id' | 'weekStart' | 'timezone'>,
    facts: CaptionFact[],
    tone: string,
    writer: CaptionWriter = createCaptionWriter(),
    ticket?: UsageTicket,
    preferences?: WriterPreferences | null,
    // the platforms the plan includes; all of them when not given
    platforms?: CaptionPlatform[],
    checker: CaptionChecker | null = createCaptionChecker()
  ) {
    try {
      let output;
      try {
        output = await writer.write({
          facts,
          tone,
          days: [...POSTING_DAYS],
          dates: postingDates(week.weekStart),
          ...(preferences ? { preferences } : {}),
          ...(platforms ? { platforms } : {}),
        });
      } catch (e) {
        if (e instanceof CaptionWriterWithUsageError) {
          await this.logUsages(orgId, e.usages);
        }
        throw e;
      }
      await this.logUsages(orgId, output.usages);
      const raw = await this.check(orgId, output.raw, facts, checker);

      const { captions, dropped, reasons } = groundCaptions(
        raw,
        facts,
        POSTING_DAYS.length,
        platforms
      );
      this._logger.log(
        `Captions for org=${orgId}: kept ${captions.length}, dropped ${dropped}${reasons.length ? ` (${reasons.join('; ')})` : ''}`
      );
      if (!captions.length) {
        throw new CaptionWriterError(
          'We couldn’t write captions we were sure about. Add more detail to your profile and try again.'
        );
      }

      const saved = await this._captionRepository.finishWeek(orgId, week.id, {
        writer: writer.name,
        droppedCount: dropped,
        ...(preferences ? { preferences: preferences as unknown as Prisma.InputJsonValue } : {}),
        drafts: captions.map((c) => ({
          platform: c.platform,
          scheduledFor: scheduledFor(week.weekStart, c.day, c.platform, week.timezone),
          theme: c.theme,
          text: c.text,
          facts: c.facts.map(storedFact),
        })),
      });
      if (!saved) {
        this._logger.warn(`Caption week ${week.id} for org=${orgId} was no longer being written; results discarded`);
      }
    } catch (e) {
      // a week that wasn't written doesn't count towards the plan
      await this._planService.giveBack(orgId, ticket);
      const known = e instanceof CaptionWriterError;
      if (!known) {
        this._logger.error(`Caption writing failed for org=${orgId}: ${(e as Error)?.stack}`);
      }
      await this._captionRepository.failWeek(
        orgId,
        week.id,
        known
          ? (e as Error).message
          : 'Something went wrong while writing your captions. Please try again.'
      );
    }
  }

  // Milestone 7: a week is written only for as many platforms as the plan
  // includes, preferring the ones the business has connected.
  async platformsForWeek(orgId: string) {
    const [{ plan }, channels] = await Promise.all([
      this._planService.current(orgId),
      this._integrationService.getIntegrationsList(orgId),
    ]);
    return weekPlatforms(
      plan.limits.platforms,
      channels.filter((c) => !c.disabled).map((c) => c.providerIdentifier)
    );
  }

  // Channels a caption may be scheduled on. Only Sandbox channels for now:
  // real accounts come with the review screen.
  async getChannels(orgId: string) {
    if (!isSandboxEnabled()) {
      return { sandboxEnabled: false, channels: [] };
    }
    const list = await this._integrationService.getIntegrationsList(orgId);
    return {
      sandboxEnabled: true,
      channels: list
        .filter(
          (i) =>
            i.providerIdentifier === SANDBOX_IDENTIFIER &&
            !i.disabled &&
            !i.inBetweenSteps &&
            !i.refreshNeeded
        )
        .map((i) => ({ id: i.id, name: i.name })),
    };
  }

  async approve(orgId: string, draftId: string, integrationId: string) {
    const draft = await this._captionRepository.getDraft(orgId, draftId);
    if (!draft) {
      throw new HttpException('Caption not found', 404);
    }
    if (draft.status === OursCaptionStatus.REJECTED) {
      throw new HttpException('This post was rejected. Bring it back first.', 400);
    }
    if (draft.status !== OursCaptionStatus.PENDING_APPROVAL) {
      throw new HttpException('This caption is already approved.', 400);
    }
    if (draft.scheduledFor.getTime() < Date.now() + MIN_LEAD_MS) {
      throw new HttpException('The planned time for this caption has passed.', 400);
    }
    const channel = (await this.getChannels(orgId)).channels.find(
      (c) => c.id === integrationId
    );
    if (!channel) {
      throw new HttpException(
        'Choose a Sandbox channel. Scheduling to real social media accounts is not switched on yet.',
        400
      );
    }
    // Milestone 7: one scheduled post from the plan's monthly allowance
    const ticket = await this._planService.claim(orgId, 'postsScheduled');
    if (!(await this._captionRepository.claimForApproval(orgId, draftId, channel.id, draft.text))) {
      await this._planService.giveBack(orgId, ticket);
      throw new HttpException('This post was approved or changed a moment ago. Please check it and try again.', 409);
    }

    let postId: string | undefined;
    let graphicPath: string | null = null;
    let mediaId: string | null = null;
    try {
      // the graphic is drawn now, from the profile and brand kit as they are,
      // and saved to the media library so the post carries it
      const image = [] as { id: string; path: string }[];
      const graphic = await this.renderDraftGraphic(orgId, draft);
      if (graphic) {
        const media = await this._graphicService.saveToMediaLibrary(orgId, graphic.png);
        image.push(media);
        graphicPath = media.path;
        mediaId = media.id;
      }
      const body = await this._postsService.mapTypeToPost(
        {
          type: 'schedule',
          shortLink: false,
          date: dayjs.utc(draft.scheduledFor).format('YYYY-MM-DDTHH:mm:ss'),
          tags: [],
          posts: [
            {
              integration: { id: channel.id },
              group: makeId(10),
              settings: { __type: SANDBOX_IDENTIFIER },
              value: [
                { id: makeId(10), content: captionToHtml(draft.text), delay: 0, image },
              ],
            },
          ],
        } as unknown as CreatePostDto,
        orgId
      );
      const [validation] = await this._postsService.validatePosts(orgId, body.posts);
      if (!validation?.valid || validation.errors !== true || validation.tooLong || validation.emptyContent) {
        throw new Error(`post validation failed: ${validation?.errors}`);
      }
      const [created] = await this._postsService.createPost(
        orgId,
        body,
        CreationMethod.WEB
      );
      postId = created?.postId;
      if (!postId) {
        throw new Error('no post was created');
      }
    } catch (e) {
      this._logger.error(
        `Scheduling approved caption failed for org=${orgId} draft=${draftId}: ${(e as Error)?.message}`
      );
      // no post carries the graphic: take it out of the media library again,
      // so retries don't leave copies behind
      if (mediaId) {
        await this._graphicService.removeFromMediaLibrary(orgId, mediaId);
      }
      await this._captionRepository.releaseApproval(orgId, draftId);
      await this._planService.giveBack(orgId, ticket);
      throw new HttpException('We couldn’t schedule this caption. Please try again.', 400);
    }
    // the post exists now: never put the caption back to waiting, or a retry
    // would schedule it twice
    try {
      await this._captionRepository.setPostId(orgId, draftId, postId, graphicPath);
    } catch (e) {
      this._logger.error(
        `Could not link post=${postId} to caption draft=${draftId} for org=${orgId}: ${(e as Error)?.message}`
      );
    }
    // Content engine E1: approved as written, or after the owner's own changes
    await this._brandSignalService.record(orgId, {
      kind: 'approved',
      ...signalTarget(draft),
      after: draft.text,
      edited: !!draft.editedAt,
    });
    return this.getWeek(orgId);
  }

  // Milestone 5: the owner rewrites a caption in their own words. It is their
  // claim about their own business, so it is not dropped like AI text, but
  // the screen points out details the profile doesn't have (see present()).
  async editText(orgId: string, draftId: string, text: string) {
    const draft = await this.waitingDraft(orgId, draftId);
    const clean = text.replace(/\r\n/g, '\n').trim();
    const maxLength =
      CAPTION_PLATFORMS.find((p) => p.key === draft.platform)?.maxLength || 0;
    if (!clean) {
      throw new HttpException('Write something for this post, or reject it.', 400);
    }
    if (clean.length > maxLength) {
      throw new HttpException(
        `This post is too long. Keep it under ${maxLength} characters.`,
        400
      );
    }
    if (!(await this._captionRepository.editText(orgId, draftId, clean))) {
      throw new HttpException('This post can only be changed while it is waiting for your approval.', 400);
    }
    // Content engine E1: keep what the text was, so the change can be learnt
    // from (the draft itself only keeps the latest text)
    if (clean !== draft.text) {
      await this._brandSignalService.record(orgId, {
        kind: 'edited',
        ...signalTarget(draft),
        before: draft.text,
        after: clean,
        edited: !!draft.editedAt,
      });
    }
    return this.getWeek(orgId);
  }

  // A rejected caption is never scheduled. It stays on the screen, so the
  // owner can bring it back.
  async reject(orgId: string, draftId: string) {
    const draft = await this.waitingDraft(orgId, draftId);
    if (!(await this._captionRepository.reject(orgId, draftId))) {
      throw new HttpException('This post can only be rejected while it is waiting for your approval.', 400);
    }
    await this._brandSignalService.record(orgId, {
      kind: 'rejected',
      ...signalTarget(draft),
      before: draft.text,
      edited: !!draft.editedAt,
    });
    return this.getWeek(orgId);
  }

  // Content engine E1: the owner's optional one-tap reason, given after
  // rejecting. Choosing again replaces the reason on the post; each choice
  // is kept as a signal.
  async setRejectReason(orgId: string, draftId: string, reason: RejectReason) {
    const draft = await this._captionRepository.getDraft(orgId, draftId);
    if (!draft) {
      throw new HttpException('Caption not found', 404);
    }
    if (!(await this._captionRepository.setRejectReason(orgId, draftId, reason))) {
      throw new HttpException('You can only say why for a post you rejected.', 400);
    }
    await this._brandSignalService.record(orgId, {
      kind: 'reject-reason',
      ...signalTarget(draft),
      reason,
    });
    return this.getWeek(orgId);
  }

  async restore(orgId: string, draftId: string) {
    const draft = await this._captionRepository.getDraft(orgId, draftId);
    if (!draft) {
      throw new HttpException('Caption not found', 404);
    }
    if (!(await this._captionRepository.restore(orgId, draftId))) {
      throw new HttpException('Only a rejected post can be brought back.', 400);
    }
    await this._brandSignalService.record(orgId, {
      kind: 'restored',
      ...signalTarget(draft),
    });
    return this.getWeek(orgId);
  }

  // A new version of one caption, from the profile as it is now. The new text
  // goes through the same checks as the week; if it fails them the current
  // version is kept. Every call is logged against the organisation.
  async rewrite(
    orgId: string,
    draftId: string,
    note?: string,
    writer: CaptionWriter = createCaptionWriter(),
    checker: CaptionChecker | null = createCaptionChecker()
  ) {
    const draft = await this.waitingDraft(orgId, draftId);
    const { profile } = await this._businessProfileService.getProfile(orgId);
    if (!profile || profile.status !== 'READY') {
      throw new HttpException('Your business profile is being updated. Try again when it is ready.', 400);
    }
    const fields = profile.fields as ProfileFields;
    const week = await this._captionRepository.getWeek(orgId, draft.weekId);
    const local = dayjs(draft.scheduledFor).tz(week?.timezone || captionTimezone());
    const facts = [
      ...factsFromProfile(fields),
      ...(week ? await this.seasonalFacts(orgId, week.weekStart) : []),
    ];
    // Milestone 7: one rewrite from the plan's monthly allowance, on top of
    // the per-post cap
    const ticket = await this._planService.claim(orgId, 'rewrites');
    if (!(await this._captionRepository.claimRewrite(orgId, draftId, MAX_REWRITES))) {
      await this._planService.giveBack(orgId, ticket);
      throw new HttpException(
        `This post has already been rewritten ${MAX_REWRITES} times. You can still edit it yourself.`,
        400
      );
    }

    let output;
    try {
      output = await writer.rewrite({
        facts,
        tone: toneFromProfile(fields),
        day: local.format('dddd'),
        date: local.format('YYYY-MM-DD'),
        platform: draft.platform as CaptionPlatform,
        theme: draft.theme,
        current: draft.text,
        note,
        attempt: draft.rewriteCount,
      });
    } catch (e) {
      if (e instanceof CaptionWriterWithUsageError) {
        await this.logUsages(orgId, e.usages, CAPTION_REWRITE_FEATURE);
      } else {
        // nothing was billed (busy service, network, demo has no other
        // version), so the owner keeps this rewrite
        await this._captionRepository.giveBackRewrite(orgId, draftId).catch(() => undefined);
        await this._planService.giveBack(orgId, ticket);
      }
      if (e instanceof CaptionWriterError) {
        throw new HttpException(e.message, 400);
      }
      this._logger.error(`Caption rewrite failed for org=${orgId} draft=${draftId}: ${(e as Error)?.stack}`);
      throw new HttpException('Something went wrong while writing a new version. Please try again.', 400);
    }
    await this.logUsages(orgId, output.usages, CAPTION_REWRITE_FEATURE);
    const raw = await this.check(orgId, output.raw, facts, checker);

    const { captions, reasons } = groundCaptions(raw, facts, 1);
    const fresh = captions.find((c) => c.platform === draft.platform);
    // Content engine E1: the owner asked for a change, whether or not a new
    // version was kept (after is empty when it wasn't)
    const signal = (after: string | null) =>
      this._brandSignalService.record(orgId, {
        kind: 'rewrite',
        ...signalTarget(draft),
        before: draft.text,
        after,
        note: note?.trim() || null,
        edited: !!draft.editedAt,
      });
    if (!fresh || fresh.text === draft.text) {
      await signal(null);
      this._logger.log(
        `Caption rewrite for org=${orgId} draft=${draftId} not kept${reasons.length ? ` (${reasons.join('; ')})` : ''}`
      );
      throw new HttpException(
        'We couldn’t write a new version we were sure about, so we kept the current one. Try again, or edit it yourself.',
        400
      );
    }
    const saved = await this._captionRepository.saveRewrite(orgId, draftId, {
      text: fresh.text,
      facts: fresh.facts.map(storedFact),
    });
    await signal(saved ? fresh.text : null);
    if (!saved) {
      throw new HttpException('This post was approved or rejected while we were writing, so it was left as it is.', 409);
    }
    return this.getWeek(orgId);
  }

  private async waitingDraft(orgId: string, draftId: string) {
    const draft = await this._captionRepository.getDraft(orgId, draftId);
    if (!draft) {
      throw new HttpException('Caption not found', 404);
    }
    if (draft.status === OursCaptionStatus.APPROVED) {
      throw new HttpException('This post is already approved and scheduled.', 400);
    }
    if (draft.status === OursCaptionStatus.REJECTED) {
      throw new HttpException('Bring this post back first.', 400);
    }
    if (draft.scheduledFor.getTime() < Date.now() + MIN_LEAD_MS) {
      throw new HttpException('The planned time for this post has passed.', 400);
    }
    return draft;
  }

  // The layout a caption's graphic uses: the owner's choice, or one a day,
  // rotating through the layouts. Null means no graphic.
  graphicLayoutFor(draft: Pick<StoredCaptionDraft, 'graphicLayout' | 'scheduledFor'>): GraphicLayout | null {
    const weekday = dayjs(draft.scheduledFor).tz(captionTimezone()).day();
    return layoutForDay(draft.graphicLayout, (weekday + 6) % 7);
  }

  private renderDraftGraphic(orgId: string, draft: StoredCaptionDraft) {
    const layout = this.graphicLayoutFor(draft);
    if (!layout) {
      return Promise.resolve(null);
    }
    return this._graphicService.render(orgId, {
      platform: draft.platform as CaptionPlatform,
      layout,
      facts: (draft.facts || []) as { field: string; value: string }[],
    });
  }

  // A preview of a caption's graphic, drawn now. Once approved, the screen
  // shows the image that was attached instead.
  async getGraphic(orgId: string, draftId: string) {
    const draft = await this._captionRepository.getDraft(orgId, draftId);
    if (!draft) {
      throw new HttpException('Caption not found', 404);
    }
    const graphic = await this.renderDraftGraphic(orgId, draft);
    if (!graphic) {
      throw new HttpException('This post has no graphic', 404);
    }
    return graphic.png;
  }

  async setGraphicLayout(orgId: string, draftId: string, layout: string) {
    const stored = layout === 'auto' ? null : layout;
    if (stored !== null && stored !== NO_GRAPHIC && !isGraphicLayout(stored)) {
      throw new HttpException('Unknown layout', 400);
    }
    if (!(await this._captionRepository.getDraft(orgId, draftId))) {
      throw new HttpException('Caption not found', 404);
    }
    if (!(await this._captionRepository.setGraphicLayout(orgId, draftId, stored))) {
      throw new HttpException('The graphic can only be changed before the post is approved.', 400);
    }
    return this.getWeek(orgId);
  }

  // UK dates never stop captions being written: if they can't be read, the
  // week is written from the profile alone.
  private async seasonalFacts(orgId: string, weekStart: string) {
    try {
      return await this._seasonalService.factsForWeek(orgId, weekStart);
    } catch (e) {
      this._logger.error(`Could not read UK dates for org=${orgId}: ${(e as Error)?.message}`);
      return [];
    }
  }

  // Content engine E2: the Checker passes, fixes or drops each caption before
  // the hard rules. If the check itself fails, the captions go on to the hard
  // rules unchanged: those still run, and the owner still approves each post.
  private async check(
    orgId: string,
    raw: RawCaptionPlan,
    facts: CaptionFact[],
    checker: CaptionChecker | null
  ): Promise<RawCaptionPlan> {
    if (!checker) {
      return raw;
    }
    try {
      const output = await checker.check({ facts, captions: captionsToCheck(raw) });
      await this.logUsages(orgId, output.usages, CAPTION_CHECK_FEATURE);
      const checked = applyChecks(raw, output.results);
      this._logger.log(
        `Caption check for org=${orgId} (${checker.name}): fixed ${checked.fixed}, dropped ${checked.dropped}`
      );
      return checked.raw;
    } catch (e) {
      if (e instanceof CaptionCheckerError) {
        await this.logUsages(orgId, e.usages, CAPTION_CHECK_FEATURE);
      }
      this._logger.error(`Caption check skipped for org=${orgId}: ${(e as Error)?.message}`);
      return raw;
    }
  }

  private async logUsages(
    orgId: string,
    usages: Parameters<AiUsageService['logCall']>[2][],
    feature = CAPTIONS_FEATURE
  ) {
    for (const usage of usages) {
      await this._aiUsageService.logCall(orgId, feature, usage);
    }
  }

  private present(
    week: StoredCaptionWeek,
    drafts: StoredCaptionDraft[],
    profile?: { fields: unknown; updatedAt: Date | string } | null
  ) {
    const fields = profile?.fields as ProfileFields | undefined;
    const profileFacts = fields ? factsFromProfile(fields) : [];
    const drawnLayout = (d: StoredCaptionDraft) => {
      const wanted = this.graphicLayoutFor(d);
      if (!wanted || !fields) return null;
      return graphicContent(wanted, (d.facts || []) as { field: string; value: string }[], fields)?.layout || null;
    };
    return {
      id: week.id,
      weekStart: week.weekStart,
      timezone: week.timezone,
      status: week.status,
      errorMessage: week.errorMessage,
      demo: week.writer === 'demo',
      droppedCount: week.droppedCount,
      // Milestone 8: what past results steered this week towards
      preferences: (week.preferences || null) as Pick<WriterPreferences, 'favour' | 'avoid' | 'simulated' | 'basedOn'> | null,
      // rewrites come from the demo writer when no AI service is connected
      demoRewrites: captionWriterName() === 'demo',
      maxRewrites: MAX_REWRITES,
      // posts closer than this to their time can't be approved any more
      minLeadMs: MIN_LEAD_MS,
      captions: drafts.map((d) => ({
        id: d.id,
        platform: d.platform,
        scheduledFor: d.scheduledFor,
        theme: d.theme,
        text: d.text,
        facts: (d.facts || []) as Pick<CaptionFact, 'field' | 'value' | 'label' | 'source'>[],
        status: d.status,
        channelId: d.integrationId,
        postId: d.postId,
        approvedAt: d.approvedAt,
        editedAt: d.editedAt,
        rejectedAt: d.rejectedAt,
        rejectReason: d.rejectReason,
        rewritesLeft: Math.max(0, MAX_REWRITES - d.rewriteCount),
        maxLength: CAPTION_PLATFORMS.find((p) => p.key === d.platform)?.maxLength || 0,
        // details in the owner's own words that the profile doesn't have:
        // shown as a reminder to check, never removed
        notInProfile:
          d.editedAt && fields
            ? unsupportedDetails(
                withoutCitedDates(d.text, ((d.facts || []) as unknown as CaptionFact[]).filter(isSeasonalFact)),
                profileFacts
              )
            : [],
        graphic: {
          choice: d.graphicLayout || 'auto',
          layout: drawnLayout(d),
          size: GRAPHIC_SIZES[d.platform as CaptionPlatform] || null,
          // the image attached to the scheduled post, once approved
          path: d.graphicPath,
          // changes when the profile does, so previews redraw
          profileVersion: profile ? new Date(profile.updatedAt).getTime() : null,
        },
      })),
    };
  }
}
