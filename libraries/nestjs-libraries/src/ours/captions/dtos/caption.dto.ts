// OURS: request bodies for the caption endpoints.
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
