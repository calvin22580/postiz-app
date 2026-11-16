// OURS: Milestone 8. "You approve. We handle the rest." A post only reaches
// a platform after the owner has approved it in the app: our weekly posts
// screen, or upstream's own calendar where the owner writes and schedules a
// post themselves. Upstream's public API, CLI and MCP/agent tools can still
// save drafts (which never publish on their own), but can't schedule or
// change posts unless OURS_ALLOW_DIRECT_POSTING=true.
import { HttpException } from '@nestjs/common';
import { CreationMethod } from '@prisma/client';

// creation methods that come from outside the signed-in app
const DIRECT_METHODS: CreationMethod[] = ['API', 'CLI', 'MCP'];

export const DIRECT_POSTING_REFUSED =
  'Posting from outside the app is switched off. Posts are scheduled only after the owner approves them in the app. You can still save drafts.';

export const isDirectPostingAllowed = (env: NodeJS.ProcessEnv = process.env) =>
  (env.OURS_ALLOW_DIRECT_POSTING || '').trim().toLowerCase() === 'true';

// Called first thing in upstream's PostsService.createPost (one marked line):
// every way of creating or changing a post goes through there.
export const assertDirectPostingAllowed = (
  creationMethod: CreationMethod | string,
  type: string | undefined,
  env: NodeJS.ProcessEnv = process.env
) => {
  if (
    DIRECT_METHODS.includes(creationMethod as CreationMethod) &&
    type !== 'draft' &&
    !isDirectPostingAllowed(env)
  ) {
    throw new HttpException(DIRECT_POSTING_REFUSED, 403);
  }
};
