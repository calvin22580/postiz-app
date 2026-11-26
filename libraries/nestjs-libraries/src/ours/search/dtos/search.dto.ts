// OURS: request bodies for the "How people find you" endpoints (D1).
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, IsUUID, MaxLength } from 'class-validator';

export class TrackSearchesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  ids: string[];
}

export class AddSearchDto {
  @IsString()
  @MaxLength(200)
  keyword: string;
}
