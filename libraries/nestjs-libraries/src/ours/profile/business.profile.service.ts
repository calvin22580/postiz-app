// OURS: builds a business profile from a website. The build runs in the
// background: crawl → extract (AI or demo) → keep only sourced claims → save.
// The screen polls the profile to show progress.
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { OursProfileStatus, Prisma } from '@prisma/client';
import {
  BusinessProfileRepository,
  StoredBusinessProfile,
} from '@gitroom/nestjs-libraries/ours/profile/business.profile.repository';
import { AiUsageService } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import {
  CrawlError,
  WebsiteCrawler,
} from '@gitroom/nestjs-libraries/ours/crawler/website.crawler';
import {
  assertPublicUrl,
  normaliseWebsiteUrl,
  UnsafeUrlError,
} from '@gitroom/nestjs-libraries/ours/crawler/url.safety';
import {
  emptyFields,
  PROFILE_FIELDS,
  ProfileClaim,
  ProfileFieldKey,
  ProfileFields,
} from '@gitroom/nestjs-libraries/ours/profile/business.profile.fields';
import {
  groundExtraction,
  normaliseForMatch,
} from '@gitroom/nestjs-libraries/ours/profile/profile.grounding';
import {
  ExtractionError,
  ProfileExtractor,
} from '@gitroom/nestjs-libraries/ours/profile/extractors/profile.extractor';
import {
  AnthropicProfileExtractor,
  ExtractionWithUsageError,
} from '@gitroom/nestjs-libraries/ours/profile/extractors/anthropic.profile.extractor';
import { DemoProfileExtractor } from '@gitroom/nestjs-libraries/ours/profile/extractors/demo.profile.extractor';

export const PROFILE_FEATURE = 'business_profile';
const STALE_AFTER_MS = 10 * 60 * 1000;

export const createProfileExtractor = (): ProfileExtractor =>
  process.env.ANTHROPIC_API_KEY
    ? new AnthropicProfileExtractor()
    : new DemoProfileExtractor();

const isBuilding = (status: OursProfileStatus) =>
  status === OursProfileStatus.CRAWLING ||
  status === OursProfileStatus.EXTRACTING;

@Injectable()
export class BusinessProfileService {
  private _logger = new Logger(BusinessProfileService.name);

  constructor(
    private _businessProfileRepository: BusinessProfileRepository,
    private _aiUsageService: AiUsageService,
    private _websiteCrawler: WebsiteCrawler
  ) {}

  async getProfile(orgId: string) {
    const profile = await this._businessProfileRepository.getProfile(orgId);
    if (!profile) {
      return { profile: null };
    }
    if (
      isBuilding(profile.status) &&
      profile.buildStartedAt &&
      Date.now() - profile.buildStartedAt.getTime() > STALE_AFTER_MS
    ) {
      await this._businessProfileRepository.failBuild(
        orgId,
        'Reading your website took too long. Please try again.'
      );
      return this.getProfile(orgId);
    }
    return { profile: this.present(profile) };
  }

  async startBuild(orgId: string, rawUrl: string) {
    let url: URL;
    try {
      url = normaliseWebsiteUrl(rawUrl);
      await assertPublicUrl(url);
    } catch (e) {
      if (e instanceof UnsafeUrlError) {
        throw new HttpException(e.message, 400);
      }
      throw e;
    }

    const current = (await this.getProfile(orgId)).profile;
    if (current && isBuilding(current.status as OursProfileStatus)) {
      return { profile: current };
    }

    const started = await this._businessProfileRepository.startBuild(
      orgId,
      url.toString()
    );
    // background: the request returns now, the screen polls for progress
    this.runBuild(orgId, url, this.asFields(current?.fields)).catch((e) =>
      this._logger.error(`Profile build crashed for org=${orgId}: ${e?.message}`)
    );
    return { profile: this.present(started) };
  }

  async runBuild(
    orgId: string,
    url: URL,
    previous: ProfileFields | null,
    extractor: ProfileExtractor = createProfileExtractor()
  ) {
    try {
      const crawl = await this._websiteCrawler.crawl(url, {
        onProgress: async (p) => {
          await this._businessProfileRepository.updateProgress(
            orgId,
            OursProfileStatus.CRAWLING,
            { ...p }
          );
        },
      });

      await this._businessProfileRepository.updateProgress(
        orgId,
        OursProfileStatus.EXTRACTING,
        { stage: 'writing', done: crawl.pages.length, total: crawl.pages.length }
      );

      let output;
      try {
        output = await extractor.extract(crawl.pages);
      } catch (e) {
        if (e instanceof ExtractionWithUsageError) {
          await this.logUsages(orgId, e.usages);
        }
        throw e;
      }
      await this.logUsages(orgId, output.usages);

      const grounded = groundExtraction(output.raw, crawl.pages);
      this._logger.log(
        `Profile for org=${orgId}: kept ${grounded.kept} claims, dropped ${grounded.dropped} without a valid source`
      );

      // owner edits survive a rebuild
      const fields = grounded.fields;
      for (const def of PROFILE_FIELDS) {
        if (previous?.[def.key]?.ownerEdited) {
          fields[def.key] = previous[def.key];
        }
      }

      await this._businessProfileRepository.finishBuild(orgId, {
        fields: fields as unknown as Prisma.InputJsonValue,
        pages: crawl.pages.map((p) => ({ url: p.url, title: p.title })),
        extractor: extractor.name,
      });
    } catch (e) {
      const known =
        e instanceof CrawlError ||
        e instanceof UnsafeUrlError ||
        e instanceof ExtractionError;
      if (!known) {
        this._logger.error(`Profile build failed for org=${orgId}: ${(e as Error)?.stack}`);
      }
      await this._businessProfileRepository.failBuild(
        orgId,
        known
          ? (e as Error).message
          : 'Something went wrong while reading your website. Please try again.'
      );
    }
  }

  async updateField(orgId: string, key: ProfileFieldKey, values: string[]) {
    const current = await this._businessProfileRepository.getProfile(orgId);
    if (!current || current.status !== OursProfileStatus.READY) {
      throw new HttpException('There is no finished profile to edit yet.', 400);
    }
    const def = PROFILE_FIELDS.find((f) => f.key === key)!;
    const fields = this.asFields(current.fields);
    const existing = fields[key].claims;

    const cleaned = Array.from(
      new Map(
        values
          .map((v) => v.trim())
          .filter(Boolean)
          .map((v) => [normaliseForMatch(v), v] as const)
      ).values()
    ).slice(0, def.multiple ? 50 : 1);

    const claims: ProfileClaim[] = cleaned.map(
      (value) =>
        existing.find(
          (c) => normaliseForMatch(c.value) === normaliseForMatch(value)
        ) || { value, origin: 'owner', sources: [] }
    );
    fields[key] = { claims, ownerEdited: true };

    const saved = await this._businessProfileRepository.saveFields(
      orgId,
      fields as unknown as Prisma.InputJsonValue
    );
    return { profile: this.present(saved) };
  }

  private async logUsages(
    orgId: string,
    usages: Parameters<AiUsageService['logCall']>[2][]
  ) {
    for (const usage of usages) {
      await this._aiUsageService.logCall(orgId, PROFILE_FEATURE, usage);
    }
  }

  private asFields(raw: unknown): ProfileFields {
    const fields = emptyFields();
    const stored = (raw || {}) as Partial<ProfileFields>;
    for (const def of PROFILE_FIELDS) {
      if (stored[def.key]?.claims) {
        fields[def.key] = stored[def.key]!;
      }
    }
    return fields;
  }

  private present(profile: StoredBusinessProfile) {
    return {
      websiteUrl: profile.websiteUrl,
      status: profile.status,
      progress: profile.progress,
      errorMessage: profile.errorMessage,
      fields: this.asFields(profile.fields),
      pages: profile.pages,
      demo: profile.extractor === 'demo',
      updatedAt: profile.updatedAt,
    };
  }
}
