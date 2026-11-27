// OURS: the email list's public routes (email campaigns EM1, EM2), under
// /ours/email/public. No sign-in: the people using these are the business's
// own customers. A form's unguessable id or a signed token says which
// business they belong to. Every page route is capped per IP. The events
// route is Amazon's (SNS), checked by signature instead.
import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ThrottlerRealIpGuard } from '@gitroom/nestjs-libraries/throttler/throttler.provider';
import { EmailService } from '@gitroom/nestjs-libraries/ours/email/email.service';
import { SignUpDto } from '@gitroom/nestjs-libraries/ours/email/dtos/email.dto';
import { EmailEventsService } from '@gitroom/nestjs-libraries/ours/email/email.events.service';

const MAX_EVENT_BYTES = 256 * 1024;

@ApiTags('Email list (public)')
@Controller('/ours/email/public')
export class EmailPublicController {
  constructor(
    private _emailService: EmailService,
    private _emailEventsService: EmailEventsService
  ) {}

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

  // The confirmation email's page (double opt-in, EM2). Opening it changes
  // nothing; its button confirms.
  @UseGuards(ThrottlerRealIpGuard)
  @Throttle({ default: { limit: 120, ttl: 3600000 } })
  @Get('/confirm')
  getConfirm(@Query('t') token: string) {
    return this._emailService.confirmInfo(token);
  }

  @UseGuards(ThrottlerRealIpGuard)
  @Throttle({ default: { limit: 60, ttl: 3600000 } })
  @Post('/confirm')
  @HttpCode(200)
  confirm(@Query('t') token: string) {
    return this._emailService.confirm(token);
  }

  // Amazon SNS: bounces, complaints and deliveries from SES (EM2). SNS posts
  // JSON as text/plain, which no body parser reads, so the body is read here
  // (at most 256 KB, SNS's largest message). Never throws: a bad message gets
  // 403, and our own failure 500 so SNS sends it again.
  @Post('/events')
  async events(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    let raw: string | undefined;
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_EVENT_BYTES) {
          res.status(413);
          return { received: false };
        }
        chunks.push(buffer);
      }
      raw = chunks.length ? Buffer.concat(chunks).toString('utf8') : req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : undefined;
    } catch {
      res.status(400);
      return { received: false };
    }
    const result = await this._emailEventsService.receive(raw);
    res.status(result === 'ok' ? 200 : result === 'invalid' ? 403 : 500);
    return { received: result === 'ok' };
  }
}
