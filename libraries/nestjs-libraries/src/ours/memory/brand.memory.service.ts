// OURS: content engine E4. Runs the Memory keeper before a week is written
// and gives the other steps the brand brief. Off unless OURS_BRAND_MEMORY is
// "true". Memory is a side step: if it fails, writing goes ahead with the
// lessons as they were, and the failure is logged only.
import { randomBytes } from 'node:crypto';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { AiUsageService } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import {
  brandBrief,
  lessonProblems,
  lessonStatus,
  MEMORY_ROOT,
  MemoryFolder,
  parseMemoryPath,
  SIGNAL_REF_LENGTH,
} from '@gitroom/nestjs-libraries/ours/memory/brand.memory';
import { BrandMemoryRepository } from '@gitroom/nestjs-libraries/ours/memory/brand.memory.repository';
import { MemoryWorkspace } from '@gitroom/nestjs-libraries/ours/memory/brand.memory.workspace';
import {
  MemoryKeeper,
  MemoryKeeperError,
} from '@gitroom/nestjs-libraries/ours/memory/keepers/memory.keeper';
import { AnthropicMemoryKeeper } from '@gitroom/nestjs-libraries/ours/memory/keepers/anthropic.memory.keeper';
import { PlainMemoryKeeper } from '@gitroom/nestjs-libraries/ours/memory/keepers/plain.memory.keeper';
import { DemoMemoryKeeper } from '@gitroom/nestjs-libraries/ours/memory/keepers/demo.memory.keeper';

export const MEMORY_FEATURE = 'memory-update';

// E5: how many of the owner's actions are shown under each lesson
export const EXAMPLES_PER_LESSON = 3;

// A lesson the owner writes goes in "avoid" when it tells us what not to do.
export const ownerLessonFolder = (lesson: string): MemoryFolder =>
  /^\s*(?:don'?t|do not|never|no|avoid|stop|leave out|skip)\b/i.test(lesson) ? 'avoid' : 'voice';

export const brandMemoryOn = () => process.env.OURS_BRAND_MEMORY === 'true';

// The keeper for this environment: the single-call version with an AI key
// (it matched or beat the memory tool version on the test set at half the
// cost; OURS_MEMORY_KEEPER=memory-tool swaps that one in), the labelled
// demo without one, none when memory is off.
export const createMemoryKeeper = (): MemoryKeeper | null =>
  !brandMemoryOn()
    ? null
    : !process.env.ANTHROPIC_API_KEY
    ? new DemoMemoryKeeper()
    : process.env.OURS_MEMORY_KEEPER === 'memory-tool'
    ? new AnthropicMemoryKeeper()
    : new PlainMemoryKeeper();

@Injectable()
export class BrandMemoryService {
  private _logger = new Logger(BrandMemoryService.name);

  constructor(
    private _brandMemoryRepository: BrandMemoryRepository,
    private _aiUsageService: AiUsageService
  ) {}

  // Learns from the owner actions since the last run. Never throws.
  async learn(orgId: string, keeper: MemoryKeeper | null = createMemoryKeeper()) {
    if (!keeper) return null;
    try {
      const signals = await this._brandMemoryRepository.newSignals(orgId);
      if (!signals.length) return null;
      const [lessons, switchedOff, known] = await Promise.all([
        this._brandMemoryRepository.lessons(orgId),
        this._brandMemoryRepository.switchedOff(orgId),
        this._brandMemoryRepository.signalRefs(orgId),
      ]);
      const workspace = new MemoryWorkspace(lessons, switchedOff, known);
      const lastSignalAt = signals[signals.length - 1].createdAt;
      try {
        const { summary, usages } = await keeper.keep({
          workspace,
          signals: signals.map((s) => ({ ...s, ref: s.id.slice(0, SIGNAL_REF_LENGTH).toLowerCase() })),
        });
        await this.logUsages(orgId, usages);
        const { saved, removed } = workspace.changes();
        await this._brandMemoryRepository.saveChanges(orgId, saved, removed);
        await this._brandMemoryRepository.logRun(orgId, {
          lastSignalAt,
          signalCount: signals.length,
          status: 'ok',
          keeper: keeper.name,
          changes: { saved: saved.map((l) => l.path), removed },
          refusals: workspace.refusals,
        });
        this._logger.log(
          `Brand memory for org=${orgId}: ${signals.length} actions, saved ${saved.length}, removed ${removed.length}, refused ${workspace.refusals.length}. ${summary}`
        );
        return { saved: saved.length, removed: removed.length, refused: workspace.refusals.length, summary };
      } catch (e) {
        if (e instanceof MemoryKeeperError) await this.logUsages(orgId, e.usages);
        await this._brandMemoryRepository.logRun(orgId, {
          lastSignalAt,
          signalCount: signals.length,
          status: 'failed',
          keeper: keeper.name,
          refusals: workspace.refusals,
          errorMessage: (e as Error)?.message,
        });
        throw e;
      }
    } catch (e) {
      this._logger.error(`Brand memory update failed for org=${orgId}: ${(e as Error)?.message}`);
      return null;
    }
  }

  // The lessons in use, as text for the writer, rewriter and Checker. Empty
  // when memory is off or has nothing to say.
  async brief(orgId: string, only?: MemoryFolder[]) {
    if (!brandMemoryOn()) return '';
    try {
      return brandBrief(await this._brandMemoryRepository.lessons(orgId), only);
    } catch (e) {
      this._logger.error(`Could not read brand memory for org=${orgId}: ${(e as Error)?.message}`);
      return '';
    }
  }

  // E5: the "What we've learned" screen. Each lesson with the owner actions
  // that taught it; switched-off lessons listed apart so they can come back.
  async overview(orgId: string) {
    const { lessons, lastRun } = await this._brandMemoryRepository.overview(orgId);
    const signals = await this._brandMemoryRepository.signalsByRefs(orgId, lessons.flatMap((l) => l.evidence));
    const shape = (l: (typeof lessons)[number]) => ({
      id: l.id,
      lesson: l.lesson,
      folder: l.path.split('/')[2],
      status: l.source === 'owner' ? 'active' : lessonStatus(l),
      source: l.source,
      examples: signals
        .filter((s) => l.evidence.some((ref) => s.id.toLowerCase().startsWith(ref)))
        .slice(0, EXAMPLES_PER_LESSON)
        .map(({ id: _id, ...s }) => s),
      changedAt: l.updatedAt,
    });
    return {
      on: brandMemoryOn(),
      lastRun,
      lessons: lessons.filter((l) => !l.offAt).map(shape),
      switchedOff: lessons.filter((l) => l.offAt).map((l) => ({ ...shape(l), offAt: l.offAt })),
    };
  }

  // The owner's own words. Facts about the business belong in the profile,
  // so the same checks as the keeper's lessons apply.
  async addLesson(orgId: string, text: string) {
    const folder = ownerLessonFolder(text);
    const lesson = this.ownerText(text, folder);
    const slug = lesson.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'lesson';
    const path = `${MEMORY_ROOT}/${folder}/owner-${slug}-${randomBytes(3).toString('hex')}.md`;
    return this._brandMemoryRepository.addOwnerLesson(orgId, path, lesson);
  }

  async editLesson(orgId: string, id: string, text: string) {
    const current = await this.findLesson(orgId, id);
    const where = parseMemoryPath(current.path);
    const lesson = this.ownerText(text, where?.kind === 'file' ? where.folder : 'voice');
    await this._brandMemoryRepository.editLesson(orgId, id, lesson);
  }

  async switchLesson(orgId: string, id: string, on: boolean) {
    await this.findLesson(orgId, id);
    await this._brandMemoryRepository.setOff(orgId, id, !on);
  }

  async deleteLesson(orgId: string, id: string) {
    await this.findLesson(orgId, id);
    await this._brandMemoryRepository.deleteLesson(orgId, id);
  }

  private async findLesson(orgId: string, id: string) {
    const lesson = await this._brandMemoryRepository.ownerLesson(orgId, id);
    if (!lesson) throw new HttpException('That lesson no longer exists.', 404);
    return lesson;
  }

  private ownerText(text: string, folder: MemoryFolder) {
    const lesson = text.replace(/\s+/g, ' ').trim();
    const problems = lessonProblems(lesson, folder);
    if (problems.some((p) => p.startsWith('it is longer'))) {
      throw new HttpException('Please keep it shorter: one sentence works best.', 400);
    }
    if (problems.length) {
      throw new HttpException(
        'That sounds like a detail about your business, such as a price, a date or a qualification. Add it to your business profile instead, so every post can use it. Here, tell us how you like your posts written.',
        400
      );
    }
    return lesson;
  }

  private async logUsages(orgId: string, usages: Parameters<AiUsageService['logCall']>[2][]) {
    for (const usage of usages) {
      await this._aiUsageService.logCall(orgId, MEMORY_FEATURE, usage);
    }
  }
}
