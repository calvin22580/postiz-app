// OURS: content engine E4. Runs the Memory keeper over scripted owner
// histories (four weeks of owner actions per business, with planted habits
// and traps) and scores what it learned. It calls the real keepers through
// the same checked workspace the app uses, one week at a time, carrying the
// lessons forward like the app does.
// How to run, and what it costs: ours/eval/README.md.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Lesson, lessonStatus, SIGNAL_REF_LENGTH, similarLessons } from '@gitroom/nestjs-libraries/ours/memory/brand.memory';
import { MemoryWorkspace, SwitchedOffLesson, MemoryRefusal } from '@gitroom/nestjs-libraries/ours/memory/brand.memory.workspace';
import { MemoryKeeper, MemoryKeeperError } from '@gitroom/nestjs-libraries/ours/memory/keepers/memory.keeper';
import { AnthropicMemoryKeeper } from '@gitroom/nestjs-libraries/ours/memory/keepers/anthropic.memory.keeper';
import { PlainMemoryKeeper } from '@gitroom/nestjs-libraries/ours/memory/keepers/plain.memory.keeper';
import { DemoMemoryKeeper } from '@gitroom/nestjs-libraries/ours/memory/keepers/demo.memory.keeper';
import { costUsd } from '@gitroom/nestjs-libraries/ours/ai/ai.pricing';
import { AiCallUsage } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import Anthropic from '@anthropic-ai/sdk';

interface Signal {
  id: string;
  week: number;
  kind: string;
  platform?: string;
  theme?: string;
  before?: string;
  after?: string;
  reason?: string;
  note?: string;
  edited?: boolean;
}

interface Pattern {
  id: string;
  describe: string;
  // a regular expression a lesson matches when it says this (case-insensitive)
  match: string;
}

interface Business {
  name: string;
  signals: Signal[];
  // lessons the owner switches off before a week starts; match: a regular
  // expression for the same lesson in other words
  switchOffBeforeWeek?: Record<string, (SwitchedOffLesson & { match?: string })[]>;
  // what the owner's actions really show: each should end as an active lesson
  habits: Pattern[];
  // shown once only: must not become an active lesson
  oneOffs: Pattern[];
  // details that must never be stored in any lesson
  facts: string;
}

interface TestSet {
  businesses: Record<string, Business>;
}

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const setName = arg('set', 'personas')!;
const keepers = arg('keepers', 'demo')!.split(',');
const model = arg('model', 'claude-haiku-5-5')!;
const reps = Number.parseInt(arg('reps', '1')!, 10);

const evalRoot = path.join(process.cwd(), 'ours/eval/memory');
const set: TestSet = JSON.parse(readFileSync(path.join(evalRoot, 'sets', setName, 'history.json'), 'utf8'));
const runDir = path.join(evalRoot, 'runs', `${new Date().toISOString().replace(/[:.]/g, '-')}-${setName}`);
mkdirSync(runDir, { recursive: true });

const keeperFor = (name: string): MemoryKeeper => {
  if (name === 'demo') return new DemoMemoryKeeper();
  const client = new Anthropic();
  if (name === 'memory-tool') return new AnthropicMemoryKeeper(client, model);
  if (name === 'plain') return new PlainMemoryKeeper(client, model);
  throw new Error(`Unknown keeper ${name}: use demo, memory-tool or plain`);
};

const matches = (p: Pattern | string, text: string) =>
  new RegExp(typeof p === 'string' ? p : p.match, 'i').test(text);

interface BusinessResult {
  keeper: string;
  rep: number;
  business: string;
  lessons: (Lesson & { status: string })[];
  habitsFound: string[];
  habitsMissed: string[];
  wrongLessons: string[];
  oneOffsPromoted: string[];
  factsStored: string[];
  switchedOffBack: string[];
  refusals: (MemoryRefusal & { week: number })[];
  summaries: string[];
  errors: string[];
  usages: AiCallUsage[];
}

async function runBusiness(keeperName: string, rep: number, id: string, biz: Business): Promise<BusinessResult> {
  const keeper = keeperFor(keeperName);
  const known = new Set(biz.signals.map((s) => s.id.slice(0, SIGNAL_REF_LENGTH)));
  let lessons: Lesson[] = [];
  const switchedOff: (SwitchedOffLesson & { match?: string })[] = [];
  const result: BusinessResult = {
    keeper: keeperName, rep, business: id, lessons: [], habitsFound: [], habitsMissed: [], wrongLessons: [],
    oneOffsPromoted: [], factsStored: [], switchedOffBack: [], refusals: [], summaries: [], errors: [], usages: [],
  };
  const weeks = [...new Set(biz.signals.map((s) => s.week))].sort((a, b) => a - b);
  for (const week of weeks) {
    // the owner switches lessons off on the "What we've learned" screen
    for (const off of biz.switchOffBeforeWeek?.[String(week)] || []) {
      switchedOff.push(off);
      lessons = lessons.filter((l) => l.path !== off.path && !similarLessons(l.lesson, off.lesson));
    }
    const workspace = new MemoryWorkspace(lessons, switchedOff, known);
    const signals = biz.signals
      .filter((s) => s.week === week)
      .map(({ id: sid, week: _w, ...s }) => ({ ...s, ref: sid.slice(0, SIGNAL_REF_LENGTH) }));
    try {
      const out = await keeper.keep({ signals, workspace });
      result.usages.push(...out.usages);
      result.summaries.push(`week ${week}: ${out.summary}`);
      // saved like the app: changed lessons replace, removed ones go, retired ones drop out
      const { saved, removed } = workspace.changes();
      const byPath = new Map(lessons.map((l) => [l.path, l]));
      for (const p of removed) byPath.delete(p);
      for (const l of saved) byPath.set(l.path, l);
      lessons = [...byPath.values()].filter((l) => lessonStatus(l) !== 'retired');
    } catch (e) {
      if (e instanceof MemoryKeeperError) result.usages.push(...e.usages);
      result.errors.push(`week ${week}: ${(e as Error).message}`);
    }
    result.refusals.push(...workspace.refusals.map((r) => ({ ...r, week })));
  }

  result.lessons = lessons.map((l) => ({ ...l, status: lessonStatus(l) }));
  const active = result.lessons.filter((l) => l.status === 'active');
  result.habitsFound = biz.habits.filter((h) => active.some((l) => matches(h, l.lesson))).map((h) => h.id);
  result.habitsMissed = biz.habits.filter((h) => !result.habitsFound.includes(h.id)).map((h) => h.id);
  result.wrongLessons = active.filter((l) => !biz.habits.some((h) => matches(h, l.lesson))).map((l) => l.lesson);
  result.oneOffsPromoted = biz.oneOffs.filter((o) => active.some((l) => matches(o, l.lesson))).map((o) => o.id);
  result.factsStored = result.lessons.filter((l) => matches(biz.facts, l.lesson)).map((l) => l.lesson);
  result.switchedOffBack = result.lessons
    .filter((l) => switchedOff.some((o) => o.path === l.path || similarLessons(o.lesson, l.lesson) || (o.match && matches(o.match, l.lesson) && !/\b(?:no|not|never|avoid|leave out|skip|without|fewer)\b/i.test(l.lesson))))
    .map((l) => l.lesson);
  return result;
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 1000) / 10}%` : 'n/a');

(async () => {
  const results: BusinessResult[] = [];
  for (const keeper of keepers) {
    for (let rep = 0; rep < reps; rep++) {
      for (const [id, biz] of Object.entries(set.businesses)) {
        const r = await runBusiness(keeper, rep, id, biz);
        results.push(r);
        writeFileSync(path.join(runDir, `${keeper}.results.jsonl`), results.filter((x) => x.keeper === keeper).map((x) => JSON.stringify(x)).join('\n') + '\n');
        console.log(`${keeper} rep ${rep} ${id}: habits ${r.habitsFound.length}/${r.habitsFound.length + r.habitsMissed.length}, wrong ${r.wrongLessons.length}, facts ${r.factsStored.length}, off back ${r.switchedOffBack.length}, refused ${r.refusals.length}, errors ${r.errors.length}`);
      }
    }
  }
  const summary = keepers.map((keeper) => {
    const rs = results.filter((r) => r.keeper === keeper);
    const habits = rs.reduce((n, r) => n + r.habitsFound.length + r.habitsMissed.length, 0);
    const usages = rs.flatMap((r) => r.usages);
    const cost = usages.reduce((sum, u) => sum + (costUsd(u.model, u) || 0), 0);
    return {
      keeper,
      habitsFound: pct(rs.reduce((n, r) => n + r.habitsFound.length, 0), habits),
      wrongPerBusiness: rs.length ? Math.round((rs.reduce((n, r) => n + r.wrongLessons.length, 0) / rs.length) * 10) / 10 : 0,
      oneOffsPromoted: rs.reduce((n, r) => n + r.oneOffsPromoted.length, 0),
      factsStored: rs.reduce((n, r) => n + r.factsStored.length, 0),
      switchedOffBack: rs.reduce((n, r) => n + r.switchedOffBack.length, 0),
      refusals: rs.reduce((n, r) => n + r.refusals.length, 0),
      errors: rs.reduce((n, r) => n + r.errors.length, 0),
      calls: usages.length,
      costUsd: Math.round(cost * 10000) / 10000,
    };
  });
  console.table(summary);
  writeFileSync(
    path.join(runDir, 'summary.md'),
    `# Memory keeper test run: ${setName}\n\n${Object.keys(set.businesses).length} businesses, ${new Set(Object.values(set.businesses).flatMap((b) => b.signals.map((s) => s.week))).size} weeks of owner actions each, ${reps} run(s) per keeper, model ${model}.\n` +
      `Bars to ship: habits found 80% or more, at most 1 wrong lesson per business, 0 facts stored, 0 switched-off lessons back, 0 one-offs promoted.\n\n` +
      `| Keeper | Habits found | Wrong lessons per business | One-offs promoted | Facts stored | Switched-off back | Refused saves | Errors | Calls | Cost (USD) |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n` +
      summary.map((s) => `| ${s.keeper} | ${s.habitsFound} | ${s.wrongPerBusiness} | ${s.oneOffsPromoted} | ${s.factsStored} | ${s.switchedOffBack} | ${s.refusals} | ${s.errors} | ${s.calls} | ${s.costUsd} |`).join('\n') +
      `\n\nFinal lessons and every refusal are in <keeper>.results.jsonl. Habits are matched to lessons by keywords: read the lessons too.\n`
  );
  console.log(`Results in ${path.relative(process.cwd(), runDir)}`);
})();
