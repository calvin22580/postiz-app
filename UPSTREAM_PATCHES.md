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
