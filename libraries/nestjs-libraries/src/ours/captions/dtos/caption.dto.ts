// OURS: request bodies for the caption endpoints.
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ApproveCaptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  integrationId: string;
}
