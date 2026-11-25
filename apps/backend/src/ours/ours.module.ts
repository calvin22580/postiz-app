// OURS: our fork's API routes. Registered with one line in app.module.ts.
// Same auth as upstream's signed-in routes (AuthMiddleware sets the org).
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthMiddleware } from '@gitroom/backend/services/auth/auth.middleware';
import { BusinessProfileController } from '@gitroom/backend/ours/business.profile.controller';
import { BusinessProfileService } from '@gitroom/nestjs-libraries/ours/profile/business.profile.service';
import { BusinessProfileRepository } from '@gitroom/nestjs-libraries/ours/profile/business.profile.repository';
import { AiUsageService } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import { AiUsageRepository } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.repository';
import { CaptionsController } from '@gitroom/backend/ours/captions.controller';
import { CaptionService } from '@gitroom/nestjs-libraries/ours/captions/caption.service';
import { CaptionRepository } from '@gitroom/nestjs-libraries/ours/captions/caption.repository';
import { WebsiteCrawler } from '@gitroom/nestjs-libraries/ours/crawler/website.crawler';
import { BrandKitController } from '@gitroom/backend/ours/brand.kit.controller';
import { GraphicService } from '@gitroom/nestjs-libraries/ours/graphics/graphic.service';
import { BrandKitRepository } from '@gitroom/nestjs-libraries/ours/graphics/brand.kit.repository';
import { SeasonalController } from '@gitroom/backend/ours/seasonal.controller';
import { SeasonalService } from '@gitroom/nestjs-libraries/ours/seasonal/seasonal.service';
import { SeasonalRepository } from '@gitroom/nestjs-libraries/ours/seasonal/seasonal.repository';
import { PlanController } from '@gitroom/backend/ours/plan.controller';
import { StripeWebhookController } from '@gitroom/backend/ours/stripe.webhook.controller';
import { PlanService } from '@gitroom/nestjs-libraries/ours/plans/plan.service';
import { PlanRepository } from '@gitroom/nestjs-libraries/ours/plans/plan.repository';
import { ChannelLimitGuard } from '@gitroom/backend/ours/channel.limit.guard';
import { PerformanceController } from '@gitroom/backend/ours/performance.controller';
import { PerformanceService } from '@gitroom/nestjs-libraries/ours/performance/performance.service';
import { PerformanceRepository } from '@gitroom/nestjs-libraries/ours/performance/performance.repository';
import { DirectPostingGuard } from '@gitroom/backend/ours/direct.posting.guard';
import { ErasureService } from '@gitroom/nestjs-libraries/ours/erasure/erasure.service';
import { ErasureRepository } from '@gitroom/nestjs-libraries/ours/erasure/erasure.repository';
import { BrandSignalService } from '@gitroom/nestjs-libraries/ours/memory/brand.signal.service';
import { BrandSignalRepository } from '@gitroom/nestjs-libraries/ours/memory/brand.signal.repository';
import { ErasureInterceptor } from '@gitroom/backend/ours/erasure.interceptor';
import { EmailController } from '@gitroom/backend/ours/email.controller';
import { EmailPublicController } from '@gitroom/backend/ours/email.public.controller';
import { EmailService } from '@gitroom/nestjs-libraries/ours/email/email.service';
import { EmailRepository } from '@gitroom/nestjs-libraries/ours/email/email.repository';

const authenticatedController = [
  BusinessProfileController,
  CaptionsController,
  BrandKitController,
  SeasonalController,
  PlanController,
  PerformanceController,
  EmailController,
];

// No sign-in: callers prove who they are another way (Stripe signs its
// webhooks; the email list's public pages carry a form id or a signed token)
const publicController = [StripeWebhookController, EmailPublicController];

@Module({
  imports: [],
  controllers: [...authenticatedController, ...publicController],
  providers: [
    BusinessProfileService,
    BusinessProfileRepository,
    AiUsageService,
    AiUsageRepository,
    WebsiteCrawler,
    CaptionService,
    CaptionRepository,
    GraphicService,
    BrandKitRepository,
    SeasonalService,
    SeasonalRepository,
    PlanService,
    PlanRepository,
    PerformanceService,
    PerformanceRepository,
    ErasureService,
    ErasureRepository,
    BrandSignalService,
    BrandSignalRepository,
    EmailService,
    EmailRepository,
    // Milestone 7: our plan's channel limit on upstream's "add a channel"
    // routes (global, so upstream's modules need no change)
    {
      provide: APP_GUARD,
      useClass: ChannelLimitGuard,
    },
    // Milestone 8: posts reach a platform only through the owner's approval
    // (public API routes that schedule an existing post)
    {
      provide: APP_GUARD,
      useClass: DirectPostingGuard,
    },
    // Pre-launch: erase the data upstream only marks as deleted, straight
    // after an account is deleted or a channel disconnected
    {
      provide: APP_INTERCEPTOR,
      useClass: ErasureInterceptor,
    },
  ],
})
export class OursModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(...authenticatedController);
  }
}
