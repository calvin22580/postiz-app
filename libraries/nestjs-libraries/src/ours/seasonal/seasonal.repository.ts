// OURS: the owner's choices about UK dates, one row per organisation. Every
// query is scoped by organizationId.
import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

@Injectable()
export class SeasonalRepository {
  constructor(private _settings: PrismaRepository<'oursSeasonalSettings'>) {}

  getSettings(orgId: string) {
    return this._settings.model.oursSeasonalSettings.findUnique({
      where: { organizationId: orgId },
      select: { nation: true, enabled: true, skippedKeys: true },
    });
  }

  saveSettings(
    orgId: string,
    defaults: { nation: string },
    data: { nation?: string; enabled?: boolean; skippedKeys?: string[] }
  ) {
    return this._settings.model.oursSeasonalSettings.upsert({
      where: { organizationId: orgId },
      create: { ...data, organizationId: orgId, nation: data.nation || defaults.nation },
      update: data,
      select: { id: true },
    });
  }
}
