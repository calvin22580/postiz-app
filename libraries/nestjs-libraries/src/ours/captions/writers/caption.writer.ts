// OURS: the adapter between the caption service and whatever writes the
// captions. Claude is used when ANTHROPIC_API_KEY is set; otherwise a
// deterministic demo writer runs and the week is labelled as a demo.
import { AiCallUsage } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import { CaptionFact } from '@gitroom/nestjs-libraries/ours/captions/caption.plan';

export interface CaptionWriterInput {
  facts: CaptionFact[];
  tone: string;
  days: string[];
}

// What a writer returns before checking: unchecked captions.
export interface RawCaptionPlan {
  posts?: {
    day?: number;
    theme?: string;
    captions?: { platform?: string; text?: string; factIds?: string[] }[];
  }[];
}

export interface CaptionWriterOutput {
  raw: RawCaptionPlan;
  usages: AiCallUsage[];
}

export interface CaptionWriter {
  readonly name: 'anthropic' | 'demo';
  write(input: CaptionWriterInput): Promise<CaptionWriterOutput>;
}

export class CaptionWriterError extends Error {}

// A call that was billed but failed still carries its usage, so it is logged.
export class CaptionWriterWithUsageError extends CaptionWriterError {
  constructor(message: string, public usages: AiCallUsage[]) {
    super(message);
  }
}
