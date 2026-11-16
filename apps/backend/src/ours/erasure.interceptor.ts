// OURS: runs our erasure straight after upstream's own "delete" routes
// succeed, so no upstream file changes. Registered as a global interceptor in
// ours.module.ts. Upstream answers first; the erasure runs in the background
// and never fails the request (see ErasureService).
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Organization } from '@prisma/client';
import { Observable, tap } from 'rxjs';
import { ErasureService } from '@gitroom/nestjs-libraries/ours/erasure/erasure.service';

// Deleting the signed-in account (Settings > Delete account).
const DELETE_ACCOUNT = { method: 'POST', path: /\/user\/delete-account\/?$/ };
// Disconnecting a channel: the app, the public API, and upstream's
// enterprise route (which has no signed-in organisation).
const DELETE_CHANNEL = [
  { method: 'DELETE', path: /\/integrations\/?$/ },
  { method: 'DELETE', path: /\/public\/v1\/integrations\/[^/]+\/?$/ },
  { method: 'POST', path: /\/enterprise\/delete-channel\/?$/ },
];

const matches = (request: Request, route: { method: string; path: RegExp }) =>
  request.method === route.method && route.path.test(request.path);

@Injectable()
export class ErasureInterceptor implements NestInterceptor {
  constructor(private _erasureService: ErasureService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const request: Request & { org?: Organization } = context
      .switchToHttp()
      .getRequest();
    const deletesAccount = matches(request, DELETE_ACCOUNT);
    const deletesChannel = DELETE_CHANNEL.some((route) => matches(request, route));
    if (!deletesAccount && !deletesChannel) {
      return next.handle();
    }
    // the organisation is read now: deleting an account signs the user out
    const orgId = deletesAccount ? undefined : request.org?.id;
    return next.handle().pipe(
      tap(() => {
        this._erasureService.sweep(orgId);
      })
    );
  }
}
