// OURS: request bodies for the business profile endpoints.
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class BuildBusinessProfileDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  url: string;
}

export class UpdateProfileFieldDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(600, { each: true })
  values: string[];
}
