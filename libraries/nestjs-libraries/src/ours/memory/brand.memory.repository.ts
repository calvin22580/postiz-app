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
