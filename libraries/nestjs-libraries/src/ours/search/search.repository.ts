// OURS: the searches a business has been offered and chosen (D1). Every query
// is scoped by organizationId.
import { Injectable } from '@nestjs/common';
import { OursTrackedSearchStatus } from '@prisma/client';
import {
  PrismaRepository,
  PrismaTransaction,
} from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

export interface SearchRowInput {
  keyword: string;
  kind: string;
  searchVolume: number | null;
  locationCode: number;
  simulated: boolean;
}

const SELECT = {
  id: true,
  keyword: true,
  status: true,
  origin: true,
  kind: true,
  searchVolume: true,
  volumeCheckedAt: true,
  simulated: true,
  trackedAt: true,
} as const;

@Injectable()
export class SearchRepository {
  constructor(
    private _search: PrismaRepository<'oursTrackedSearch'>,
    private _aiUsage: PrismaRepository<'oursAiUsage'>,
    private _transaction: PrismaTransaction
  ) {}

  list(orgId: string) {
    return this._search.model.oursTrackedSearch.findMany({
      where: { organizationId: orgId, status: { not: OursTrackedSearchStatus.DISMISSED } },
      orderBy: [{ searchVolume: { sort: 'desc', nulls: 'last' } }, { keyword: 'asc' }],
      select: SELECT,
    });
  }

  // keywords the owner has already answered (chosen or turned down), which a
  // new set of suggestions leaves out
  async answeredKeywords(orgId: string) {
    const rows = await this._search.model.oursTrackedSearch.findMany({
      where: { organizationId: orgId, status: { not: OursTrackedSearchStatus.SUGGESTED } },
      select: { keyword: true },
    });
    return new Set(rows.map((r) => r.keyword));
  }

  async isTracked(orgId: string, keyword: string) {
    const row = await this._search.model.oursTrackedSearch.findFirst({
      where: { organizationId: orgId, keyword, status: OursTrackedSearchStatus.TRACKED },
      select: { id: true },
    });
    return !!row;
  }

  countTracked(orgId: string) {
    return this._search.model.oursTrackedSearch.count({
      where: { organizationId: orgId, status: OursTrackedSearchStatus.TRACKED },
    });
  }

  // A fresh set of suggestions replaces the old ones the owner hadn't
  // answered. Chosen and turned-down searches stay as they are.
  async replaceSuggestions(orgId: string, rows: SearchRowInput[], now: Date) {
    await this._transaction.model.$transaction(async (tx) => {
      await tx.oursTrackedSearch.deleteMany({
        where: { organizationId: orgId, status: OursTrackedSearchStatus.SUGGESTED },
      });
      await tx.oursTrackedSearch.createMany({
        data: rows.map((r) => ({
          organizationId: orgId,
          keyword: r.keyword,
          status: OursTrackedSearchStatus.SUGGESTED,
          origin: 'suggested',
          kind: r.kind,
          searchVolume: r.searchVolume,
          volumeCheckedAt: now,
          locationCode: r.locationCode,
          simulated: r.simulated,
        })),
        skipDuplicates: true,
      });
    });
  }

  // the owner's own search, tracked straight away (or brought back if they
  // had turned it down before)
  addOwnSearch(orgId: string, keyword: string, kind: string, now: Date) {
    return this._search.model.oursTrackedSearch.upsert({
      where: { organizationId_keyword: { organizationId: orgId, keyword } },
      create: {
        organizationId: orgId,
        keyword,
        status: OursTrackedSearchStatus.TRACKED,
        origin: 'owner',
        kind,
        trackedAt: now,
      },
      update: { status: OursTrackedSearchStatus.TRACKED, trackedAt: now },
      select: { id: true },
    });
  }

  // returns how many rows changed
  async track(orgId: string, ids: string[], now: Date) {
    const { count } = await this._search.model.oursTrackedSearch.updateMany({
      where: { organizationId: orgId, id: { in: ids }, status: OursTrackedSearchStatus.SUGGESTED },
      data: { status: OursTrackedSearchStatus.TRACKED, trackedAt: now },
    });
    return count;
  }

  async dismiss(orgId: string, id: string) {
    const { count } = await this._search.model.oursTrackedSearch.updateMany({
      where: { organizationId: orgId, id },
      data: { status: OursTrackedSearchStatus.DISMISSED, trackedAt: null },
    });
    return count;
  }

  // when this business last paid for a set of suggestions
  async lastPaidSuggestion(orgId: string, feature: string) {
    const row = await this._aiUsage.model.oursAiUsage.findFirst({
      where: { organizationId: orgId, feature },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return row?.createdAt || null;
  }
}
