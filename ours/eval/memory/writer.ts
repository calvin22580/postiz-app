// OURS: content engine E4. Does brand memory change what gets written? Writes
// the same week for each fictional business twice, once with the brand brief
// and once without, through the real caption writer and the same grounding
// check the app uses, then checks each kept caption against the owner's
// habits. The lessons are the ones a good keeper ends with (sets/<set>/writer.json),
// or a keeper run's final lessons with --from <run>/<keeper>.results.jsonl.
// How to run, and what it costs: ours/eval/README.md.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { brandBrief, Lesson } from '@gitroom/nestjs-libraries/ours/memory/brand.memory';
import { CAPTION_PLATFORMS, CaptionFact, CaptionPlatform, POSTING_DAYS } from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import { groundCaptions } from '@gitroom/nestjs-libraries/ours/captions/caption.grounding';
import { CaptionWriter, CaptionWriterWithUsageError } from '@gitroom/nestjs-libraries/ours/captions/writers/caption.writer';
import { AnthropicCaptionWriter } from '@gitroom/nestjs-libraries/ours/captions/writers/anthropic.caption.writer';
import { DemoCaptionWriter } from '@gitroom/nestjs-libraries/ours/captions/writers/demo.caption.writer';
import { costUsd } from '@gitroom/nestjs-libraries/ours/ai/ai.pricing';
import { AiCallUsage } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';

interface Check {
  id: string;
  describe: string;
  // only captions for these platforms are checked; all when not given
  platforms?: CaptionPlatform[];
  // regular expressions (case-insensitive, Unicode) a caption must or must not match
  must?: string;
  mustNot?: string;
  // at most this many words, hashtags not counted
  maxWords?: number;
  // a guard: something the brief must not take away, rather than a habit
  guard?: boolean;
}

interface WriterBusiness {
  tone: string;
  facts: CaptionFact[];
  lessons: Pick<Lesson, 'path' | 'lesson'>[];
  checks: Check[];
}

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const setName = arg('set', 'hard')!;
const writerName = arg('writer', 'demo')!;
const model = arg('model', 'claude-opus-5-5')!;
const reps = Number.parseInt(arg('reps', '1')!, 10);
const from = arg('from');

const evalRoot = path.join(process.cwd(), 'ours/eval/memory');
const set: { businesses: Record<string, WriterBusiness> } = JSON.parse(readFileSync(path.join(evalRoot, 'sets', setName, 'writer.json'), 'utf8'));
const runDir = path.join(evalRoot, 'runs', `${new Date().toISOString().replace(/[:.]/g, '-')}-${setName}-writer`);
mkdirSync(runDir, { recursive: true });

// A keeper run's final lessons, from its first run of each business.
const learned = new Map<string, Lesson[]>();
if (from) {
  for (const line of readFileSync(from, 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(line) as { business: string; lessons: Lesson[] };
    if (!learned.has(r.business)) learned.set(r.business, r.lessons);
  }
}

const lessonsFor = (id: string, biz: WriterBusiness): Lesson[] =>
  learned.get(id) || biz.lessons.map((l) => ({ ...l, evidence: ['a', 'b'], against: [], source: 'keeper' as const }));

const writerFor = (): CaptionWriter => {
  if (writerName === 'demo') return new DemoCaptionWriter();
  if (writerName === 'anthropic') return new AnthropicCaptionWriter(new Anthropic(), model);
  throw new Error(`Unknown writer ${writerName}: use demo or anthropic`);
};

const platforms = CAPTION_PLATFORMS.map((p) => p.key);
const words = (text: string) => text.replace(/#[\p{L}\d_]+/gu, ' ').split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w)).length;
const passes = (c: Check, text: string) =>
  (!c.must || new RegExp(c.must, 'iu').test(text)) &&
  (!c.mustNot || !new RegExp(c.mustNot, 'iu').test(text)) &&
  (!c.maxWords || words(text) <= c.maxWords);

interface WeekResult {
  business: string;
  memory: boolean;
  rep: number;
  brief: string;
  captions: { day: number; platform: CaptionPlatform; text: string; failed: string[] }[];
  dropped: number;
  dropReasons: string[];
  checks: Record<string, { passed: number; of: number }>;
  errors: string[];
  usages: AiCallUsage[];
}

async function writeWeek(id: string, biz: WriterBusiness, memory: boolean, rep: number): Promise<WeekResult> {
  const brief = memory ? brandBrief(lessonsFor(id, biz)) : '';
  const result: WeekResult = { business: id, memory, rep, brief, captions: [], dropped: 0, dropReasons: [], checks: {}, errors: [], usages: [] };
  const days = [...POSTING_DAYS];
  try {
    const out = await writerFor().write({ facts: biz.facts, tone: biz.tone, days, platforms, brief: brief || undefined });
    result.usages.push(...out.usages);
    const { captions: kept, dropped, reasons } = groundCaptions(out.raw, biz.facts, days.length, platforms);
    result.dropped = dropped;
    result.dropReasons = reasons;
    result.captions = kept.map((c) => ({
      day: c.day,
      platform: c.platform,
      text: c.text,
      failed: biz.checks.filter((k) => (!k.platforms || k.platforms.includes(c.platform)) && !passes(k, c.text)).map((k) => k.id),
    }));
  } catch (e) {
    if (e instanceof CaptionWriterWithUsageError) result.usages.push(...e.usages);
    result.errors.push((e as Error).message);
  }
  for (const k of biz.checks) {
    const applies = result.captions.filter((c) => !k.platforms || k.platforms.includes(c.platform));
    result.checks[k.id] = { passed: applies.filter((c) => !c.failed.includes(k.id)).length, of: applies.length };
  }
  return result;
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : 'n/a');
const cost = (rs: WeekResult[]) => Math.round(rs.flatMap((r) => r.usages).reduce((sum, u) => sum + (costUsd(u.model, u) || 0), 0) * 10000) / 10000;

(async () => {
  const results: WeekResult[] = [];
  for (let rep = 0; rep < reps; rep++) {
    for (const [id, biz] of Object.entries(set.businesses)) {
      for (const memory of [false, true]) {
        const r = await writeWeek(id, biz, memory, rep);
        results.push(r);
        writeFileSync(path.join(runDir, 'results.jsonl'), results.map((x) => JSON.stringify(x)).join('\n') + '\n');
        console.log(`rep ${rep} ${id} ${memory ? 'with memory' : 'without memory'}: kept ${r.captions.length}, dropped ${r.dropped}, ${Object.entries(r.checks).map(([k, v]) => `${k} ${v.passed}/${v.of}`).join(', ')}${r.errors.length ? `, errors ${r.errors.length}` : ''}`);
      }
    }
  }

  const rows = Object.entries(set.businesses).flatMap(([id, biz]) =>
    biz.checks.map((k) => {
      const share = (memory: boolean) => {
        const rs = results.filter((r) => r.business === id && r.memory === memory);
        return pct(rs.reduce((n, r) => n + r.checks[k.id].passed, 0), rs.reduce((n, r) => n + r.checks[k.id].of, 0));
      };
      return { business: id, check: `${k.describe}${k.guard ? ' (guard)' : ''}`, without: share(false), with: share(true) };
    })
  );
  const totals = [false, true].map((memory) => {
    const rs = results.filter((r) => r.memory === memory);
    return { memory, kept: rs.reduce((n, r) => n + r.captions.length, 0), dropped: rs.reduce((n, r) => n + r.dropped, 0), errors: rs.reduce((n, r) => n + r.errors.length, 0), costUsd: cost(rs) };
  });
  console.table(rows);
  console.table(totals);
  writeFileSync(
    path.join(runDir, 'summary.md'),
    `# Writer test: ${setName}, with and without brand memory\n\n` +
      `${Object.keys(set.businesses).length} businesses, one week each (${POSTING_DAYS.length} days, ${platforms.length} platforms), ${reps} run(s), writer ${writerName}${writerName === 'demo' ? '' : ` (${model})`}, lessons ${from ? `from ${path.basename(path.dirname(from))}/${path.basename(from)}` : 'from writer.json'}.\n` +
      `Each cell is the share of kept captions that pass the check.\n\n` +
      `| Business | Check | Without memory | With memory |\n| --- | --- | --- | --- |\n` +
      rows.map((r) => `| ${r.business} | ${r.check} | ${r.without} | ${r.with} |`).join('\n') +
      `\n\n| | Captions kept | Dropped by the grounding check | Errors | Cost (USD) |\n| --- | --- | --- | --- | --- |\n` +
      totals.map((t) => `| ${t.memory ? 'With memory' : 'Without memory'} | ${t.kept} | ${t.dropped} | ${t.errors} | ${t.costUsd} |`).join('\n') +
      `\n\nEvery caption, the brief it was written with and which checks it failed are in results.jsonl.\n`
  );
  console.log(`Results in ${path.relative(process.cwd(), runDir)}`);
})();
