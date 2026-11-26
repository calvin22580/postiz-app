// OURS: blog posts B1. Runs the blog Checker over the labelled long-post test
// set and scores it against the labels, next to the hard rules alone, like
// ours/eval/checker/run.ts does for captions. It calls the real Checker (the
// same prompt, schema and model settings the app uses), one post per call as
// the app does.
// How to run, and what it costs: ours/eval/README.md.
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { BlogContent, BlogFact } from '@gitroom/nestjs-libraries/ours/blog/writers/blog.writer';
import { blogShapeProblem, unsupportedBlogDetails } from '@gitroom/nestjs-libraries/ours/blog/blog.grounding';
import { applyBlogCheck, BlogChecker, BlogCheckResult, BlogPart } from '@gitroom/nestjs-libraries/ours/blog/checkers/blog.checker';
import { AnthropicBlogChecker } from '@gitroom/nestjs-libraries/ours/blog/checkers/anthropic.blog.checker';
import { DemoBlogChecker } from '@gitroom/nestjs-libraries/ours/blog/checkers/demo.blog.checker';
import { CaptionCheckerError } from '@gitroom/nestjs-libraries/ours/captions/checkers/caption.checker';
import { costUsd } from '@gitroom/nestjs-libraries/ours/ai/ai.pricing';
import { AiCallUsage } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';

type Label = { kind: 'true' } | { kind: 'invented'; detail: string; grade?: 'clear' | 'borderline' };

// A post every claim of which is in the profile.
interface BasePost extends BlogContent {
  id: string;
  profile: string;
}

// One change to a base post: find appears exactly once in the part. For an
// invented label, detail is the exact planted text a fix has to remove.
interface Plant {
  id: string;
  post: string;
  part: BlogPart;
  find: string;
  replace: string;
  label: Label;
  tags?: string[];
}

interface TestSet {
  profiles: Record<string, { name: string; facts: BlogFact[] }>;
  posts: BasePost[];
  plants: Plant[];
}

interface TestCase {
  id: string;
  profile: string;
  post: BlogContent;
  label: Label;
  tags: string[];
}

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const setName = arg('set', 'long')!;
const models = arg('models', 'demo')!.split(',');
const reps = Number.parseInt(arg('reps', '1')!, 10);
const limit = Number.parseInt(arg('limit', '0')!, 10);

// run from the repo root (run.sh does)
const evalRoot = path.join(process.cwd(), 'ours/eval/blog');
const set: TestSet = JSON.parse(readFileSync(path.join(evalRoot, 'sets', setName, 'cases.json'), 'utf8'));

// the base posts as true cases, then each plant applied to its base post
const allCases: TestCase[] = [
  ...set.posts.map((p) => ({
    id: p.id,
    profile: p.profile,
    post: { title: p.title, description: p.description, body: p.body },
    label: { kind: 'true' as const },
    tags: ['base'],
  })),
  ...set.plants.map((pl) => {
    const base = set.posts.find((p) => p.id === pl.post);
    if (!base || base[pl.part].split(pl.find).length !== 2) {
      throw new Error(`Plant ${pl.id}: its text must appear exactly once in ${pl.post} ${pl.part}`);
    }
    const post = { title: base.title, description: base.description, body: base.body };
    post[pl.part] = post[pl.part].replace(pl.find, () => pl.replace);
    return { id: pl.id, profile: base.profile, post, label: pl.label, tags: pl.tags || [] };
  }),
];
const cases = limit > 0 ? allCases.slice(0, limit) : allCases;

const runDir = path.join(evalRoot, 'runs', `${new Date().toISOString().replace(/[:.]/g, '-')}-${setName}`);
mkdirSync(runDir, { recursive: true });

const checkerFor = (model: string): BlogChecker =>
  model === 'demo' ? new DemoBlogChecker() : new AnthropicBlogChecker(undefined, model);

const caught = (verdict: string | undefined) => verdict === 'fix' || verdict === 'drop';
const allText = (post: BlogContent) => [post.title, post.description, post.body].join('\n');

interface Row {
  prompt_id: string;
  tags: string[];
  model: string;
  rep: number;
  status: 'ok' | 'error';
  verdict?: string;
  claims?: BlogCheckResult['claims'];
  edits?: BlogCheckResult['edits'];
  // a fix whose edits all applied, still passes the hard rules and the shape
  // check, and no longer has the planted detail
  fix_usable?: boolean;
  grade?: Record<string, number>;
  error?: string;
}

// the label first, then its grade, then the case's own tags
const labelTags = (c: TestCase) => [
  c.label.kind,
  ...(c.label.kind === 'invented' ? [c.label.grade || 'clear'] : []),
  ...c.tags,
];

const usagesByModel = new Map<string, AiCallUsage[]>();

async function runModel(model: string, rep: number) {
  const checker = checkerFor(model);
  const file = path.join(runDir, `${model}.results.jsonl`);
  for (const c of cases) {
    const facts = set.profiles[c.profile]?.facts || [];
    let row: Row;
    try {
      const { result, usages } = await checker.check({ facts, post: c.post });
      usagesByModel.set(model, [...(usagesByModel.get(model) || []), ...usages]);
      const fixed = result.verdict === 'fix' ? applyBlogCheck(c.post, result).post : null;
      row = {
        prompt_id: c.id,
        tags: labelTags(c),
        model,
        rep,
        status: 'ok',
        verdict: result.verdict,
        claims: result.claims,
        ...(result.verdict === 'fix'
          ? {
              edits: result.edits,
              fix_usable:
                !!fixed &&
                !blogShapeProblem(fixed) &&
                !unsupportedBlogDetails(fixed, facts).length &&
                (c.label.kind !== 'invented' || !allText(fixed).includes(c.label.detail)),
            }
          : {}),
        grade: c.label.kind === 'invented' ? { caught: caught(result.verdict) ? 1 : 0 } : { kept: result.verdict === 'pass' ? 1 : 0 },
      };
    } catch (e) {
      if (e instanceof CaptionCheckerError) {
        usagesByModel.set(model, [...(usagesByModel.get(model) || []), ...e.usages]);
      }
      row = { prompt_id: c.id, tags: labelTags(c), model, rep, status: 'error', error: (e as Error).message };
    }
    appendFileSync(file, JSON.stringify(row) + '\n');
  }
}

// The hard rules alone, for comparison: free and instant.
function rulesBaseline() {
  const file = path.join(runDir, 'rules.results.jsonl');
  for (const c of cases) {
    const facts = set.profiles[c.profile]?.facts || [];
    const flagged = unsupportedBlogDetails(c.post, facts).length > 0;
    const row: Row = {
      prompt_id: c.id,
      tags: labelTags(c),
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
  const invented = (grade: string) => ok.filter((r) => r.tags[0] === 'invented' && r.tags[1] === grade);
  const caughtPct = (grade: string) => pct(invented(grade).filter((r) => r.grade?.caught).length, invented(grade).length);
  const truePosts = ok.filter((r) => r.tags[0] === 'true');
  const fixes = ok.filter((r) => r.verdict === 'fix');
  const usages = usagesByModel.get(name) || [];
  const cost = usages.reduce(
    (sum, u) => sum + (costUsd(u.model, { inputTokens: u.inputTokens, outputTokens: u.outputTokens, cacheReadTokens: u.cacheReadTokens, cacheWriteTokens: u.cacheWriteTokens }) || 0),
    0
  );
  return {
    name,
    caught: caughtPct('clear'),
    borderline: caughtPct('borderline'),
    kept: pct(truePosts.filter((r) => r.grade?.kept).length, truePosts.length),
    fixes: fixes.length,
    fixesUsable: pct(fixes.filter((r) => r.fix_usable).length, fixes.length),
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
    `# Blog Checker test run: ${setName}\n\n${cases.length} posts (${cases.filter((c) => c.label.kind === 'invented').length} with an invented detail), ${reps} run(s) per model. ` +
      `Clear mistakes count towards the ship bar; borderline ones are reported, not scored.\n\n` +
      `| Step | Clear mistakes caught | True posts kept | Borderline flagged | Fixes | Fixes usable | Errors | Calls | Cost (USD) |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n` +
      summary.map((s) => `| ${s.name} | ${s.caught} | ${s.kept} | ${s.borderline} | ${s.fixes} | ${s.fixesUsable} | ${s.errors} | ${s.calls} | ${s.costUsd} |`).join('\n') +
      '\n'
  );
  console.log(`Results in ${path.relative(process.cwd(), runDir)}`);
})();
