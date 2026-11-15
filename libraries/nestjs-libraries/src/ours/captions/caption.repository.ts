// OURS: weeks of captions and the drafts in them. Every query is scoped by
// organizationId (our tables have no Prisma relation to upstream models).
import { Injectable } from '@nestjs/common';
import {
  OursCaptionStatus,
  OursCaptionWeekStatus,
  Prisma,
} from '@prisma/client';
import {
  PrismaRepository,
  PrismaTransaction,
} from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

const WEEK_SELECT = {
  id: true,
  weekStart: true,
  timezone: true,
  status: true,
  errorMessage: true,
  writer: true,
  droppedCount: true,
  startedAt: true,
} satisfies Prisma.OursCaptionWeekSelect;

const DRAFT_SELECT = {
  id: true,
  weekId: true,
  platform: true,
  scheduledFor: true,
  theme: true,
  text: true,
  facts: true,
  status: true,
  integrationId: true,
  postId: true,
  approvedAt: true,
} satisfies Prisma.OursCaptionDraftSelect;

export type StoredCaptionWeek = Prisma.OursCaptionWeekGetPayload<{
  select: typeof WEEK_SELECT;
}>;
export type StoredCaptionDraft = Prisma.OursCaptionDraftGetPayload<{
  select: typeof DRAFT_SELECT;
}>;

@Injectable()
export class CaptionRepository {
  constructor(
    private _week: PrismaRepository<'oursCaptionWeek'>,
    private _draft: PrismaRepository<'oursCaptionDraft'>,
    private _transaction: PrismaTransaction
  ) {}

  latestWeek(orgId: string) {
    return this._week.model.oursCaptionWeek.findFirst({
      where: { organizationId: orgId },
      orderBy: { startedAt: 'desc' },
      select: WEEK_SELECT,
    });
  }

  getDrafts(orgId: string, weekId: string) {
    return this._draft.model.oursCaptionDraft.findMany({
      where: { organizationId: orgId, weekId },
      orderBy: { scheduledFor: 'asc' },
      select: DRAFT_SELECT,
    });
  }

  getDraft(orgId: string, id: string) {
    return this._draft.model.oursCaptionDraft.findFirst({
      where: { organizationId: orgId, id },
      select: DRAFT_SELECT,
    });
  }

  // One week per organisation and start date. A failed week is reused for a
  // retry; two requests at once can only start one week (the unique index).
  // Returns null when the week is already being written or written.
  async claimWeek(orgId: string, weekStart: string, timezone: string) {
    const retry = await this._week.model.oursCaptionWeek.updateMany({
      where: {
        organizationId: orgId,
        weekStart,
        status: OursCaptionWeekStatus.FAILED,
      },
      data: {
        status: OursCaptionWeekStatus.WRITING,
        timezone,
        errorMessage: null,
        droppedCount: 0,
        startedAt: new Date(),
      },
    });
    if (retry.count === 1) {
      return this._week.model.oursCaptionWeek.findFirst({
        where: { organizationId: orgId, weekStart },
        select: WEEK_SELECT,
      });
    }
    try {
      return await this._week.model.oursCaptionWeek.create({
        data: {
          organizationId: orgId,
          weekStart,
          timezone,
          status: OursCaptionWeekStatus.WRITING,
        },
        select: WEEK_SELECT,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        return null;
      }
      throw e;
    }
  }

  async finishWeek(
    orgId: string,
    weekId: string,
    body: {
      writer: string;
      droppedCount: number;
      drafts: {
        platform: string;
        scheduledFor: Date;
        theme: string;
        text: string;
        facts: Prisma.InputJsonValue;
      }[];
    }
  ) {
    // all or nothing, and only while the week is still being written (a week
    // that timed out stays failed)
    return this._transaction.model.$transaction(async (tx) => {
      const { count } = await tx.oursCaptionWeek.updateMany({
        where: {
          organizationId: orgId,
          id: weekId,
          status: OursCaptionWeekStatus.WRITING,
        },
        data: {
          status: OursCaptionWeekStatus.READY,
          errorMessage: null,
          writer: body.writer,
          droppedCount: body.droppedCount,
        },
      });
      if (count !== 1) {
        return false;
      }
      await tx.oursCaptionDraft.createMany({
        data: body.drafts.map((d) => ({
          ...d,
          organizationId: orgId,
          weekId,
          status: OursCaptionStatus.PENDING_APPROVAL,
        })),
      });
      return true;
    });
  }

  failWeek(orgId: string, weekId: string, errorMessage: string) {
    return this._week.model.oursCaptionWeek.updateMany({
      where: {
        organizationId: orgId,
        id: weekId,
        status: OursCaptionWeekStatus.WRITING,
      },
      data: { status: OursCaptionWeekStatus.FAILED, errorMessage },
    });
  }

  // Only one approval can win: the update matches a draft still waiting.
  async claimForApproval(orgId: string, id: string, integrationId: string) {
    const { count } = await this._draft.model.oursCaptionDraft.updateMany({
      where: {
        organizationId: orgId,
        id,
        status: OursCaptionStatus.PENDING_APPROVAL,
      },
      data: {
        status: OursCaptionStatus.APPROVED,
        integrationId,
        approvedAt: new Date(),
      },
    });
    return count === 1;
  }

  setPostId(orgId: string, id: string, postId: string) {
    return this._draft.model.oursCaptionDraft.updateMany({
      where: { organizationId: orgId, id },
      data: { postId },
    });
  }

  releaseApproval(orgId: string, id: string) {
    return this._draft.model.oursCaptionDraft.updateMany({
      where: { organizationId: orgId, id, postId: null },
      data: {
        status: OursCaptionStatus.PENDING_APPROVAL,
        integrationId: null,
        approvedAt: null,
      },
    });
  }
}
