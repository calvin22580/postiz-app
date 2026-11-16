// OURS: request bodies for the UK dates endpoints.
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { UK_NATIONS } from '@gitroom/nestjs-libraries/ours/seasonal/uk.calendar';

export class SeasonalSettingsDto {
  @IsOptional()
  @IsString()
  @IsIn(UK_NATIONS.map((n) => n.key))
  nation?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class SkipMomentDto {
  @IsBoolean()
  skip: boolean;
}
