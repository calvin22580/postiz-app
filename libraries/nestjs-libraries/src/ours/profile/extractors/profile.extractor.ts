// OURS: the adapter between the profile service and whatever reads the pages.
// The Anthropic extractor is used when ANTHROPIC_API_KEY is set; otherwise a
// deterministic demo extractor runs, and the profile is labelled as a demo.
import { RawExtraction } from '@gitroom/nestjs-libraries/ours/profile/business.profile.fields';
import { AiCallUsage } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';

export interface ExtractorPage {
  url: string;
  title: string;
  text: string;
}

export interface ExtractionOutput {
  raw: RawExtraction;
  usages: AiCallUsage[];
}

export interface ProfileExtractor {
  readonly name: 'anthropic' | 'demo';
  extract(pages: ExtractorPage[]): Promise<ExtractionOutput>;
}

export class ExtractionError extends Error {}
