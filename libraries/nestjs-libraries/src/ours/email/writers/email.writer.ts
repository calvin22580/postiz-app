// OURS: the adapter between email campaigns (EM3) and whatever writes the
// email, like CaptionWriter for posts. Claude is used when ANTHROPIC_API_KEY
// is set; otherwise a deterministic demo writer runs and the email is
// labelled as a demo. Whatever comes back is checked by groundEmail().
import { AiCallUsage } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import { CaptionFact } from '@gitroom/nestjs-libraries/ours/captions/caption.plan';

export interface EmailWriterInput {
  // profile facts, plus any UK dates near the send date
  facts: CaptionFact[];
  tone: string;
  // the day it is planned to go (YYYY-MM-DD), so a UK date is talked about
  // correctly
  sendDate: string;
  // subjects of the business's recent emails, so the next one is different
  recentSubjects: string[];
}

export interface EmailContent {
  subject: string;
  previewText: string;
  body: string;
}

// One email again, because the owner asked for a different version.
export interface EmailRewriteInput extends EmailWriterInput {
  current: EmailContent;
  // what the owner would like changed, in their own words (optional)
  note?: string;
  // how many times this email was rewritten before
  attempt: number;
}

// What a writer returns before checking.
export interface RawEmail {
  subject?: string;
  previewText?: string;
  body?: string;
  factIds?: string[];
}

export interface EmailWriterOutput {
  raw: RawEmail;
  usages: AiCallUsage[];
}

export interface EmailWriter {
  readonly name: 'anthropic' | 'demo';
  write(input: EmailWriterInput): Promise<EmailWriterOutput>;
  rewrite(input: EmailRewriteInput): Promise<EmailWriterOutput>;
}
