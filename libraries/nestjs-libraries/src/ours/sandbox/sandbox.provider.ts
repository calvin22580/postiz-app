// OURS: a channel that accepts posts exactly like a real one and records them
// instead of publishing anywhere. See ours/README.md.
import { Logger } from '@nestjs/common';
import { makeSecureId } from '@gitroom/nestjs-libraries/services/make.secure.id';
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import {
  AnalyticsData,
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { Integration } from '@prisma/client';
import { createHash } from 'crypto';
import dayjs from 'dayjs';
import {
  SANDBOX_IDENTIFIER,
  sandboxDisplayName,
  simulatedAnalytics,
} from '@gitroom/nestjs-libraries/ours/sandbox/sandbox.config';

export class SandboxProvider extends SocialAbstract implements SocialProvider {
  private readonly logger = new Logger('SandboxProvider');

  override maxConcurrentJob = 100;
  identifier = SANDBOX_IDENTIFIER;
  name = 'Sandbox (test only, never publishes)';
  toolTip =
    'A pretend channel for testing. Posts are recorded here and never sent to any real platform.';
  isBetweenSteps = false;
  scopes = [] as string[];
  editor = 'normal' as const;

  maxLength() {
    return 5000;
  }

  async customFields() {
    return [
      {
        key: 'name',
        label: 'Sandbox channel name',
        defaultValue: 'Test channel',
        validation: `/^.{1,60}$/`,
        type: 'text' as const,
        hint: 'Only used for testing. Nothing is ever published.',
      },
    ];
  }

  async refreshToken(): Promise<AuthTokenDetails> {
    return {
      refreshToken: '',
      expiresIn: 0,
      accessToken: '',
      id: '',
      name: '',
      picture: '',
      username: '',
    };
  }

  async generateAuthUrl() {
    const state = makeSecureId(6);
    return { url: state, codeVerifier: makeSecureId(10), state };
  }

  async authenticate(params: {
    code: string;
    codeVerifier: string;
    refresh?: string;
  }): Promise<AuthTokenDetails | string> {
    let body: { name?: string } = {};
    try {
      body = JSON.parse(Buffer.from(params.code, 'base64').toString());
    } catch {
      return 'Invalid sandbox details';
    }

    const name = sandboxDisplayName(body.name || '');
    // Stable per name, so connecting the same sandbox twice updates it
    // instead of creating a duplicate.
    const id =
      'sandbox-' +
      createHash('sha256').update(name.toLowerCase()).digest('hex').slice(0, 16);

    return {
      id,
      name,
      username: 'sandbox',
      picture: '',
      accessToken: 'sandbox',
      refreshToken: 'sandbox',
      expiresIn: dayjs().add(100, 'years').unix() - dayjs().unix(),
    };
  }

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration
  ): Promise<PostResponse[]> {
    const frontend = (process.env.FRONTEND_URL || '').replace(/\/$/, '');

    return postDetails.map((post) => {
      const postId = `sandbox-${makeSecureId(12)}`;
      // Recorded, not published: the post row is marked as sent by the
      // normal workflow, with a release URL that opens our own sandbox page.
      this.logger.log(
        `[SANDBOX - NOT PUBLISHED] org=${integration.organizationId} channel=${integration.id} post=${post.id} chars=${post.message?.length || 0} media=${post.media?.length || 0}`
      );
      return {
        id: post.id,
        postId,
        status: 'completed',
        releaseURL: `${frontend}/sandbox/${post.id}`,
      };
    });
  }

  // Milestone 8: made-up results for a Sandbox post, so the "what worked"
  // screen can be tried before any real platform is connected. Every label
  // starts with "Simulated", which is how our results code (and anyone
  // reading upstream's statistics window) can tell them from real ones.
  async postAnalytics(
    integrationId: string,
    accessToken: string,
    postId: string
  ): Promise<AnalyticsData[]> {
    return simulatedAnalytics(postId, dayjs().format('YYYY-MM-DD'));
  }
}
