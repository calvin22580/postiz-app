// OURS: blog post endpoints (B1), under /ours/blog-posts. The organisation
// always comes from the signed-in session. Everything answers 404 unless
// OURS_BLOG_POSTS=true, except the overview, which says it is off.
import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { BlogPostService } from '@gitroom/nestjs-libraries/ours/blog/blog.post.service';
import {
  RejectReasonDto,
  RewriteCaptionDto,
} from '@gitroom/nestjs-libraries/ours/captions/dtos/caption.dto';
import {
  EditBlogPostDto,
  WriteBlogPostDto,
} from '@gitroom/nestjs-libraries/ours/blog/dtos/blog.post.dto';

@ApiTags('Blog posts')
@Controller('/ours/blog-posts')
export class BlogPostsController {
  constructor(private _blogPostService: BlogPostService) {}

  @Get('/')
  overview(@GetOrgFromRequest() org: Organization) {
    return this._blogPostService.overview(org.id);
  }

  @Post('/write')
  write(@GetOrgFromRequest() org: Organization, @Body() body: WriteBlogPostDto) {
    return this._blogPostService.startWriting(org.id, body.news);
  }

  // Approving publishes nothing: the owner copies the post into their website.
  @Post('/:id/approve')
  approve(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._blogPostService.approve(org.id, id);
  }

  @Put('/:id/words')
  editWords(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: EditBlogPostDto
  ) {
    return this._blogPostService.editWords(org.id, id, body);
  }

  @Post('/:id/reject')
  reject(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._blogPostService.reject(org.id, id);
  }

  @Put('/:id/reject-reason')
  rejectReason(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: RejectReasonDto
  ) {
    return this._blogPostService.setRejectReason(org.id, id, body.reason);
  }

  @Post('/:id/restore')
  restore(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._blogPostService.restore(org.id, id);
  }

  @Post('/:id/rewrite')
  rewrite(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: RewriteCaptionDto
  ) {
    return this._blogPostService.rewrite(org.id, id, body.note);
  }
}
