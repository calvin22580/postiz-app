// OURS: caption endpoints, under /ours/captions.
// The organisation always comes from the signed-in session.
import { Body, Controller, Get, Param, Post, Put, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { CaptionService } from '@gitroom/nestjs-libraries/ours/captions/caption.service';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import {
  AuthorizationActions,
  Sections,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import {
  ApproveCaptionDto,
  EditCaptionDto,
  RewriteCaptionDto,
} from '@gitroom/nestjs-libraries/ours/captions/dtos/caption.dto';
import { GraphicLayoutDto } from '@gitroom/nestjs-libraries/ours/graphics/dtos/brand.kit.dto';

@ApiTags('Captions')
@Controller('/ours/captions')
export class CaptionsController {
  constructor(private _captionService: CaptionService) {}

  @Get('/')
  getWeek(@GetOrgFromRequest() org: Organization) {
    return this._captionService.getWeek(org.id);
  }

  @Post('/write')
  write(@GetOrgFromRequest() org: Organization) {
    return this._captionService.startWriting(org.id);
  }

  @Get('/channels')
  getChannels(@GetOrgFromRequest() org: Organization) {
    return this._captionService.getChannels(org.id);
  }

  // approving creates a post, so it counts towards the plan's monthly posts
  @Post('/:id/approve')
  @CheckPolicies([AuthorizationActions.Create, Sections.POSTS_PER_MONTH])
  approve(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: ApproveCaptionDto
  ) {
    return this._captionService.approve(org.id, id, body.integrationId);
  }

  // a preview of the caption's graphic, drawn from the current profile and
  // brand kit
  @Get('/:id/graphic')
  async getGraphic(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Res() res: Response
  ) {
    const png = await this._captionService.getGraphic(org.id, id);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(png);
  }

  @Put('/:id/graphic')
  setGraphicLayout(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: GraphicLayoutDto
  ) {
    return this._captionService.setGraphicLayout(org.id, id, body.layout);
  }

  // Milestone 5: review. Edit, reject, bring back and rewrite only apply to
  // a caption that is still waiting for approval (or rejected, to restore).
  @Put('/:id/text')
  editText(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: EditCaptionDto
  ) {
    return this._captionService.editText(org.id, id, body.text);
  }

  @Post('/:id/reject')
  reject(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._captionService.reject(org.id, id);
  }

  @Post('/:id/restore')
  restore(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._captionService.restore(org.id, id);
  }

  @Post('/:id/rewrite')
  rewrite(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: RewriteCaptionDto
  ) {
    return this._captionService.rewrite(org.id, id, body.note);
  }
}
