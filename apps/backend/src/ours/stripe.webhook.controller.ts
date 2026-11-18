// OURS: Stripe tells us here when a subscription starts, changes or ends
// (payments milestone). Not behind sign-in: every event is checked against
// OURS_STRIPE_WEBHOOK_SECRET before anything happens. Upstream's own Stripe
// webhook (/stripe) is separate and stays unused.
import { Controller, Headers, HttpCode, Post, RawBodyRequest, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PlanService } from '@gitroom/nestjs-libraries/ours/plans/plan.service';

@ApiTags('Plan')
@Controller('/ours/stripe')
export class StripeWebhookController {
  constructor(private _planService: PlanService) {}

  @Post('/webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
    @Res({ passthrough: true }) res: Response
  ) {
    const status = await this._planService.stripeWebhook(req.rawBody, signature);
    res.status(status);
    return { received: status === 200 };
  }
}
