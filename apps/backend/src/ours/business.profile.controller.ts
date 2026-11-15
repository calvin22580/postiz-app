// OURS: business profile endpoints, under /ours/business-profile.
// The organisation always comes from the signed-in session.
import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { BusinessProfileService } from '@gitroom/nestjs-libraries/ours/profile/business.profile.service';
import {
  BuildBusinessProfileDto,
  UpdateProfileFieldDto,
} from '@gitroom/nestjs-libraries/ours/profile/dtos/business.profile.dto';
import { isProfileFieldKey } from '@gitroom/nestjs-libraries/ours/profile/business.profile.fields';

@ApiTags('Business profile')
@Controller('/ours/business-profile')
export class BusinessProfileController {
  constructor(private _businessProfileService: BusinessProfileService) {}

  @Get('/')
  getProfile(@GetOrgFromRequest() org: Organization) {
    return this._businessProfileService.getProfile(org.id);
  }

  @Post('/build')
  build(
    @GetOrgFromRequest() org: Organization,
    @Body() body: BuildBusinessProfileDto
  ) {
    return this._businessProfileService.startBuild(org.id, body.url);
  }

  @Put('/fields/:key')
  async updateField(
    @GetOrgFromRequest() org: Organization,
    @Param('key') key: string,
    @Body() body: UpdateProfileFieldDto
  ) {
    if (!isProfileFieldKey(key)) {
      throw new HttpException('Unknown field', 400);
    }
    return this._businessProfileService.updateField(org.id, key, body.values);
  }
}
