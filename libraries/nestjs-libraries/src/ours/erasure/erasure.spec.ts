import { beforeEach, describe, expect, it, vi } from 'vitest';

const removeFile = vi.fn();
vi.mock('@gitroom/nestjs-libraries/upload/upload.factory', () => ({
  UploadFactory: { createStorage: () => ({ removeFile }) },
}));

import { ErasureService } from './erasure.service';
import type { ErasureRepository } from './erasure.repository';

// An in-memory stand-in for the repository: pages of deleted organisations
// and channels, and the set already erased.
const fakeRepository = (state: {
  orgs: string[];
  liveOrgs?: string[];
  channels: { id: string; organizationId: string; deletedAt?: Date }[];
  erased?: string[];
  files?: Record<string, string[]>;
  failOrg?: string;
}) => {
  const erasedAt = new Map<string, Date>(
    (state.erased || []).map((id) => [id, new Date('2026-11-01T00:00:00Z')])
  );
  const erased = { has: (id: string) => erasedAt.has(id), get size() { return erasedAt.size; }, ids: () => [...erasedAt.keys()] };
  const page = <T>(items: T[], skip: number) => items.slice(skip, skip + 2);
  return {
    erased,
    repo: {
      deletedOrganisations: vi.fn(async (skip: number) =>
        page(state.orgs.map((id) => ({ id })), skip)
      ),
      deletedChannels: vi.fn(async (skip: number, orgId?: string) =>
        page(
          state.channels.filter((c) => !orgId || c.organizationId === orgId),
          skip
        )
      ),
      lastErased: vi.fn(
        async (_kind: string, ids: string[]) =>
          new Map(ids.filter((id) => erasedAt.has(id)).map((id) => [id, erasedAt.get(id)!]))
      ),
      recordErasure: vi.fn(async (_kind: string, _org: string, id: string) => {
        erasedAt.set(id, new Date());
      }),
      isDeletedOrganisation: vi.fn(
        async (id: string) =>
          state.orgs.includes(id) && !(state.liveOrgs || []).includes(id)
      ),
      storedFiles: vi.fn(async (id: string) => state.files?.[id] || []),
      eraseOrganisation: vi.fn(async (id: string) => {
        if (id === state.failOrg) {
          throw new Error('database down');
        }
      }),
      eraseChannel: vi.fn(async () => true),
    },
  };
};

const service = (repo: unknown) =>
  new ErasureService(repo as ErasureRepository);

describe('erasure sweep', () => {
  beforeEach(() => {
    removeFile.mockReset();
  });

  it('erases every deleted organisation and channel, across pages', async () => {
    const { repo, erased } = fakeRepository({
      orgs: ['o1', 'o2', 'o3'],
      channels: [
        { id: 'c1', organizationId: 'o1' },
        { id: 'c2', organizationId: 'o9' },
        { id: 'c3', organizationId: 'o9' },
      ],
    });
    await service(repo).sweep();
    expect(repo.eraseOrganisation.mock.calls.map((c) => c[0])).toEqual([
      'o1',
      'o2',
      'o3',
    ]);
    expect(repo.eraseChannel).toHaveBeenCalledTimes(3);
    expect(erased.ids().sort()).toEqual(['c1', 'c2', 'c3', 'o1', 'o2', 'o3']);
  });

  it('skips what was already erased, so running again does nothing', async () => {
    const { repo } = fakeRepository({
      orgs: ['o1'],
      channels: [{ id: 'c1', organizationId: 'o1' }],
      erased: ['o1', 'c1'],
    });
    await service(repo).sweep();
    expect(repo.eraseOrganisation).not.toHaveBeenCalled();
    expect(repo.eraseChannel).not.toHaveBeenCalled();
  });

  it('erases a channel again when it was reconnected and disconnected again', async () => {
    const { repo } = fakeRepository({
      orgs: [],
      channels: [
        // disconnected before the last erasure: nothing new
        { id: 'c1', organizationId: 'o1', deletedAt: new Date('2026-10-30T00:00:00Z') },
        // disconnected again after it: erase again
        { id: 'c2', organizationId: 'o1', deletedAt: new Date('2026-11-10T00:00:00Z') },
      ],
      erased: ['c1', 'c2'],
    });
    await service(repo).sweep();
    expect(repo.eraseChannel).toHaveBeenCalledTimes(1);
    expect(repo.eraseChannel).toHaveBeenCalledWith('o1', 'c2');
  });

  it('never erases an organisation that is still in use', async () => {
    const { repo, erased } = fakeRepository({
      orgs: ['o1'],
      liveOrgs: ['o1'],
      channels: [],
      files: { o1: ['/uploads/a.png'] },
    });
    await service(repo).sweep();
    expect(repo.storedFiles).not.toHaveBeenCalled();
    expect(removeFile).not.toHaveBeenCalled();
    expect(repo.eraseOrganisation).not.toHaveBeenCalled();
    expect(erased.size).toBe(0);
  });

  it('a failure is logged, not recorded, and the others still run', async () => {
    const { repo, erased } = fakeRepository({
      orgs: ['o1', 'o2'],
      channels: [{ id: 'c1', organizationId: 'o2' }],
      failOrg: 'o1',
    });
    await expect(service(repo).sweep()).resolves.toBeUndefined();
    expect(erased.has('o1')).toBe(false);
    expect(erased.has('o2')).toBe(true);
    expect(erased.has('c1')).toBe(true);

    // retried next time
    repo.eraseOrganisation.mockImplementation(async () => undefined);
    await service(repo).sweep();
    expect(erased.has('o1')).toBe(true);
  });

  it('removes stored files first, carrying on past ones that are gone', async () => {
    removeFile.mockRejectedValueOnce(new Error('ENOENT'));
    const { repo, erased } = fakeRepository({
      orgs: ['o1'],
      channels: [],
      files: { o1: ['/uploads/gone.png', '/uploads/b.png'] },
    });
    await service(repo).sweep();
    expect(removeFile.mock.calls.map((c) => c[0])).toEqual([
      '/uploads/gone.png',
      '/uploads/b.png',
    ]);
    expect(erased.has('o1')).toBe(true);
  });

  it('after a disconnect, erases only that organisation\'s channels', async () => {
    const { repo } = fakeRepository({
      orgs: ['o5'],
      channels: [
        { id: 'c1', organizationId: 'o1' },
        { id: 'c2', organizationId: 'o2' },
      ],
    });
    await service(repo).sweep('o1');
    expect(repo.deletedOrganisations).not.toHaveBeenCalled();
    expect(repo.eraseChannel).toHaveBeenCalledTimes(1);
    expect(repo.eraseChannel).toHaveBeenCalledWith('o1', 'c1');
  });

  it('runs sweeps one after another, never two at once', async () => {
    const { repo } = fakeRepository({ orgs: [], channels: [] });
    let active = 0;
    let maxActive = 0;
    repo.deletedChannels.mockImplementation(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return [];
    });
    const s = service(repo);
    await Promise.all([s.sweep(), s.sweep('o1'), s.sweep()]);
    // the third joins the first, which had not started yet
    expect(repo.deletedChannels).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
  });

  it('joins a sweep that is already waiting instead of queueing more', async () => {
    const { repo } = fakeRepository({ orgs: [], channels: [] });
    let release!: () => void;
    repo.deletedChannels.mockImplementationOnce(
      () => new Promise((r) => (release = () => r([])))
    );
    const s = service(repo);
    const first = s.sweep();
    await new Promise((r) => setTimeout(r, 0));
    const waiting = [s.sweep(), s.sweep(), s.sweep(), s.sweep('o1'), s.sweep('o1')];
    release();
    await Promise.all([first, ...waiting]);
    // the running one, one waiting full sweep, one waiting sweep for o1
    expect(repo.deletedChannels).toHaveBeenCalledTimes(3);
  });

  it('only removes files from our own cloud bucket', async () => {
    process.env.STORAGE_PROVIDER = 'cloudflare';
    process.env.CLOUDFLARE_BUCKET_URL = 'https://media.example.test';
    try {
      const { repo } = fakeRepository({
        orgs: ['o1'],
        channels: [],
        files: { o1: ['https://media.example.test/a.png', 'https://elsewhere.test/a.png'] },
      });
      await service(repo).sweep();
      expect(removeFile.mock.calls.map((c) => c[0])).toEqual(['https://media.example.test/a.png']);
    } finally {
      delete process.env.STORAGE_PROVIDER;
      delete process.env.CLOUDFLARE_BUCKET_URL;
    }
  });
});
