// OURS: caption endpoints, under /ours/captions.
// The organisation always comes from the signed-in session.
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { CaptionService } from '@gitroom/nestjs-libraries/ours/captions/caption.service';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import {
  AuthorizationActions,
  Sections,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import { ApproveCaptionDto } from '@gitroom/nestjs-libraries/ours/captions/dtos/caption.dto';

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
}
