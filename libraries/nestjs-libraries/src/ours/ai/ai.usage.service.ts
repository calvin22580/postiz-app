// OURS: logs the cost of every AI generation call against the organisation
// that triggered it (FORK_RULES: engineering rules). Paid data calls (search
// data, D1) are logged in the same table, with no tokens and the provider's
// own charge, so one place holds what each organisation costs us.
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

  // A paid data call priced by the provider per request, not per token.
  async logDataCall(
    orgId: string,
    feature: string,
    call: { provider: string; endpoint: string; costUsd: number }
  ) {
    this._logger.log(
      `Data call org=${orgId} feature=${feature} provider=${call.provider} endpoint=${call.endpoint} cost=${call.costUsd} USD`
    );
    try {
      return await this._aiUsageRepository.logUsage(orgId, {
        feature,
        provider: call.provider,
        model: call.endpoint,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costUsd: call.costUsd,
      });
    } catch (e) {
      this._logger.error(`Could not store data call cost for org=${orgId}: ${(e as Error).message}`);
      return null;
    }
  }
}
