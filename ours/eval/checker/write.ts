// OURS: content engine E2. Makes an unseen Checker test set: the real caption
// writer (the app's prompt and model, Checker off) writes weeks of posts for
// fictional businesses it has never seen, and the hard rules drop what the app
// would drop. Each kept post comes out unlabelled, with its posting slot, for
// people (or independent labellers) to label against the profile.
// Reads sets/<set>/profiles.json, writes sets/<set>/written.json.
// How to run, and what it costs: ours/eval/README.md.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import dayjs from 'dayjs';
import Anthropic from '@anthropic-ai/sdk';
import { CAPTION_PLATFORMS, CaptionFact, longDate, POSTING_DAYS } from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import { groundCaptions } from '@gitroom/nestjs-libraries/ours/captions/caption.grounding';
import { CaptionWriter, CaptionWriterWithUsageError } from '@gitroom/nestjs-libraries/ours/captions/writers/caption.writer';
import { AnthropicCaptionWriter } from '@gitroom/nestjs-libraries/ours/captions/writers/anthropic.caption.writer';
import { DemoCaptionWriter } from '@gitroom/nestjs-libraries/ours/captions/writers/demo.caption.writer';
import { costUsd } from '@gitroom/nestjs-libraries/ours/ai/ai.pricing';
import { AiCallUsage } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';

interface Profile {
  name: string;
  tone: string;
  facts: CaptionFact[];
}

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const setName = arg('set', 'unseen')!;
const writerName = arg('writer', 'demo')!;
const model = arg('model', 'claude-opus-5-5')!;
const weeks = Number.parseInt(arg('weeks', '2')!, 10);
// the Monday of the first week written
const firstWeek = arg('from', '2026-11-30')!;

const setDir = path.join(process.cwd(), 'ours/eval/checker/sets', setName);
const { profiles }: { profiles: Record<string, Profile> } = JSON.parse(readFileSync(path.join(setDir, 'profiles.json'), 'utf8'));

const writer: CaptionWriter =
  writerName === 'anthropic' ? new AnthropicCaptionWriter(new Anthropic(), model) : new DemoCaptionWriter();
const platforms = CAPTION_PLATFORMS.map((p) => p.key);
const time = (platform: string) => CAPTION_PLATFORMS.find((p) => p.key === platform)!.time;

(async () => {
  const posts: Record<string, unknown>[] = [];
  const usages: AiCallUsage[] = [];
  const notes: string[] = [];
  for (const [id, profile] of Object.entries(profiles)) {
    for (let w = 0; w < weeks; w++) {
      const weekStart = dayjs(firstWeek).add(w * 7, 'day');
      const dates = POSTING_DAYS.map((_, i) => weekStart.add(i, 'day').format('YYYY-MM-DD'));
      try {
        const out = await writer.write({ facts: profile.facts, tone: profile.tone, days: [...POSTING_DAYS], dates, platforms });
        usages.push(...out.usages);
        const { captions, dropped, reasons } = groundCaptions(out.raw, profile.facts, POSTING_DAYS.length, platforms);
        for (const c of captions) {
          posts.push({
            profile: id,
            week: w + 1,
            platform: c.platform,
            postsAt: `${longDate(dates[c.day])}, ${time(c.platform)}`,
            theme: c.theme,
            factIds: c.facts.map((f) => f.id),
            text: c.text,
          });
        }
        notes.push(`${id} week ${w + 1}: kept ${captions.length}, dropped ${dropped}${reasons.length ? ` (${reasons.join('; ')})` : ''}`);
      } catch (e) {
        if (e instanceof CaptionWriterWithUsageError) usages.push(...e.usages);
        notes.push(`${id} week ${w + 1}: failed: ${(e as Error).message}`);
      }
      console.log(notes[notes.length - 1]);
    }
  }
  const cost = Math.round(usages.reduce((sum, u) => sum + (costUsd(u.model, u) || 0), 0) * 10000) / 10000;
  writeFileSync(
    path.join(setDir, 'written.json'),
    JSON.stringify({ writer: writerName === 'anthropic' ? model : 'demo', notes, costUsd: cost, posts }, null, 1) + '\n'
  );
  console.log(`${posts.length} posts, cost $${cost}. Written to ${path.relative(process.cwd(), path.join(setDir, 'written.json'))}`);
})();
