// OURS: one business profile per organisation. Every query is scoped by
// organizationId (our tables have no Prisma relation to upstream models).
import { Injectable } from '@nestjs/common';
import { OursProfileStatus, Prisma } from '@prisma/client';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

const PROFILE_SELECT = {
  id: true,
  websiteUrl: true,
  status: true,
  progress: true,
  errorMessage: true,
  fields: true,
  pages: true,
  extractor: true,
  buildStartedAt: true,
  updatedAt: true,
} satisfies Prisma.OursBusinessProfileSelect;

export type StoredBusinessProfile = Prisma.OursBusinessProfileGetPayload<{
  select: typeof PROFILE_SELECT;
}>;

@Injectable()
export class BusinessProfileRepository {
  constructor(private _profile: PrismaRepository<'oursBusinessProfile'>) {}

  getProfile(orgId: string) {
    return this._profile.model.oursBusinessProfile.findUnique({
      where: { organizationId: orgId },
      select: PROFILE_SELECT,
    });
  }

  startBuild(orgId: string, websiteUrl: string) {
    const data = {
      websiteUrl,
      status: OursProfileStatus.CRAWLING,
      progress: { stage: 'checking', done: 0, total: 1 },
      errorMessage: null,
      buildStartedAt: new Date(),
    };
    return this._profile.model.oursBusinessProfile.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, ...data },
      update: data,
      select: PROFILE_SELECT,
    });
  }

  updateProgress(
    orgId: string,
    status: OursProfileStatus,
    progress: Prisma.InputJsonValue
  ) {
    return this._profile.model.oursBusinessProfile.update({
      where: { organizationId: orgId },
      data: { status, progress },
      select: { id: true },
    });
  }

  finishBuild(
    orgId: string,
    body: {
      fields: Prisma.InputJsonValue;
      pages: Prisma.InputJsonValue;
      extractor: string;
    }
  ) {
    return this._profile.model.oursBusinessProfile.update({
      where: { organizationId: orgId },
      data: {
        status: OursProfileStatus.READY,
        progress: Prisma.DbNull,
        errorMessage: null,
        fields: body.fields,
        pages: body.pages,
        extractor: body.extractor,
      },
      select: { id: true },
    });
  }

  failBuild(orgId: string, errorMessage: string) {
    return this._profile.model.oursBusinessProfile.update({
      where: { organizationId: orgId },
      data: {
        status: OursProfileStatus.FAILED,
        progress: Prisma.DbNull,
        errorMessage,
      },
      select: { id: true },
    });
  }

  saveFields(orgId: string, fields: Prisma.InputJsonValue) {
    return this._profile.model.oursBusinessProfile.update({
      where: { organizationId: orgId },
      data: { fields },
      select: PROFILE_SELECT,
    });
  }
}
