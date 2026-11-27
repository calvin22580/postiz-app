// OURS: logs the cost of every AI generation call against the organisation
// that triggered it (FORK_RULES: engineering rules).
import { Injectable, Logger } from '@nestjs/common';
import { AiUsageRepository } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.repository';
import { costUsd, TokenUsage } from '@gitroom/nestjs-libraries/ours/ai/ai.pricing';

export interface AiCallUsage extends TokenUsage {
  provider: string;
  model: string;
}

@Injectable()
export class AiUsageService {
  private _logger = new Logger(AiUsageService.name);

  constructor(private _aiUsageRepository: AiUsageRepository) {}

  async logCall(orgId: string, feature: string, usage: AiCallUsage) {
    const cost = costUsd(usage.model, usage);
    this._logger.log(
      `AI call org=${orgId} feature=${feature} model=${usage.model} in=${usage.inputTokens} out=${usage.outputTokens} cost=${cost ?? 'unknown'} USD`
    );
    try {
      return await this._aiUsageRepository.logUsage(orgId, {
        ...usage,
        feature,
        costUsd: cost,
      });
    } catch (e) {
      // the generation already happened; keep the cost visible in the logs
      this._logger.error(
        `Could not store AI cost for org=${orgId}: ${(e as Error).message}`
      );
      return null;
    }
  }

  countCalls(orgId: string, feature: string, since: Date) {
    return this._aiUsageRepository.countCalls(orgId, feature, since);
  }
}
