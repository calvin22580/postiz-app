// OURS: Milestone 8. Registered as a global guard in ours.module.ts, so no
// upstream file changes. Creating and changing posts is checked inside
// PostsService.createPost (see ours/approval/direct.posting.ts); this guard
// covers the one public API route that schedules an existing post without
// going through createPost: turning a draft into a scheduled post.
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { assertDirectPostingAllowed } from '@gitroom/nestjs-libraries/ours/approval/direct.posting';

const PUBLIC_STATUS_PATH = /\/public\/v1\/posts\/[^/]+\/status\/?$/;

@Injectable()
export class DirectPostingGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }
    const request: Request = context.switchToHttp().getRequest();
    if (request.method === 'PUT' && PUBLIC_STATUS_PATH.test(request.path)) {
      assertDirectPostingAllowed('API', request.body?.status);
    }
    return true;
  }
}
