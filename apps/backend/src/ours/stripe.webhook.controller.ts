// OURS: Stripe tells us here when a subscription starts, changes or ends
// (payments milestone). Not behind sign-in: every event is checked against
// OURS_STRIPE_WEBHOOK_SECRET before anything happens. Upstream's own Stripe
// webhook (/stripe) is separate and stays unused.
import { Controller, Headers, HttpCode, Post, RawBodyRequest, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PlanService } from '@gitroom/nestjs-libraries/ours/plans/plan.service';

@ApiTags('Stripe')
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
    const { ok, retry } = await this._planService.paymentWebhook('stripe', req.rawBody, signature);
    // anything but 2xx makes Stripe send the event again later
    res.status(ok ? 200 : retry ? 500 : 400);
    return { received: ok };
  }
}
