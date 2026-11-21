// OURS: content engine E1. Stores owner signals, one row per action, scoped
// to the organisation.
import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { BrandSignal } from '@gitroom/nestjs-libraries/ours/memory/brand.signal';

@Injectable()
export class BrandSignalRepository {
  constructor(private _signal: PrismaRepository<'oursBrandSignal'>) {}

  async record(orgId: string, signal: BrandSignal) {
    const { id } = await this._signal.model.oursBrandSignal.create({
      data: {
        organizationId: orgId,
        kind: signal.kind,
        draftId: signal.draftId ?? null,
        weekId: signal.weekId ?? null,
        platform: signal.platform ?? null,
        theme: signal.theme ?? null,
        before: signal.before ?? null,
        after: signal.after ?? null,
        reason: signal.reason ?? null,
        note: signal.note ?? null,
        edited: signal.edited ?? null,
      },
      select: { id: true },
    });
    return { id };
  }
}
