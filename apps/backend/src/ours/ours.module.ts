// OURS: our fork's API routes. Registered with one line in app.module.ts.
// Same auth as upstream's signed-in routes (AuthMiddleware sets the org).
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthMiddleware } from '@gitroom/backend/services/auth/auth.middleware';
import { BusinessProfileController } from '@gitroom/backend/ours/business.profile.controller';
import { BusinessProfileService } from '@gitroom/nestjs-libraries/ours/profile/business.profile.service';
import { BusinessProfileRepository } from '@gitroom/nestjs-libraries/ours/profile/business.profile.repository';
import { AiUsageService } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import { AiUsageRepository } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.repository';
import { WebsiteCrawler } from '@gitroom/nestjs-libraries/ours/crawler/website.crawler';

const authenticatedController = [BusinessProfileController];

@Module({
  imports: [],
  controllers: authenticatedController,
  providers: [
    BusinessProfileService,
    BusinessProfileRepository,
    AiUsageService,
    AiUsageRepository,
    WebsiteCrawler,
  ],
})
export class OursModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(...authenticatedController);
  }
}
