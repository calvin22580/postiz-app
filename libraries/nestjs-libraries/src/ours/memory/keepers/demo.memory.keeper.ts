// OURS: content engine E4. A labelled stand-in for the Memory keeper when no
// AI service is connected (and for tests): it learns two simple lessons by
// rule, through the same checked workspace, so the whole flow runs for free.
import { MemoryRefusedError } from '@gitroom/nestjs-libraries/ours/memory/brand.memory.workspace';
import {
  KeeperSignal,
  MemoryKeeper,
  MemoryKeeperInput,
  MemoryKeeperOutput,
} from '@gitroom/nestjs-libraries/ours/memory/keepers/memory.keeper';

const RULES: { path: string; lesson: string; shows: (s: KeeperSignal) => boolean }[] = [
  {
    path: '/memories/voice/no-exclamation-marks.md',
    lesson: 'Leave out exclamation marks; the owner takes them out.',
    shows: (s) => (s.kind === 'edited' || (s.kind === 'approved' && !!s.edited)) && (s.before || '').includes('!') && !(s.after || '').includes('!'),
  },
  {
    path: '/memories/avoid/salesy-posts.md',
    lesson: 'Keep posts low-key; the owner turns down posts that feel salesy.',
    shows: (s) => s.kind === 'reject-reason' && s.reason === 'salesy',
  },
];

export class DemoMemoryKeeper implements MemoryKeeper {
  readonly name = 'demo' as const;

  async keep({ signals, workspace }: MemoryKeeperInput): Promise<MemoryKeeperOutput> {
    const learned: string[] = [];
    for (const rule of RULES) {
      const refs = signals.filter(rule.shows).map((s) => s.ref);
      if (!refs.length) continue;
      const existing = workspace.lessons().find((l) => l.path === rule.path);
      if (existing?.source === 'owner') continue;
      const evidence = [...new Set([...(existing?.evidence || []), ...refs])];
      try {
        workspace.create(
          rule.path,
          `lesson: ${rule.lesson}\nevidence: ${evidence.join(', ')}\nagainst: ${(existing?.against || []).join(', ')}`
        );
        learned.push(rule.path);
      } catch (e) {
        if (!(e instanceof MemoryRefusedError)) throw e;
      }
    }
    return { summary: learned.length ? `Demo memory: updated ${learned.join(', ')}` : 'Demo memory: nothing new.', usages: [] };
  }
}
