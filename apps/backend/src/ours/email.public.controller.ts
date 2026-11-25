// OURS: the email list's public pages (email campaigns EM1), under
// /ours/email/public. No sign-in: the people using these are the business's
// own customers. A form's unguessable id or a signed unsubscribe token says
// which business they belong to. Every route is capped per IP.
import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ThrottlerRealIpGuard } from '@gitroom/nestjs-libraries/throttler/throttler.provider';
import { EmailService } from '@gitroom/nestjs-libraries/ours/email/email.service';
import { SignUpDto } from '@gitroom/nestjs-libraries/ours/email/dtos/email.dto';

@ApiTags('Email list (public)')
@Controller('/ours/email/public')
export class EmailPublicController {
  constructor(private _emailService: EmailService) {}

  @UseGuards(ThrottlerRealIpGuard)
  @Throttle({ default: { limit: 120, ttl: 3600000 } })
  @Get('/form/:publicId')
  getForm(@Param('publicId') publicId: string) {
    return this._emailService.formInfo(publicId);
  }

  @UseGuards(ThrottlerRealIpGuard)
  @Throttle({ default: { limit: 20, ttl: 3600000 } })
  @Post('/form/:publicId')
  @HttpCode(200)
  signUp(@Param('publicId') publicId: string, @Body() body: SignUpDto) {
    return this._emailService.signUp(publicId, body);
  }

  @UseGuards(ThrottlerRealIpGuard)
  @Throttle({ default: { limit: 120, ttl: 3600000 } })
  @Get('/unsubscribe')
  getUnsubscribe(@Query('t') token: string) {
    return this._emailService.unsubscribeInfo(token);
  }

  // The page's button, and the one-click unsubscribe that mail apps send
  // (RFC 8058: POST to the List-Unsubscribe address, token in the address).
  // Always 200 so a mail app never retries; never throws.
  @UseGuards(ThrottlerRealIpGuard)
  @Throttle({ default: { limit: 120, ttl: 3600000 } })
  @Post('/unsubscribe')
  @HttpCode(200)
  async unsubscribe(@Query('t') token: string) {
    return { unsubscribed: await this._emailService.unsubscribe(token) };
  }
}
