# ours/

Everything in this fork that is ours rather than upstream Postiz. Read
`FORK_RULES.md` first. Every upstream file we had to touch is listed in
`UPSTREAM_PATCHES.md`.

## Where our code lives

| Area | Path |
|------|------|
| Fork tooling, dev stack, tests config | `ours/` |
| Backend and orchestrator code | `libraries/nestjs-libraries/src/ours/` |
| Frontend code | `apps/frontend/src/ours/` |
| Frontend routes | `apps/frontend/src/app/(app)/(site)/sandbox/` (new files only) |
| Browser tests | `ours/e2e/` (standalone package, outside the pnpm workspace) |

## Brand

The brand is a placeholder ("Tidepost") and is driven by environment variables:

| Variable | Used by | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_BRAND_NAME` | frontend (build time), backend emails | `Tidepost` |
| `NEXT_PUBLIC_BRAND_COLOUR` | frontend colour tokens, logo tile | `#1F5F5B` |
| `NEXT_PUBLIC_BRAND_LOGO_URL` | optional image logo; text wordmark if empty | empty |
| `NEXT_PUBLIC_SOURCE_CODE_URL` | "Source code" link | our GitHub fork |
| `EMAIL_FROM_NAME` | upstream's email sender name | set to the brand name |

Defaults live in `apps/frontend/src/ours/brand/brand.defaults.json`.

How it works, without editing upstream screens one by one:

- **Name.** `apps/frontend/src/ours/brand/rebrand.cjs` is a build-time loader
  (wired in by `ours/next/with-ours.mjs`) that replaces the capitalised product
  name in the frontend and locale files as they compile. Lower-case `postiz`
  (domains, packages, CLI commands) is never touched, and third-party
  testimonials are excluded so we never put words in real people's mouths.
  Backend emails get the same treatment in `EmailService.sendEmailSync`.
- **Logo.** Upstream's logo components are swapped for ours by module alias
  (`resolveAlias` in `with-ours.mjs`).
- **Colour.** `brand.style.tsx` overrides upstream's CSS colour variables.
- **Static assets.** `favicon.ico`, `favicon.png` and `postiz.svg` in
  `apps/frontend/public` are replaced with the placeholder mark (asset swaps,
  listed in `UPSTREAM_PATCHES.md`). Regenerate them if the brand changes.

Changing `NEXT_PUBLIC_BRAND_*` needs a frontend restart (it is applied at build
time).

## Sandbox channel

A pretend channel for testing and demos without platform approvals.

- Enable with `SANDBOX_CHANNEL_ENABLED=true` (backend and orchestrator). Off by default.
- Connect it from "Add channel" → "Sandbox (test only, never publishes)". It
  asks only for a name, stored as `Sandbox · <name>`.
- Posts go through the normal scheduler. When the workflow fires, the provider
  records the post (log line `[SANDBOX - NOT PUBLISHED]`) and returns a release
  link to `/sandbox/<postId>`, our own page that says plainly nothing was
  published. No network call is made.
