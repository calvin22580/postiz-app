// OURS: content engine E2. The adapter between the caption service and the
// Checker, the step that reads each written caption against the business
// profile and passes it, fixes it once, or drops it. It runs after the writer
// and before groundCaptions(), which still checks every caption last. It is
// off unless OURS_CAPTION_CHECKER=true (ours/docs/content-engine.md).
import { AiCallUsage } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import { CaptionFact } from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import { RawCaptionPlan } from '@gitroom/nestjs-libraries/ours/captions/writers/caption.writer';

export const CHECK_VERDICTS = ['pass', 'fix', 'drop'] as const;
export type CheckVerdict = (typeof CHECK_VERDICTS)[number];

export interface CaptionToCheck {
  // `${day}:${platform}`, unique within one plan
  key: string;
  platform: string;
  text: string;
}

export interface CaptionCheckInput {
  facts: CaptionFact[];
  captions: CaptionToCheck[];
}

export interface CaptionCheckResult {
  key: string;
  verdict: CheckVerdict;
  // the claims about the business found in the caption, each matched to a
  // fact id, or to null when nothing in the profile supports it
  claims: { claim: string; factId: string | null }[];
  // the corrected caption, when the verdict is fix
  text?: string;
}

export interface CaptionCheckOutput {
  results: CaptionCheckResult[];
  usages: AiCallUsage[];
}

export interface CaptionChecker {
  readonly name: 'anthropic' | 'demo';
  check(input: CaptionCheckInput): Promise<CaptionCheckOutput>;
}

export class CaptionCheckerError extends Error {
  constructor(message: string, public usages: AiCallUsage[] = []) {
    super(message);
  }
}

export const captionKey = (day: unknown, platform: unknown) =>
  `${Number(day)}:${String(platform || '')}`;

// Every caption in a writer's plan, as the Checker sees it.
export const captionsToCheck = (raw: RawCaptionPlan): CaptionToCheck[] =>
  (raw?.posts || []).flatMap((post) =>
    (post?.captions || [])
      .filter((c) => String(c?.text || '').trim())
      .map((c) => ({
        key: captionKey(post?.day, c?.platform),
        platform: String(c?.platform || ''),
        text: String(c?.text || '').trim(),
      }))
  );

// The plan with the Checker's verdicts applied: a fixed caption gets the new
// text, a dropped one is removed. A caption the Checker said nothing about
// is left as it is; groundCaptions() still checks everything afterwards.
export const applyChecks = (raw: RawCaptionPlan, results: CaptionCheckResult[]) => {
  const byKey = new Map(results.map((r) => [r.key, r]));
  let fixed = 0;
  let dropped = 0;
  const posts = (raw?.posts || []).map((post) => ({
    ...post,
    captions: (post?.captions || []).flatMap((c) => {
      const result = byKey.get(captionKey(post?.day, c?.platform));
      if (result?.verdict === 'drop') {
        dropped++;
        return [];
      }
      if (result?.verdict === 'fix' && result.text?.trim()) {
        fixed++;
        return [{ ...c, text: result.text.trim() }];
      }
      if (result?.verdict === 'fix') {
        // a fix with no new text can't be trusted, so the caption goes
        dropped++;
        return [];
      }
      return [c];
    }),
  }));
  return { raw: { ...raw, posts } as RawCaptionPlan, fixed, dropped };
};
