# ARCHITECTURE.md

A map of upstream Postiz **v2.26.0** for planning our milestones. It is a map, not an audit. Paths are from the repo root. `libs/` below is short for `libraries/nestjs-libraries/src/`.

## The shape of the system

| Part | Where | Tech |
|---|---|---|
| Frontend | `apps/frontend` | **Next.js 16** app router (upstream's `CLAUDE.md` says Vite, but `package.json` runs `next dev`), Tailwind 3, SWR via `useFetch` |
| API | `apps/backend` | NestJS 11. Controllers only, and the logic lives in `libs/` |
| Background jobs | `apps/orchestrator` | NestJS + **Temporal** workers (workflows and activities) |
| Shared server code | `libraries/nestjs-libraries` | Prisma repositories and services, providers, AI, email, upload |
| Shared UI and helpers | `libraries/react-shared-libraries`, `libraries/helpers` | Translations (`t()`), fetch helpers |
| Data | Postgres via Prisma 6.5 (one schema file), Redis, Temporal (its own Postgres and Elasticsearch) | |

Backend layering is DTO → Controller → (Manager) → Service → Repository, and upstream expects it everywhere.

## Social providers and OAuth

- **One class per platform** in `libs/integrations/social/*.provider.ts`. Each extends `SocialAbstract` (`libs/integrations/social.abstract.ts`) and implements `SocialProvider` (`social.integrations.interface.ts`): `identifier`, `scopes`, `generateAuthUrl`, `authenticate`, `refreshToken`, `post`, and optional analytics and comments.
- **Registration is a hard-coded array**, `socialIntegrationList`, in `libs/integrations/integration.manager.ts`. Milestone 1a added one spread line there for `oursSocialProviders()`, so our providers (Sandbox) need no further upstream edits. `HIDDEN_PROVIDERS` (env, comma-separated identifiers) hides providers from the add-channel screen **without code edits**, which is how we can show only our chosen platforms.
- **OAuth flow:** the frontend asks `GET /integrations/social/:integration` (`apps/backend/src/api/routes/integrations.controller.ts`) for the auth URL. The platform redirects to the frontend route `apps/frontend/src/app/(app)/integrations/social/[provider]/page.tsx` (`components/launches/continue.integration.tsx`), which posts the code to `POST /integrations/social-connect/:integration` (`no.auth.integrations.controller.ts`). Page-picking providers then finish with `POST /integrations/provider/:id/connect`. Tokens are stored on the `Integration` row, encrypted if `ENCRYPTION_PROVIDER` is set. Some providers (Facebook, Instagram, LinkedIn Page) are `isBetweenSteps`, meaning the user picks a Page after OAuth.
- `SocialAbstract.checkScopes` rejects a connection unless **every** requested scope was granted.
- **Per-provider frontend pieces:** settings and preview components in `apps/frontend/src/components/new-launch/providers/<identifier>/`, and an icon in `apps/frontend/public/icons/platforms/<identifier>.png`.
- **Temporal task queues are per provider:** `libs/temporal/temporal.module.ts` creates a worker queue named after each identifier's first segment, so a new provider gets its own queue automatically.

## Posts: creation, scheduling, publishing

1. The calendar UI (`apps/frontend/src/components/launches/`, the editor in `components/new-launch/`) calls `POST /posts` (`posts.controller.ts`, with `@CheckPolicies(... POSTS_PER_MONTH)`).
2. `PostsService` (`libs/database/prisma/posts/posts.service.ts`) writes `Post` rows (one per channel, grouped by `group`) and calls `startWorkflow`, which starts **`postWorkflowV112`** on the `main` queue with id `post_<postId>`.
3. The workflow (`apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.2.ts`) sleeps until `publishDate`, then calls activities in `apps/orchestrator/src/activities/post.activity.ts` (`postSocial`, `postComment`, `changeState`, `updatePost`) on the provider's queue. These call `provider.post(...)` and set `Post.state` to `PUBLISHED` or `ERROR` with `releaseURL`.
4. `Post.state` is only `QUEUE | PUBLISHED | ERROR | DRAFT`. There is no "awaiting approval" state.
5. **Workflow rule from upstream:** a workflow in `origin/main` is never edited. Changes ship as a new versioned workflow (hence v1.0.1 to v1.1.2), and activity signatures never change.

Other entry points that create posts: the public API, the MCP / AI agent tools (`libs/chat/tools/integration.schedule.post.ts`), autopost (RSS) and the CLI.

## Organisations, users, permissions

- Prisma models: `Organization`, `User`, and `UserOrganization` (join table with `role`: `SUPERADMIN | ADMIN | USER`, and `disabled`). A user can belong to several organisations.
- `apps/backend/src/services/auth/auth.middleware.ts` reads the `auth` cookie or header (JWT) and picks the active org from `showorg`. Controllers get it with `@GetOrgFromRequest()`.
- Permissions use CASL: `permissions.service.ts` and `permissions.guard.ts` with `@CheckPolicies([action, Section])`. Most checks are **plan limits** (channels, posts per month, team members, webhooks), not roles. **If `STRIPE_PUBLISHABLE_KEY` is unset, every check passes** and the org is treated as `PRO`.
- `Customer` groups channels per client inside one org (agency use).
- Every repository query is scoped by `organizationId`. Our code must do the same.

## Existing AI features

- `libs/openai/openai.service.ts`: OpenAI (`gpt-4.1`, `chatgpt-image-latest`, hard-coded). Generates posts, image prompts, slides and voice, and extracts website text. `fal.service.ts` handles image and video models.
- **Agent / MCP:** Mastra (`libs/chat/`), with tools in `libs/chat/tools/` that can list channels, generate media and **schedule posts directly**. The UI lives at `/agents`, and the `CopilotController` is at `/copilot/*`. `libs/agent/` holds an older LangChain graph.
- Video generation: `libs/videos/`. Clipping: RunPod.
- **Usage metering** is only the `Credits` table (`type` such as `ai_images`), via `SubscriptionService.useCredit` / `checkCredits`. There is **no per-call cost logging**, so FORK_RULES' cost-logging rule needs our own table.
- Gated by the plan flag `ai` in `pricing.ts` and by `OPENAI_API_KEY` being set.

## Billing and plan limits

- `libs/database/prisma/subscriptions/pricing.ts`: hard-coded tiers `FREE / STANDARD / PRO / TEAM / ULTIMATE` with USD prices and limits. `Subscription.subscriptionTier` is a Prisma enum with the same names.
- Stripe: `libs/services/stripe.service.ts` and `payment/` (also RevenueCat). Webhooks go to `POST /payment/:provider` and `POST /stripe`. Billing UI: `apps/frontend/src/app/(app)/(site)/billing`.
- Self-hosted without Stripe keys means no limits (see Permissions).

## Public API

- `apps/backend/src/public-api/routes/v1/public.integrations.controller.ts`, mounted at **`/public/v1`**: posts (list, create, delete), media upload, channels, connect, analytics, video, clipping and debug.
- Auth: `public.auth.middleware.ts` accepts the org's `apiKey` in `Authorization`, or an OAuth token from the built-in OAuth app system (`/oauth`). Rate limited by `API_LIMIT` per hour. Gated by the plan flag `public_api`.
- `apps/sdk` is a JS SDK for it. The MCP server reuses the same services.

## Where our code goes (without editing upstream)

Milestone 1a set the convention: our code lives in folders named **`ours/`**. See `ours/README.md` and `UPSTREAM_PATCHES.md`.

| What | Where | Upstream edit needed |
|---|---|---|
| Server logic (services, repositories, providers) | `libraries/nestjs-libraries/src/ours/<feature>/` (e.g. `ours/sandbox/`, `ours/brand/`) | None |
| Extra social providers | Add to `oursSocialProviders()` in `libs/ours/ours.social.providers.ts` | None. 1a already spreads it into `socialIntegrationList` |
| Post-editor provider components | `apps/frontend/src/ours/sandbox/ours.providers.ts` | None. 1a already spreads it into `show.all.providers.tsx` |
| Our API routes | A new NestJS module, e.g. `apps/backend/src/ours/ours.module.ts`, with controllers under an `/ours/*` or feature prefix | **One line** in `apps/backend/src/app.module.ts` `imports` (made in Milestone 2: `OursModule`) |
| Background jobs | Our own workflow and activity files, e.g. `apps/orchestrator/src/ours/` | One export line in `workflows/index.ts`, and activity registration in the orchestrator module (not yet made) |
| Screens | New routes in `apps/frontend/src/app/(app)/(site)/<feature>/` (1a added `sandbox/[id]`), with components in `apps/frontend/src/ours/` | Menu entries are hard-coded in `components/layout/top.menu.tsx`. Make **one edit** that spreads in a menu array from our own file (made in Milestone 2: `oursFirstMenu()` from `apps/frontend/src/ours/menu/ours.menu.tsx`) |
| Database | One delimited `// ==== OURS ====` block at the **end** of `schema.prisma`. Prisma 6.5 multi-file schemas need a preview flag and new `--schema` paths in upstream scripts, so a separate file costs more edits than it saves | Appending is the edit. Decided in Milestone 2, see "Our database decisions" |
| Branding | `apps/frontend/src/ours/brand/` (`brand.defaults.json`, `BrandStyle`, a build-time rebrand loader via `with-ours.mjs`), and `libs/ours/brand/` for emails | Done in 1a, listed in `UPSTREAM_PATCHES.md` |
| Tests | `ours/vitest.config.mts` (unit), `ours/e2e/` (Playwright) | None |

## Things in upstream that will make milestones 2 to 5 harder

1. **Prisma relations need both sides.** If our table has a relation to `Organization` or `Post`, Prisma requires a back-relation field **on the upstream model**, which is an upstream edit. Choose per table: either plain `organizationId String` / `postId String` columns with no `@relation` (no foreign key; enforce scoping in our repositories), or accept a single logged line per upstream model. Decide once, in milestone 2.
2. **`prisma db push` on start, no migrations.** `pnpm run pm2-run` runs `prisma db push` against the single schema. Our tables must live in that schema, or a push may try to drop them. There is no migration history to lean on for risky changes.
3. **No approval state on posts, and several back doors that publish.** The public API, MCP tools, the AI agent and autopost can all schedule posts straight to `QUEUE`. For "never publish without approval", our drafts should live in our own tables and only become upstream `Post`s once the owner approves. For customers, disable or hide the agent and MCP surfaces (and `public_api` by plan), or route them through our approval step.
4. **AI is hard-wired to OpenAI `gpt-4.1` with no cost logging.** Milestones 2 and 3 should use our own AI client wrapper with per-org cost logging, and should not extend `OpenaiService`. `extractWebsiteText` exists, but it has no sources or citations, so it does not fit milestone 2's "source for every claim".
5. **The UI is calendar-centric.** The editor modal (`components/new-launch/`) is large and provider-driven. The milestone 5 review screen should be our own page that calls `PostsService` after approval, not a modification of the editor. The existing preview and comments page (`(app)/(preview)`) may help with sharing a post for feedback.
6. **Billing is hard-coded** (`pricing.ts` tiers, USD, enum tiers). Milestone 7 will need a careful plan. Note that removing Stripe keys silently lifts all limits.
7. **Menu and providers are arrays in upstream files**, so each needs one logged edit (1a has already made the provider ones).
8. **Upstream moves fast** (v1.0.1 to v1.1.2 post workflows already). Avoid depending on internal method signatures where a public service method exists.

## Our database decisions (Milestone 2, 15/11/2026)

These apply to every model we add from now on.

1. **Where our models live: one block at the end of upstream's `schema.prisma`.** Upstream runs `prisma db push` against that single file on start, with no migrations, so a model kept anywhere else could be dropped by a push. The block starts with an `OURS (2026-11-15)` banner and must stay last in the file. Model names start with `Ours`, and tables are mapped to `ours_*` with `@@map`, so our tables are easy to tell apart in the database. When merging upstream, keep our block after whatever upstream adds.
2. **How our tables link to upstream's: plain id columns, no Prisma `@relation`.** A relation would need a back-reference field on the upstream model (`Organization`, `Post` and so on), which is an upstream edit on every model we touch. Instead our tables hold `organizationId String` (and later `postId String` and similar) with an index, and no foreign key. The rules that come with this:
   - every repository query filters by `organizationId` (FORK_RULES: every query is scoped to the organisation);
   - deleting an upstream row does not cascade to ours. Upstream soft-deletes organisations and posts (`deletedAt`), so this rarely matters, but any clean-up we need is our job, in our own code;
   - joins to upstream data are done in our services with a second query, not with Prisma `include`.

Milestone 2 added `OursBusinessProfile` (one per organisation, `organizationId` unique) and `OursAiUsage` (one row per AI generation call, for cost logging).

Milestone 3 added `OursCaptionWeek` (one row per "write next week's posts") and `OursCaptionDraft` (one row per caption, waiting for approval). A draft becomes an upstream `Post` only when the owner approves it; `postId` then links the two (plain column, as above).

## AI calls (Milestone 2)

- Our AI calls use the official Anthropic SDK (`@anthropic-ai/sdk`, added as a root dependency). They do not go through upstream's `OpenaiService`.
- Every call logs its tokens and cost (USD list prices in `libs/ours/ai/ai.pricing.ts`) to `OursAiUsage` through `AiUsageService.logCall(orgId, feature, usage)`. Use it for every future generation call.
- Model: `OURS_AI_MODEL`, default `claude-opus-5-5`. Without `ANTHROPIC_API_KEY`, the business profile uses a deterministic demo extractor and the screen says so.
- Milestone 3 (captions) follows the same pattern: `CaptionWriter` adapter, Claude or a labelled demo writer, cost logged under the feature `captions`, and a check after the AI (`groundCaptions`) that drops any caption with a detail not in the profile.

## Approval before scheduling (Milestone 3)

Captions live in our own tables until the owner approves one. Approval calls upstream's `PostsService.createPost` (type `schedule`) for that single caption, so the normal scheduler and workflows take over from there. Until the review screen (Milestone 5), approval only accepts a Sandbox channel, and nothing else in our code creates posts.

