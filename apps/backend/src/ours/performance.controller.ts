// OURS: how approved posts did (Milestone 8), under /ours/performance.
// The organisation always comes from the signed-in session.
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { PerformanceService } from '@gitroom/nestjs-libraries/ours/performance/performance.service';

@ApiTags('Post results')
@Controller('/ours/performance')
export class PerformanceController {
  constructor(private _performanceService: PerformanceService) {}

  @Get('/')
  getOverview(@GetOrgFromRequest() org: Organization) {
    return this._performanceService.overview(org.id);
  }
}
