// OURS: content engine E4. Runs the Memory keeper before a week is written
// and gives the other steps the brand brief. Off unless OURS_BRAND_MEMORY is
// "true". Memory is a side step: if it fails, writing goes ahead with the
// lessons as they were, and the failure is logged only.
import { Injectable, Logger } from '@nestjs/common';
import { AiUsageService } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import { brandBrief, MemoryFolder, SIGNAL_REF_LENGTH } from '@gitroom/nestjs-libraries/ours/memory/brand.memory';
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

  private async logUsages(orgId: string, usages: Parameters<AiUsageService['logCall']>[2][]) {
    for (const usage of usages) {
      await this._aiUsageService.logCall(orgId, MEMORY_FEATURE, usage);
    }
  }
}
