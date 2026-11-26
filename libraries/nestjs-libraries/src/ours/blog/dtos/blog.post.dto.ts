// OURS: request bodies for the blog post endpoints (B1). The service checks
// the words themselves (blogShapeProblem); these only cap the sizes.
// Rewrites and reject reasons use the caption DTOs (RewriteCaptionDto,
// RejectReasonDto): the same note and the same reasons.
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { NEWS_MAX } from '@gitroom/nestjs-libraries/ours/blog/blog.post.service';

// The owner's answer to "Anything new to tell customers?" (optional).
export class WriteBlogPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(NEWS_MAX)
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
