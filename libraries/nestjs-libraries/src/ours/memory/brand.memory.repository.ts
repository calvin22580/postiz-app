// OURS: content engine E4. Stores brand memory lessons and the Memory
// keeper's runs. Every query is scoped to the organisation.
import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  Lesson,
  LessonSource,
  lessonStatus,
  SIGNAL_REF_LENGTH,
} from '@gitroom/nestjs-libraries/ours/memory/brand.memory';
import { MemoryRefusal, SwitchedOffLesson } from '@gitroom/nestjs-libraries/ours/memory/brand.memory.workspace';

// how many owner actions one keeper run reads at most; the rest wait for the next run
export const MAX_SIGNALS_PER_RUN = 150;

const lessonFields = { path: true, lesson: true, evidence: true, against: true, source: true } as const;

export interface MemoryRunLog {
  lastSignalAt: Date;
  signalCount: number;
  status: 'ok' | 'failed';
  keeper: string;
  changes?: { saved: string[]; removed: string[] };
  refusals?: MemoryRefusal[];
  errorMessage?: string;
}

@Injectable()
export class BrandMemoryRepository {
  constructor(
    private _ours: PrismaRepository<'oursBrandMemory' | 'oursBrandMemoryRun' | 'oursBrandSignal'>
  ) {}

  // The lessons in use or being tried: not switched off, not retired.
  async lessons(orgId: string): Promise<Lesson[]> {
    const rows = await this._ours.model.oursBrandMemory.findMany({
      where: { organizationId: orgId, offAt: null, status: { not: 'retired' } },
      select: lessonFields,
      orderBy: { path: 'asc' },
    });
    return rows.map((r) => ({ ...r, source: r.source as LessonSource }));
  }

  async switchedOff(orgId: string): Promise<SwitchedOffLesson[]> {
    return this._ours.model.oursBrandMemory.findMany({
      where: { organizationId: orgId, offAt: { not: null } },
      select: { path: true, lesson: true },
    });
  }

  // The ids (first characters) of every owner action of this organisation.
  async signalRefs(orgId: string) {
    const rows = await this._ours.model.oursBrandSignal.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id.slice(0, SIGNAL_REF_LENGTH).toLowerCase()));
  }

  // Owner actions since the last keeper run that finished, oldest first.
  async newSignals(orgId: string) {
    const last = await this._ours.model.oursBrandMemoryRun.findFirst({
      where: { organizationId: orgId, status: 'ok' },
      orderBy: { lastSignalAt: 'desc' },
      select: { lastSignalAt: true },
    });
    return this._ours.model.oursBrandSignal.findMany({
      where: { organizationId: orgId, ...(last ? { createdAt: { gt: last.lastSignalAt } } : {}) },
      orderBy: { createdAt: 'asc' },
      take: MAX_SIGNALS_PER_RUN,
      select: {
        id: true,
        kind: true,
        draftId: true,
        platform: true,
        theme: true,
        before: true,
        after: true,
        reason: true,
        note: true,
        edited: true,
        createdAt: true,
      },
    });
  }

  // Saves what a keeper run changed: lessons it wrote, and lessons it removed
  // (kept as retired rows, so the history stays).
  async saveChanges(orgId: string, saved: Lesson[], removed: string[]) {
    for (const l of saved) {
      const data = {
        lesson: l.lesson,
        evidence: l.evidence,
        against: l.against,
        status: lessonStatus(l),
        source: l.source,
      };
      await this._ours.model.oursBrandMemory.upsert({
        where: { organizationId_path: { organizationId: orgId, path: l.path } },
        create: { organizationId: orgId, path: l.path, ...data },
        update: data,
        select: { id: true },
      });
    }
    if (removed.length) {
      await this._ours.model.oursBrandMemory.updateMany({
        where: { organizationId: orgId, path: { in: removed }, source: 'keeper', offAt: null },
        data: { status: 'retired' },
      });
    }
  }

  // E5: everything the owner sees on the "What we've learned" screen: the
  // lessons in use or being tried, and the ones they switched off (not the
  // ones they deleted).
  async overview(orgId: string) {
    const [lessons, lastRun] = await Promise.all([
      this._ours.model.oursBrandMemory.findMany({
        where: { organizationId: orgId, deletedAt: null, OR: [{ offAt: { not: null } }, { status: { not: 'retired' } }] },
        select: { id: true, ...lessonFields, offAt: true, updatedAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this._ours.model.oursBrandMemoryRun.findFirst({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, status: true },
      }),
    ]);
    return { lessons: lessons.map((r) => ({ ...r, source: r.source as LessonSource })), lastRun };
  }

  // The owner actions behind lessons, found by the first characters of their
  // ids, newest first.
  async signalsByRefs(orgId: string, refs: string[]) {
    if (!refs.length) return [];
    return this._ours.model.oursBrandSignal.findMany({
      where: { organizationId: orgId, OR: [...new Set(refs)].map((ref) => ({ id: { startsWith: ref } })) },
      orderBy: { createdAt: 'desc' },
      select: { id: true, kind: true, platform: true, theme: true, before: true, after: true, reason: true, note: true, createdAt: true },
    });
  }

  async ownerLesson(orgId: string, id: string) {
    return this._ours.model.oursBrandMemory.findFirst({
      where: { organizationId: orgId, id, deletedAt: null },
      select: { id: true, ...lessonFields, offAt: true },
    });
  }

  async addOwnerLesson(orgId: string, path: string, lesson: string) {
    return this._ours.model.oursBrandMemory.create({
      data: { organizationId: orgId, path, lesson, evidence: [], against: [], status: 'active', source: 'owner' },
      select: { id: true },
    });
  }

  // The owner's words win: an edited lesson is theirs, and in use.
  async editLesson(orgId: string, id: string, lesson: string) {
    await this._ours.model.oursBrandMemory.updateMany({
      where: { organizationId: orgId, id, deletedAt: null },
      data: { lesson, source: 'owner', status: 'active' },
    });
  }

  // Switched off: hidden from the keeper and the brief, listed for the owner.
  // Switched back on: the owner chose it, so the keeper can't change it.
  async setOff(orgId: string, id: string, off: boolean) {
    await this._ours.model.oursBrandMemory.updateMany({
      where: { organizationId: orgId, id, deletedAt: null },
      data: off ? { offAt: new Date() } : { offAt: null, source: 'owner', status: 'active' },
    });
  }

  // Deleted: kept as a hidden row so the keeper can't learn it again.
  async deleteLesson(orgId: string, id: string) {
    const now = new Date();
    await this._ours.model.oursBrandMemory.updateMany({
      where: { organizationId: orgId, id, deletedAt: null },
      data: { offAt: now, deletedAt: now },
    });
  }

  async logRun(orgId: string, run: MemoryRunLog) {
    const { id } = await this._ours.model.oursBrandMemoryRun.create({
      data: {
        organizationId: orgId,
        lastSignalAt: run.lastSignalAt,
        signalCount: run.signalCount,
        status: run.status,
        keeper: run.keeper,
        changes: (run.changes || { saved: [], removed: [] }) as object,
        refusals: (run.refusals || []) as object[],
        errorMessage: run.errorMessage ?? null,
      },
      select: { id: true },
    });
    return { id };
  }
}
