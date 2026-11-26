// OURS: request bodies for the blog post endpoints (B1). The service checks
// the words themselves (blogShapeProblem); these only cap the sizes.
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  REJECT_REASON_KEYS,
  RejectReason,
} from '@gitroom/nestjs-libraries/ours/memory/brand.signal';

// The owner's answer to "Anything new to tell customers?" (optional).
export class WriteBlogPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(600)
  news?: string;
}

export class EditBlogPostDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(400)
  description: string;

  @IsString()
  @MaxLength(30000)
  body: string;
}

// What the owner would like changed in a rewrite (optional).
export class RewriteBlogPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class BlogRejectReasonDto {
  @IsIn(REJECT_REASON_KEYS)
  reason: RejectReason;
}
