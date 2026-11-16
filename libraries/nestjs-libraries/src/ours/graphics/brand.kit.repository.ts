// OURS: one brand kit (colour and logo for graphics) per organisation. Every
// query is scoped by organizationId.
import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

@Injectable()
export class BrandKitRepository {
  constructor(private _kit: PrismaRepository<'oursBrandKit'>) {}

  // the logo bytes are only read when a graphic is drawn
  getKit(orgId: string, withLogo = false) {
    return this._kit.model.oursBrandKit.findUnique({
      where: { organizationId: orgId },
      select: { colour: true, logo: withLogo, updatedAt: true },
    });
  }

  hasLogo(orgId: string) {
    return this._kit.model.oursBrandKit.count({
      where: { organizationId: orgId, logo: { not: null } },
    });
  }

  setColour(orgId: string, colour: string) {
    return this._kit.model.oursBrandKit.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, colour },
      update: { colour },
      select: { id: true },
    });
  }

  setLogo(orgId: string, logo: Buffer | null, defaultColour: string) {
    return this._kit.model.oursBrandKit.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, colour: defaultColour, logo },
      update: { logo },
      select: { id: true },
    });
  }
}
