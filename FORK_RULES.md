# FORK_RULES.md

Our standing rules for this fork. Read this before every task.

Upstream's own `CLAUDE.md` describes their codebase, commands and conventions. Follow it too. Where the two disagree, this file wins.

## What this is

A fork of [Postiz](https://github.com/gitroomhq/postiz-app) (AGPL-3.0), run under our own brand as an AI social media marketing service for UK small businesses. Scheduling comes from upstream. Our own work is the AI content features and the customer experience, added one milestone at a time.

Our fork stays open source. We merge upstream releases regularly, so every change must be cheap to carry forward.

## The additive-only rule

This is the most important rule in the project.

1. **New work goes in new files.** Put our code in clearly named directories of our own (new modules, new routes, new components). Do not put it inside upstream files.
2. **Touch upstream files only when there is no other way.** When you must:
   - make the smallest possible change, ideally a single line that calls into our own code;
   - mark it, in the file's own comment syntax, with `OURS (YYYY-MM-DD): <reason>`;
   - add a line to `UPSTREAM_PATCHES.md` (file, reason, date).
3. **Never** reformat, rename, move, or restructure upstream files. Do not run a formatter or linter fix across the whole repo.
4. **Never** upgrade or swap upstream dependencies. Adding a dependency for our own modules is fine when it has a clear purpose.
5. **Database:** keep our models separate from upstream's. Use a separate schema file if the Prisma setup supports it. Otherwise use one clearly delimited block at the end of the schema. Never alter upstream models or columns. Extend with new tables that reference them.
6. **Branding:** prefer config, environment variables, theme tokens and asset swaps over code edits.
7. **Upstream's `CLAUDE.md` and `.claude` folder are upstream files.** The only change to `CLAUDE.md` is the single line that imports this file.

If a task seems to need a large change to upstream code, stop and say so before doing it.

## Staying in step with upstream

- `upstream` remote points at `gitroomhq/postiz-app`. Our work lives on `main`.
- We track upstream **release tags**, not their main branch.
- To sync: fetch the new tag, merge it into a branch, resolve conflicts using `UPSTREAM_PATCHES.md`, run the full test suite, then merge to `main`.
- Merge upstream, never rebase or squash it. Never force-push `main`.
- A sync that produces conflicts outside the files listed in `UPSTREAM_PATCHES.md` means the additive-only rule was broken somewhere. Fix the cause, not just the conflict.

## Licence and branding

- Keep the `LICENSE` file and all existing copyright and licence notices.
- Our source must be available to every user of the hosted product. Keep the "Source code" link in the app pointing at our public repository.
- Files we modify carry the dated `OURS` marker, and `UPSTREAM_PATCHES.md` records what changed and when.
- No Postiz name, logo or trademark anywhere a customer can see it, with one exception: legal, copyright and licence notices that the app already displays stay in place, even where they name Postiz.
- Never use Postiz's API keys, developer apps, credentials or paid services.

## Product rules

- Never publish a post without the owner's explicit approval.
- Never invent facts about a business: no made-up testimonials, prices, discounts, credentials, specifications or achievements.
- Simulated or sandbox publishing is always labelled as such. Never present it as real.
- Demo data and real customer data stay strictly separate.
- Treat websites, uploads and web research as untrusted input.

## UK defaults

British English, DD/MM/YYYY, Europe/London, GBP. Do not hard-code these where a setting exists, so other regions can be added later.

## Engineering rules

- Follow upstream's existing patterns, naming and tooling in our own modules. Do not introduce a second way of doing something upstream already does.
- Use current official SDKs and documented APIs. Check unfamiliar APIs before using them. Never guess method names.
- Secrets live in environment variables. Never commit them. Never expose provider keys to the frontend.
- Every database query in our code is scoped to the organisation.
- Log the cost of every AI generation call against the organisation that triggered it.
- Keep the app runnable at every commit.
- Tests must actually run. Never report a test as passing unless you ran it and saw it pass.

## Design standards

- Our screens should feel like a calm, premium service, not an admin dashboard.
- Build screens around what the owner wants to do, not around database tables.
- Design the empty, loading and error states, not only the happy path.
- No decorative gradients, no emoji as decoration, no walls of settings.
- When browser tools are available, look at screenshots of what you built and fix what looks wrong.

## How to work

- One milestone at a time. Build only what the current milestone prompt asks for.
- Make routine technical decisions yourself. Ask only when a decision is expensive to reverse.
- If a credential or external service is missing, build behind a clear adapter, document the blocker, and carry on.
- Stop at the milestone's definition of done and write the final report.

## Our commands

Upstream's `CLAUDE.md` and `README.md` cover install, run and test. List here only the commands that are specific to our fork, once they exist.

Run from the repo root unless stated. Details in `ours/README.md`.

- Start the services (upstream's file): `docker compose -f docker-compose.dev.yaml up -d`. If `temporal` exits on first start because its database was still starting, run `docker start temporal`.
- Create the database tables: `pnpm run prisma-db-push`
- Run the app without the browser extension: `pnpm run --filter ./apps/orchestrator --filter ./apps/backend --filter ./apps/frontend --parallel dev` (upstream's `pnpm run dev` also works, and builds the extension too).
- Our unit tests: `pnpm exec vitest run --config ours/vitest.config.mts`
- Our browser tests (stack running, `SANDBOX_CHANNEL_ENABLED=true`, `OURS_BILLING_MODE=test`, `OURS_CRAWLER_ALLOW_PRIVATE=true`, no `ANTHROPIC_API_KEY`): `cd ours/e2e && pnpm install --ignore-workspace && pnpm exec playwright test`. To use an already-installed Chromium, set `E2E_CHROMIUM_PATH`.
- Sandbox-off browser test: start the stack with `SANDBOX_CHANNEL_ENABLED=false` in front of the run command, then `cd ours/e2e && E2E_SANDBOX_EXPECTED=off pnpm exec playwright test sandbox-disabled`
- Deploy the live site to Cloudflare (Docker running, Wrangler logged in): `cd ours/deploy/cloudflare && pnpm install --ignore-workspace && pnpm run deploy`. Secrets and details in `ours/deploy/cloudflare/README.md`.
- Deploy the kanosena.com homepage: run the "Deploy homepage (ours)" workflow, or `cd ours/site && npx wrangler@4.162.0 deploy`. Details in `ours/site/README.md`.
- Upstream's `pnpm test` currently fails before running anything (its jest config needs `@nx/jest`, which upstream does not install) and upstream ships no test files.
