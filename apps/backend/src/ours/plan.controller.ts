// OURS: plan and usage (Milestone 7), under /ours/plan.
// The organisation always comes from the signed-in session.
import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { PlanService } from '@gitroom/nestjs-libraries/ours/plans/plan.service';
import { ChangePlanDto } from '@gitroom/nestjs-libraries/ours/plans/dtos/plan.dto';

// Same rule as upstream's billing: admins manage the plan. The signed-in
// user's role in this organisation is users[0] (see users.controller.ts).
const canManagePlan = (org: Organization) =>
  // @ts-ignore
  ['ADMIN', 'SUPERADMIN'].includes(org?.users?.[0]?.role);

@ApiTags('Plan')
@Controller('/ours/plan')
export class PlanController {
  constructor(private _planService: PlanService) {}

  @Get('/')
  getOverview(@GetOrgFromRequest() org: Organization) {
    return this._planService.overview(org.id, canManagePlan(org));
  }

  // Stripe's billing page: card details, invoices and cancelling
  @Get('/billing')
  manageBilling(@GetOrgFromRequest() org: Organization) {
    return this._planService.manageBilling(org.id, canManagePlan(org));
  }

  @Put('/')
  changePlan(@GetOrgFromRequest() org: Organization, @Body() body: ChangePlanDto) {
    return this._planService.changePlan(org.id, body.plan, canManagePlan(org));
  }
}
