// OURS: our extra social providers. Spread into upstream's socialIntegrationList
// by a single marked line in integrations/integration.manager.ts.
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { SocialProvider } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { SandboxProvider } from '@gitroom/nestjs-libraries/ours/sandbox/sandbox.provider';
import { isSandboxEnabled } from '@gitroom/nestjs-libraries/ours/sandbox/sandbox.config';

export const oursSocialProviders = (
  env: NodeJS.ProcessEnv = process.env
): Array<SocialAbstract & SocialProvider> =>
  isSandboxEnabled(env) ? [new SandboxProvider()] : [];
