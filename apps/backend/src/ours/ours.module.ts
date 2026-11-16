// OURS: our fork's API routes. Registered with one line in app.module.ts.
// Same auth as upstream's signed-in routes (AuthMiddleware sets the org).
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
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

const authenticatedController = [
  BusinessProfileController,
  CaptionsController,
  BrandKitController,
  SeasonalController,
];

@Module({
  imports: [],
  controllers: authenticatedController,
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
  ],
})
export class OursModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(...authenticatedController);
  }
}
