// OURS: UK dates for posts (Milestone 6), under /ours/seasonal.
// The organisation always comes from the signed-in session.
import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { SeasonalService } from '@gitroom/nestjs-libraries/ours/seasonal/seasonal.service';
import {
  SeasonalSettingsDto,
  SkipMomentDto,
} from '@gitroom/nestjs-libraries/ours/seasonal/dtos/seasonal.dto';

@ApiTags('UK dates')
@Controller('/ours/seasonal')
export class SeasonalController {
  constructor(private _seasonalService: SeasonalService) {}

  @Get('/')
  getOverview(@GetOrgFromRequest() org: Organization) {
    return this._seasonalService.overview(org.id);
  }

  @Put('/settings')
  setSettings(
    @GetOrgFromRequest() org: Organization,
    @Body() body: SeasonalSettingsDto
  ) {
    return this._seasonalService.setSettings(org.id, body);
  }

  // skip (or use again) one date, every year
  @Put('/dates/:key')
  setSkipped(
    @GetOrgFromRequest() org: Organization,
    @Param('key') key: string,
    @Body() body: SkipMomentDto
  ) {
    return this._seasonalService.setSkipped(org.id, key, body.skip);
  }
}
