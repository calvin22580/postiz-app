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
} from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { CreatePostDto } from '@gitroom/nestjs-libraries/dtos/posts/create.post.dto';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { AiUsageService } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import { BusinessProfileService } from '@gitroom/nestjs-libraries/ours/profile/business.profile.service';
import {
  CaptionRepository,
  StoredCaptionDraft,
  StoredCaptionWeek,
} from '@gitroom/nestjs-libraries/ours/captions/caption.repository';
import {
  CaptionFact,
  captionTimezone,
  factsFromProfile,
  hasEnoughToWrite,
  nextWeekStart,
  POSTING_DAYS,
  scheduledFor,
  toneFromProfile,
} from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import { groundCaptions } from '@gitroom/nestjs-libraries/ours/captions/caption.grounding';
import {
  CaptionWriter,
  CaptionWriterError,
  CaptionWriterWithUsageError,
} from '@gitroom/nestjs-libraries/ours/captions/writers/caption.writer';
import { AnthropicCaptionWriter } from '@gitroom/nestjs-libraries/ours/captions/writers/anthropic.caption.writer';
import { DemoCaptionWriter } from '@gitroom/nestjs-libraries/ours/captions/writers/demo.caption.writer';
import {
  isSandboxEnabled,
  SANDBOX_IDENTIFIER,
} from '@gitroom/nestjs-libraries/ours/sandbox/sandbox.config';

dayjs.extend(utc);

export const CAPTIONS_FEATURE = 'captions';
const STALE_AFTER_MS = 10 * 60 * 1000;
// Leave the scheduler a little time to pick a post up.
const MIN_LEAD_MS = 5 * 60 * 1000;

export const createCaptionWriter = (): CaptionWriter =>
  process.env.ANTHROPIC_API_KEY
    ? new AnthropicCaptionWriter()
    : new DemoCaptionWriter();

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The post editor stores HTML paragraphs; captions are plain text.
export const captionToHtml = (text: string) =>
  text
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');

@Injectable()
export class CaptionService {
  private _logger = new Logger(CaptionService.name);

  constructor(
    private _captionRepository: CaptionRepository,
    private _businessProfileService: BusinessProfileService,
    private _aiUsageService: AiUsageService,
    private _integrationService: IntegrationService,
    private _postsService: PostsService
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
    return { week: this.present(week, drafts), nextWeekStart: nextWeek };
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

    const week = await this._captionRepository.claimWeek(orgId, weekStart, tz);
    if (!week) {
      // another request started (or finished) this week first
      return this.getWeek(orgId);
    }
    // background: the request returns now, the screen polls for progress
    this.runWriting(orgId, week, facts, toneFromProfile(profile.fields)).catch(
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
    writer: CaptionWriter = createCaptionWriter()
  ) {
    try {
      let output;
      try {
        output = await writer.write({ facts, tone, days: [...POSTING_DAYS] });
      } catch (e) {
        if (e instanceof CaptionWriterWithUsageError) {
          await this.logUsages(orgId, e.usages);
        }
        throw e;
      }
      await this.logUsages(orgId, output.usages);

      const { captions, dropped } = groundCaptions(
        output.raw,
        facts,
        POSTING_DAYS.length
      );
      this._logger.log(
        `Captions for org=${orgId}: kept ${captions.length}, dropped ${dropped} with details not in the profile`
      );
      if (!captions.length) {
        throw new CaptionWriterError(
          'We couldn’t write captions we were sure about. Add more detail to your profile and try again.'
        );
      }

      const saved = await this._captionRepository.finishWeek(orgId, week.id, {
        writer: writer.name,
        droppedCount: dropped,
        drafts: captions.map((c) => ({
          platform: c.platform,
          scheduledFor: scheduledFor(week.weekStart, c.day, c.platform, week.timezone),
          theme: c.theme,
          text: c.text,
          facts: c.facts.map((f) => ({ id: f.id, field: f.field, value: f.value })),
        })),
      });
      if (!saved) {
        this._logger.warn(`Caption week ${week.id} for org=${orgId} was no longer being written; results discarded`);
      }
    } catch (e) {
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
    if (!(await this._captionRepository.claimForApproval(orgId, draftId, channel.id))) {
      throw new HttpException('This caption is already approved.', 409);
    }

    let postId: string | undefined;
    try {
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
                { id: makeId(10), content: captionToHtml(draft.text), delay: 0, image: [] },
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
      await this._captionRepository.releaseApproval(orgId, draftId);
      throw new HttpException('We couldn’t schedule this caption. Please try again.', 400);
    }
    // the post exists now: never put the caption back to waiting, or a retry
    // would schedule it twice
    try {
      await this._captionRepository.setPostId(orgId, draftId, postId);
    } catch (e) {
      this._logger.error(
        `Could not link post=${postId} to caption draft=${draftId} for org=${orgId}: ${(e as Error)?.message}`
      );
    }
    return this.getWeek(orgId);
  }

  private async logUsages(
    orgId: string,
    usages: Parameters<AiUsageService['logCall']>[2][]
  ) {
    for (const usage of usages) {
      await this._aiUsageService.logCall(orgId, CAPTIONS_FEATURE, usage);
    }
  }

  private present(week: StoredCaptionWeek, drafts: StoredCaptionDraft[]) {
    return {
      id: week.id,
      weekStart: week.weekStart,
      timezone: week.timezone,
      status: week.status,
      errorMessage: week.errorMessage,
      demo: week.writer === 'demo',
      droppedCount: week.droppedCount,
      captions: drafts.map((d) => ({
        id: d.id,
        platform: d.platform,
        scheduledFor: d.scheduledFor,
        theme: d.theme,
        text: d.text,
        facts: (d.facts || []) as { field: string; value: string }[],
        status: d.status,
        channelId: d.integrationId,
        postId: d.postId,
        approvedAt: d.approvedAt,
      })),
    };
  }
}
