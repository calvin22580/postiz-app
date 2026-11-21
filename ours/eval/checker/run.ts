// OURS: content engine E2. Runs the caption Checker over a labelled test set
// and scores it against the labels, next to today's hard rules alone. It
// calls the real Checker (the same prompt, schema and model settings the app
// uses), a whole profile's captions per call like a written week.
// How to run, and what it costs: ours/eval/README.md.
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { CaptionFact } from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import { unsupportedDetails } from '@gitroom/nestjs-libraries/ours/captions/caption.grounding';
import {
  CaptionChecker,
  CaptionCheckerError,
  CaptionCheckResult,
  CaptionToCheck,
} from '@gitroom/nestjs-libraries/ours/captions/checkers/caption.checker';
import { AnthropicCaptionChecker } from '@gitroom/nestjs-libraries/ours/captions/checkers/anthropic.caption.checker';
import { DemoCaptionChecker } from '@gitroom/nestjs-libraries/ours/captions/checkers/demo.caption.checker';
import { costUsd } from '@gitroom/nestjs-libraries/ours/ai/ai.pricing';
import { AiCallUsage } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';

interface TestCase {
  id: string;
  profile: string;
  platform: string;
  text: string;
  // true: every claim is in the profile; invented: the one detail that isn't
  label: { kind: 'true' } | { kind: 'invented'; detail: string };
  tags?: string[];
}

interface TestSet {
  profiles: Record<string, { name: string; facts: CaptionFact[] }>;
  cases: TestCase[];
}

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const setName = arg('set', 'sample')!;
const models = arg('models', 'demo')!.split(',');
const reps = Number.parseInt(arg('reps', '1')!, 10);
const limit = Number.parseInt(arg('limit', '0')!, 10);
// captions per call: a written week has up to about a dozen
const chunkSize = 12;

// run from the repo root (run.sh does)
const evalRoot = path.join(process.cwd(), 'ours/eval/checker');
const set: TestSet = JSON.parse(readFileSync(path.join(evalRoot, 'sets', setName, 'cases.json'), 'utf8'));
const cases = limit > 0 ? set.cases.slice(0, limit) : set.cases;

const runDir = path.join(evalRoot, 'runs', `${new Date().toISOString().replace(/[:.]/g, '-')}-${setName}`);
mkdirSync(runDir, { recursive: true });

const checkerFor = (model: string): CaptionChecker =>
  model === 'demo' ? new DemoCaptionChecker() : new AnthropicCaptionChecker(undefined, model);

const chunks = <T>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

const caught = (verdict: string | undefined) => verdict === 'fix' || verdict === 'drop';

interface Row {
  prompt_id: string;
  prompt: string;
  tags: string[];
  model: string;
  rep: number;
  status: 'ok' | 'error';
  verdict?: string;
  claims?: CaptionCheckResult['claims'];
  fixed_text?: string;
  // the hard rules on the fixed text: a fix that still fails them is dropped
  fix_passes_rules?: boolean;
  grade?: Record<string, number>;
  error?: string;
}

const usagesByModel = new Map<string, AiCallUsage[]>();

async function runModel(model: string, rep: number) {
  const checker = checkerFor(model);
  const file = path.join(runDir, `${model}.results.jsonl`);
  const byProfile = new Map<string, TestCase[]>();
  for (const c of cases) {
    byProfile.set(c.profile, [...(byProfile.get(c.profile) || []), c]);
  }
  for (const [profileId, list] of byProfile) {
    const facts = set.profiles[profileId]?.facts || [];
    for (const group of chunks(list, chunkSize)) {
      const captions: CaptionToCheck[] = group.map((c, i) => ({ key: `c${i}`, platform: c.platform, text: c.text }));
      let results: CaptionCheckResult[] = [];
      let error: string | undefined;
      try {
        const out = await checker.check({ facts, captions });
        results = out.results;
        usagesByModel.set(model, [...(usagesByModel.get(model) || []), ...out.usages]);
      } catch (e) {
        error = (e as Error).message;
        if (e instanceof CaptionCheckerError) {
          usagesByModel.set(model, [...(usagesByModel.get(model) || []), ...e.usages]);
        }
      }
      group.forEach((c, i) => {
        const result = results.find((r) => r.key === `c${i}`);
        const invented = c.label.kind === 'invented';
        const row: Row = error || !result
          ? { prompt_id: c.id, prompt: c.text, tags: [c.label.kind, ...(c.tags || [])], model, rep, status: 'error', error: error || 'no result for this caption' }
          : {
              prompt_id: c.id,
              prompt: c.text,
              tags: [c.label.kind, ...(c.tags || [])],
              model,
              rep,
              status: 'ok',
              verdict: result.verdict,
              claims: result.claims,
              ...(result.verdict === 'fix'
                ? {
                    fixed_text: result.text,
                    fix_passes_rules: !unsupportedDetails(result.text || '', facts).length,
                  }
                : {}),
              grade: invented ? { caught: caught(result.verdict) ? 1 : 0 } : { kept: result.verdict === 'pass' ? 1 : 0 },
            };
        appendFileSync(file, JSON.stringify(row) + '\n');
      });
    }
  }
}

// Today's hard rules alone, for comparison: free and instant.
function rulesBaseline() {
  const file = path.join(runDir, 'rules.results.jsonl');
  for (const c of cases) {
    const facts = set.profiles[c.profile]?.facts || [];
    const flagged = unsupportedDetails(c.text, facts).length > 0;
    const row: Row = {
      prompt_id: c.id,
      prompt: c.text,
      tags: [c.label.kind, ...(c.tags || [])],
      model: 'rules',
      rep: 0,
      status: 'ok',
      verdict: flagged ? 'drop' : 'pass',
      grade: c.label.kind === 'invented' ? { caught: flagged ? 1 : 0 } : { kept: flagged ? 0 : 1 },
    };
    appendFileSync(file, JSON.stringify(row) + '\n');
  }
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 1000) / 10}%` : 'n/a');

function summarise(name: string) {
  const rows: Row[] = readFileSync(path.join(runDir, `${name}.results.jsonl`), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  const ok = rows.filter((r) => r.status === 'ok');
  const invented = ok.filter((r) => r.tags[0] === 'invented');
  const truePosts = ok.filter((r) => r.tags[0] === 'true');
  const fixes = ok.filter((r) => r.verdict === 'fix');
  const usages = usagesByModel.get(name) || [];
  const cost = usages.reduce(
    (sum, u) => sum + (costUsd(u.model, { inputTokens: u.inputTokens, outputTokens: u.outputTokens, cacheReadTokens: u.cacheReadTokens, cacheWriteTokens: u.cacheWriteTokens }) || 0),
    0
  );
  return {
    name,
    caught: pct(invented.filter((r) => r.grade?.caught).length, invented.length),
    kept: pct(truePosts.filter((r) => r.grade?.kept).length, truePosts.length),
    fixes: fixes.length,
    fixesPassRules: pct(fixes.filter((r) => r.fix_passes_rules).length, fixes.length),
    errors: rows.length - ok.length,
    calls: usages.length,
    costUsd: Math.round(cost * 10000) / 10000,
  };
}

(async () => {
  rulesBaseline();
  for (const model of models) {
    for (let rep = 0; rep < reps; rep++) {
      await runModel(model, rep);
    }
  }
  const summary = ['rules', ...models].map(summarise);
  console.table(summary);
  writeFileSync(
    path.join(runDir, 'summary.md'),
    `# Checker test run: ${setName}\n\n${cases.length} captions (${cases.filter((c) => c.label.kind === 'invented').length} with an invented detail), ${reps} run(s) per model.\n\n` +
      `| Step | Mistakes caught | True posts kept | Fixes | Fixes passing the hard rules | Errors | Calls | Cost (USD) |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n` +
      summary.map((s) => `| ${s.name} | ${s.caught} | ${s.kept} | ${s.fixes} | ${s.fixesPassRules} | ${s.errors} | ${s.calls} | ${s.costUsd} |`).join('\n') +
      '\n'
  );
  console.log(`Results in ${path.relative(process.cwd(), runDir)}`);
})();
