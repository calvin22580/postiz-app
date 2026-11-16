// OURS: our plan's channel limit (Milestone 7). Registered as a global guard
// in ours.module.ts, so no upstream file changes: it runs on every upstream
// route that upstream itself marks as adding a channel
// (@CheckPolicies([Create, CHANNEL])), and on connection links. Upstream's own check in
// PermissionsService only runs when Stripe is configured.
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Organization } from '@prisma/client';
import {
  AbilityPolicy,
  CHECK_POLICIES_KEY,
} from '@gitroom/backend/services/auth/permissions/permissions.ability';
import {
  AuthorizationActions,
  Sections,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import { PlanService } from '@gitroom/nestjs-libraries/ours/plans/plan.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';

// Upstream's own guard skips these too: they finish a connection that was
// already counted when it started (OAuth callback, page picker).
const FINISHING_PATHS = ['/integrations/social-connect', '/integrations/provider'];
// A connection link has no signed-in organisation and no @CheckPolicies;
// upstream checks its plan in the handler, so we check ours here.
const CONNECT_LINK_PATH = /\/integrations\/public\/connect\/([^/?]+)$/;

@Injectable()
export class ChannelLimitGuard implements CanActivate {
  constructor(
    private _reflector: Reflector,
    private _planService: PlanService,
    private _integrationService: IntegrationService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const request: Request & { org?: Organization } = context.switchToHttp().getRequest();
    const link = request.method === 'POST' ? request.path.match(CONNECT_LINK_PATH) : null;
    if (link) {
      return this.checkConnectLink(decodeURIComponent(link[1]));
    }
    if (FINISHING_PATHS.some((p) => request.path.includes(p))) {
      return true;
    }
    const policies =
      this._reflector.get<AbilityPolicy[]>(CHECK_POLICIES_KEY, context.getHandler()) || [];
    const addsChannel = policies.some(
      ([action, section]) =>
        action === AuthorizationActions.Create && section === Sections.CHANNEL
    );
    if (!addsChannel) {
      return true;
    }
    // routes without a signed-in organisation (OAuth callbacks) are checked
    // when the connection starts, which is a signed-in request
    if (!request.org?.id) {
      return true;
    }
    const refresh = typeof request.query?.refresh === 'string' ? request.query.refresh : undefined;
    await this._planService.assertCanAddChannel(request.org.id, refresh);
    return true;
  }

  private async checkConnectLink(token: string) {
    let orgId: string | null | undefined;
    try {
      orgId = await this._integrationService.getConnectLinkOrganization(token);
    } catch {
      // an unknown or expired link: upstream's handler answers that
      return true;
    }
    if (orgId) {
      await this._planService.assertCanAddChannel(orgId);
    }
    return true;
  }
}
