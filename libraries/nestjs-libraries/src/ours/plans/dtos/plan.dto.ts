// OURS: request body for changing plan (Milestone 7).
import { IsIn, IsString } from 'class-validator';
import { PAID_PLANS } from '@gitroom/nestjs-libraries/ours/plans/plans.config';

export class ChangePlanDto {
  @IsString()
  @IsIn(PAID_PLANS.map((p) => p.key))
  plan: string;
}
