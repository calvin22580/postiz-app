# UPSTREAM_PATCHES.md

Every change we make to a file that comes from upstream Postiz. Keep this list short.
See FORK_RULES.md for the rules.

Based on upstream release: **v2.26.0** (commit 132859f3, 13/11/2026).

| Date | File | Reason |
|------|------|--------|
| 15/11/2026 | `CLAUDE.md` | Added `@FORK_RULES.md` as the last line (with a dated OURS comment above it) so our rules load in every session. |
| 15/11/2026 | `libraries/nestjs-libraries/src/integrations/integration.manager.ts` | Import plus one spread line adding our providers (`oursSocialProviders()`, the env-gated Sandbox channel) to `socialIntegrationList`. |
| 15/11/2026 | `apps/frontend/src/components/new-launch/providers/show.all.providers.tsx` | Import plus one spread line adding our post-editor providers (`OursProviders`, Sandbox) to `Providers`. |
| 15/11/2026 | `apps/frontend/next.config.js` | Import plus wrapping the config in `withOurs()` (build-time rebrand loader and logo module aliases, see `ours/README.md`). |
| 15/11/2026 | `apps/frontend/src/app/(app)/layout.tsx` | Import plus `<BrandStyle />` in `<head>` (brand colour tokens). |
| 15/11/2026 | `apps/frontend/src/components/new-layout/layout.component.tsx` | Import plus `<OursFooter />` under the main area ("Source code" link). |
| 15/11/2026 | `apps/frontend/src/app/(app)/auth/layout.tsx` | Import plus replacing upstream's "20,000+ entrepreneurs" claim and third-party testimonials with `<OursAuthPanel />`. |
| 15/11/2026 | `libraries/nestjs-libraries/src/services/email.service.ts` | Import plus one line in `sendEmailSync` passing subject and body through `rebrandText()` (our brand name in every email). |
| 15/11/2026 | `apps/frontend/public/favicon.ico`, `favicon.png`, `postiz.svg` | Asset swaps: placeholder brand mark in place of upstream's logo. |
| 15/11/2026 | `libraries/nestjs-libraries/src/dtos/posts/providers-settings/all.providers.settings.ts` | Import plus one spread line in `allProviders()` so post validation accepts `__type: 'sandbox'` (no settings, like telegram). |
| 15/11/2026 | `apps/frontend/src/components/layout/set.timezone.tsx` | Import plus one line in `applyTimezone`: use our default time zone (`Europe/London`, `NEXT_PUBLIC_DEFAULT_TIMEZONE`) when the user has not picked one. The import also applies our date locale (en-GB formats for dayjs "en"). |
| 15/11/2026 | `apps/frontend/src/components/launches/helpers/isuscitizen.utils.tsx` | Import plus `defaultClock()` in the fallback chain: 24-hour clock from our default locale unless the user chose otherwise. |
| 15/11/2026 | `apps/frontend/src/components/settings/metric.component.tsx` | Import plus one line: the "Automatic" time zone option names our default time zone, so the label matches what the calendar shows. |
| 15/11/2026 | `apps/frontend/src/components/layout/settings.component.tsx` | Import, `return customerSettingsTabs(arr)` (hides the Agents / Dev tab) and `showDeveloperTools() &&` in `canManageApps` (Apps shows only Approved Apps), unless `NEXT_PUBLIC_SHOW_DEVELOPER_TOOLS=true`. |
| 15/11/2026 | `apps/frontend/src/components/onboarding/onboarding.modal.tsx` | Import plus four marked lines: skips the "Connect Agents" step (upstream CLI, MCP and API docs) unless `NEXT_PUBLIC_SHOW_DEVELOPER_TOOLS=true`. |
| 15/11/2026 | `apps/frontend/src/components/billing/first.billing.component.tsx` | Import plus wrapping `<DeveloperIconComponent />` in `showDeveloperTools()`. |
| 15/11/2026 | `libraries/nestjs-libraries/src/database/prisma/schema.prisma` | Our models appended in one `OURS` block at the end (`OursBusinessProfile`, `OursAiUsage`, enum `OursProfileStatus`). No upstream model changed. See ARCHITECTURE.md "Our database decisions". |
| 15/11/2026 | `apps/backend/src/app.module.ts` | Import plus `OursModule` in `imports` (our API routes, `/ours/*`). |
| 15/11/2026 | `apps/frontend/src/components/layout/top.menu.tsx` | Import plus one spread line `...oursFirstMenu(t)` in the first menu (Business profile entry, translated with upstream's `t()`). |
| 15/11/2026 | `package.json`, `pnpm-lock.yaml` | Added `@anthropic-ai/sdk` 1.8.0 for our AI calls. Side effect in the lockfile: upstream's `@copilotkit/runtime` has an optional peer on `@anthropic-ai/sdk`, which now resolves to 1.8.0 instead of 0.57.0. Upstream only uses CopilotKit's `OpenAIAdapter` (`copilot.controller.ts`) and no upstream code imports the Anthropic SDK, so nothing upstream loads it. A pnpm override and an npm alias were both tried and do not change how pnpm resolves that peer. On conflicts, regenerate the lockfile with `pnpm install` rather than hand-merging. |

