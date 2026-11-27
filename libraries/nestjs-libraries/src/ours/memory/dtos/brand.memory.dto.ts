// OURS: content engine E5. Request bodies for the "What we've learned" screen.
import { IsString, MaxLength, MinLength } from 'class-validator';
import { MAX_LESSON_LENGTH } from '@gitroom/nestjs-libraries/ours/memory/brand.memory';

// A lesson the owner writes or rewrites in their own words.
export class OwnerLessonDto {
  @IsString()
  @MinLength(3, { message: 'Write a few words about how you like your posts.' })
  @MaxLength(MAX_LESSON_LENGTH, { message: `Keep it to ${MAX_LESSON_LENGTH} characters.` })
  lesson: string;
}
