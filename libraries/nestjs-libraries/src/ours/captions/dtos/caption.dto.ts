// OURS: request bodies for the caption endpoints.
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import {
  REJECT_REASON_KEYS,
  RejectReason,
} from '@gitroom/nestjs-libraries/ours/memory/brand.signal';

export class ApproveCaptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  integrationId: string;
}

// Milestone 5: the owner's own wording. The longest platform limit is
// LinkedIn's 3,000 characters; the service checks each platform's own limit.
export class EditCaptionDto {
  @IsString()
  @MaxLength(3000)
  text: string;
}

// What the owner would like changed in a rewrite (optional).
export class RewriteCaptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

// Content engine E1: why the owner rejected a post, from a fixed list.
export class RejectReasonDto {
  @IsIn(REJECT_REASON_KEYS)
  reason: RejectReason;
}
