// OURS: stores one row per AI generation call, scoped to the organisation.
import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { TokenUsage } from '@gitroom/nestjs-libraries/ours/ai/ai.pricing';

@Injectable()
export class AiUsageRepository {
  constructor(private _aiUsage: PrismaRepository<'oursAiUsage'>) {}

  async logUsage(
    orgId: string,
    body: TokenUsage & {
      feature: string;
      provider: string;
      model: string;
      costUsd: number | null;
    }
  ) {
    const { id } = await this._aiUsage.model.oursAiUsage.create({
      data: {
        organizationId: orgId,
        feature: body.feature,
        provider: body.provider,
        model: body.model,
        inputTokens: body.inputTokens,
        outputTokens: body.outputTokens,
        cacheReadTokens: body.cacheReadTokens,
        cacheWriteTokens: body.cacheWriteTokens,
        costUsd: body.costUsd,
      },
      select: { id: true },
    });
    return { id };
  }
}
