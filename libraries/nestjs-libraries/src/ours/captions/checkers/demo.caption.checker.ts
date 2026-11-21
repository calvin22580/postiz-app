// OURS: content engine E2. Used when the Checker is on but there is no
// ANTHROPIC_API_KEY: it passes every caption unchanged and costs nothing, so
// the app and tests run. groundCaptions() still checks every caption.
import {
  CaptionCheckInput,
  CaptionCheckOutput,
  CaptionChecker,
} from '@gitroom/nestjs-libraries/ours/captions/checkers/caption.checker';

export class DemoCaptionChecker implements CaptionChecker {
  readonly name = 'demo' as const;

  async check(input: CaptionCheckInput): Promise<CaptionCheckOutput> {
    return {
      results: input.captions.map((c) => ({ key: c.key, verdict: 'pass' as const, claims: [] })),
      usages: [],
    };
  }
}
