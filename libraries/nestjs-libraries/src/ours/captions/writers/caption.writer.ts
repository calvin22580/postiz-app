// OURS: the adapter between the caption service and whatever writes the
// captions. Claude is used when ANTHROPIC_API_KEY is set; otherwise a
// deterministic demo writer runs and the week is labelled as a demo.
import { AiCallUsage } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import {
  CaptionFact,
  CaptionPlatform,
} from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import { WriterPreferences } from '@gitroom/nestjs-libraries/ours/performance/performance.insights';

export interface CaptionWriterInput {
  facts: CaptionFact[];
  tone: string;
  days: string[];
  // Milestone 6: the date of each posting day (YYYY-MM-DD), so a caption can
  // say "this Friday" about a UK date correctly
  dates?: string[];
  // Milestone 8: kinds of post that did clearly better or worse on this
  // business's past posts. A preference for choosing ideas, never a fact.
  preferences?: Pick<WriterPreferences, 'favour' | 'avoid'>;
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

// Milestone 5: one caption written again, because the owner asked for a
// different version. The result is a plan with a single post (day 0) and is
// checked by groundCaptions() like a full week.
export interface CaptionRewriteInput {
  facts: CaptionFact[];
  tone: string;
  day: string;
  // the posting date (YYYY-MM-DD)
  date?: string;
  platform: CaptionPlatform;
  theme: string;
  // the version the owner wants replaced
  current: string;
  // what the owner would like changed, in their own words (optional)
  note?: string;
  // how many times this caption was rewritten before
  attempt: number;
}

export interface CaptionWriter {
  readonly name: 'anthropic' | 'demo';
  write(input: CaptionWriterInput): Promise<CaptionWriterOutput>;
  rewrite(input: CaptionRewriteInput): Promise<CaptionWriterOutput>;
}

export class CaptionWriterError extends Error {}

// A call that was billed but failed still carries its usage, so it is logged.
export class CaptionWriterWithUsageError extends CaptionWriterError {
  constructor(message: string, public usages: AiCallUsage[]) {
    super(message);
  }
}
