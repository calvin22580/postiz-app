// OURS: Milestone 8. Results of approved posts, one row per caption draft.
// Every query is scoped by organizationId.
import { Injectable } from '@nestjs/common';
import { OursCaptionStatus, Prisma } from '@prisma/client';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

const RESULT_SELECT = {
  draftId: true,
  postId: true,
  simulated: true,
  reach: true,
  interactions: true,
  checkedAt: true,
  measuredAt: true,
} satisfies Prisma.OursPostPerformanceSelect;

export type StoredPerformance = Prisma.OursPostPerformanceGetPayload<{
  select: typeof RESULT_SELECT;
}>;

@Injectable()
export class PerformanceRepository {
  constructor(
    private _performance: PrismaRepository<'oursPostPerformance'>,
    private _draft: PrismaRepository<'oursCaptionDraft'>
  ) {}

  // Captions the owner approved that became an upstream post, newest first.
  approvedPosts(orgId: string, since: Date) {
    return this._draft.model.oursCaptionDraft.findMany({
      where: {
        organizationId: orgId,
        status: OursCaptionStatus.APPROVED,
        postId: { not: null },
        scheduledFor: { gte: since },
      },
      orderBy: { scheduledFor: 'desc' },
      select: {
        id: true,
        postId: true,
        platform: true,
        scheduledFor: true,
        theme: true,
        facts: true,
        graphicLayout: true,
        graphicPath: true,
      },
    });
  }

  results(orgId: string, draftIds: string[]) {
    return this._performance.model.oursPostPerformance.findMany({
      where: { organizationId: orgId, draftId: { in: draftIds } },
      select: RESULT_SELECT,
    });
  }

  // Nothing reported (yet): remember when we asked, keep any earlier numbers.
  markChecked(orgId: string, draftId: string, postId: string) {
    return this.write(orgId, draftId, { postId, checkedAt: new Date() });
  }

  saveResult(
    orgId: string,
    draftId: string,
    postId: string,
    result: {
      simulated: boolean;
      reach: number | null;
      interactions: number | null;
      metrics: Prisma.InputJsonValue;
    }
  ) {
    const now = new Date();
    return this.write(orgId, draftId, { postId, ...result, checkedAt: now, measuredAt: now });
  }

  // update this organisation's row, or create it (the draft ids come from
  // the organisation's own approved captions)
  private async write(
    orgId: string,
    draftId: string,
    data: Omit<Prisma.OursPostPerformanceUncheckedCreateInput, 'organizationId' | 'draftId'>
  ) {
    const { count } = await this._performance.model.oursPostPerformance.updateMany({
      where: { organizationId: orgId, draftId },
      data,
    });
    if (count) {
      return;
    }
    try {
      await this._performance.model.oursPostPerformance.create({
        data: { ...data, organizationId: orgId, draftId },
        select: { id: true },
      });
    } catch (e) {
      // another request created it a moment ago
      if ((e as Prisma.PrismaClientKnownRequestError)?.code !== 'P2002') {
        throw e;
      }
    }
  }
}
