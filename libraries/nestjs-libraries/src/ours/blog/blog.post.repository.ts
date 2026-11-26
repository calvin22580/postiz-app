// OURS: blog posts B1. Every query is scoped by organizationId (our tables
// have no Prisma relation to upstream models).
import { Injectable } from '@nestjs/common';
import { OursBlogPostStatus, Prisma } from '@prisma/client';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

const isOpenPostTaken = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

const POST_SELECT = {
  id: true,
  status: true,
  news: true,
  title: true,
  description: true,
  body: true,
  facts: true,
  writer: true,
  errorMessage: true,
  editedAt: true,
  rewriteCount: true,
  approvedAt: true,
  rejectedAt: true,
  rejectReason: true,
  startedAt: true,
} satisfies Prisma.OursBlogPostSelect;

export type StoredBlogPost = Prisma.OursBlogPostGetPayload<{
  select: typeof POST_SELECT;
}>;

export interface BlogPostWords {
  title: string;
  description: string;
  body: string;
}

@Injectable()
export class BlogPostRepository {
  constructor(private _post: PrismaRepository<'oursBlogPost'>) {}

  // the latest posts, newest first
  latest(orgId: string, take: number) {
    return this._post.model.oursBlogPost.findMany({
      where: { organizationId: orgId },
      orderBy: { startedAt: 'desc' },
      take,
      select: POST_SELECT,
    });
  }

  getPost(orgId: string, id: string) {
    return this._post.model.oursBlogPost.findFirst({
      where: { organizationId: orgId, id },
      select: POST_SELECT,
    });
  }

  // a post being written or waiting for the owner, if there is one
  open(orgId: string) {
    return this._post.model.oursBlogPost.findFirst({
      where: {
        organizationId: orgId,
        status: { in: [OursBlogPostStatus.WRITING, OursBlogPostStatus.PENDING_APPROVAL] },
      },
      orderBy: { startedAt: 'desc' },
      select: POST_SELECT,
    });
  }

  // titles of recent posts the owner didn't turn down, for the writer
  async recentTitles(orgId: string, take: number) {
    const rows = await this._post.model.oursBlogPost.findMany({
      where: {
        organizationId: orgId,
        status: { in: [OursBlogPostStatus.PENDING_APPROVAL, OursBlogPostStatus.APPROVED] },
      },
      orderBy: { startedAt: 'desc' },
      take,
      select: { title: true },
    });
    return rows.map((r) => r.title).filter(Boolean);
  }

  // null when another post is already open (openKey is unique), for
  // example when two requests start writing at once
  async start(orgId: string, news: string | null) {
    try {
      return await this._post.model.oursBlogPost.create({
        data: { organizationId: orgId, status: OursBlogPostStatus.WRITING, openKey: orgId, news },
        select: POST_SELECT,
      });
    } catch (e) {
      if (isOpenPostTaken(e)) {
        return null;
      }
      throw e;
    }
  }

  // Changes a post only while it has the given status, so a post that timed
  // out stays failed and an approved post never changes underneath the owner.
  private async whileStatus(
    orgId: string,
    id: string,
    status: OursBlogPostStatus,
    data: Prisma.OursBlogPostUpdateManyMutationInput,
    extra: Prisma.OursBlogPostWhereInput = {}
  ) {
    const { count } = await this._post.model.oursBlogPost.updateMany({
      where: { organizationId: orgId, id, status, ...extra },
      data,
    });
    return count === 1;
  }

  finish(
    orgId: string,
    id: string,
    body: BlogPostWords & { facts: Prisma.InputJsonValue; writer: string }
  ) {
    return this.whileStatus(orgId, id, OursBlogPostStatus.WRITING, {
      ...body,
      status: OursBlogPostStatus.PENDING_APPROVAL,
      errorMessage: null,
    });
  }

  fail(orgId: string, id: string, errorMessage: string) {
    return this.whileStatus(orgId, id, OursBlogPostStatus.WRITING, {
      status: OursBlogPostStatus.FAILED,
      openKey: null,
      errorMessage,
    });
  }

  // Only one approval can win, and only for the words the owner saw: an edit
  // or rewrite in between makes it fail rather than approve other wording.
  approve(orgId: string, id: string, words: BlogPostWords) {
    return this.whileStatus(
      orgId,
      id,
      OursBlogPostStatus.PENDING_APPROVAL,
      { status: OursBlogPostStatus.APPROVED, openKey: null, approvedAt: new Date() },
      words
    );
  }

  // Every change below only applies while the post is still waiting (or, for
  // restore and the reason, rejected), as for captions.
  editWords(orgId: string, id: string, words: BlogPostWords) {
    return this.whileStatus(orgId, id, OursBlogPostStatus.PENDING_APPROVAL, {
      ...words,
      editedAt: new Date(),
    });
  }

  reject(orgId: string, id: string) {
    return this.whileStatus(orgId, id, OursBlogPostStatus.PENDING_APPROVAL, {
      status: OursBlogPostStatus.REJECTED,
      openKey: null,
      rejectedAt: new Date(),
    });
  }

  // false when another post is open by now
  async restore(orgId: string, id: string) {
    try {
      return await this.whileStatus(orgId, id, OursBlogPostStatus.REJECTED, {
        status: OursBlogPostStatus.PENDING_APPROVAL,
        openKey: orgId,
        rejectedAt: null,
        rejectReason: null,
      });
    } catch (e) {
      if (isOpenPostTaken(e)) {
        return false;
      }
      throw e;
    }
  }

  setRejectReason(orgId: string, id: string, reason: string) {
    return this.whileStatus(orgId, id, OursBlogPostStatus.REJECTED, { rejectReason: reason });
  }

  // Takes one of the post's AI rewrites before the (billed) call is made, so
  // double clicks can't go past the limit.
  claimRewrite(orgId: string, id: string, max: number) {
    return this.whileStatus(
      orgId,
      id,
      OursBlogPostStatus.PENDING_APPROVAL,
      { rewriteCount: { increment: 1 } },
      { rewriteCount: { lt: max } }
    );
  }

  giveBackRewrite(orgId: string, id: string) {
    return this._post.model.oursBlogPost.updateMany({
      where: { organizationId: orgId, id, rewriteCount: { gt: 0 } },
      data: { rewriteCount: { decrement: 1 } },
    });
  }

  saveRewrite(orgId: string, id: string, body: BlogPostWords & { facts: Prisma.InputJsonValue }) {
    return this.whileStatus(orgId, id, OursBlogPostStatus.PENDING_APPROVAL, {
      ...body,
      editedAt: null,
    });
  }
}
