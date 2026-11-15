# ours/

Everything in this fork that is ours rather than upstream Postiz. Read
`FORK_RULES.md` first. Every upstream file we had to touch is listed in
`UPSTREAM_PATCHES.md`.

## Where our code lives

| Area | Path |
|------|------|
| Fork tooling, dev stack, tests config | `ours/` |
| Backend and orchestrator code | `libraries/nestjs-libraries/src/ours/` |
| Frontend code | `apps/frontend/src/ours/` (brand, locale, developer-tools, sandbox) |
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

- **Legal links.** Upstream's sign-up page links to upstream's own terms and
  privacy pages. The loader points them at `NEXT_PUBLIC_TERMS_URL` and
  `NEXT_PUBLIC_PRIVACY_URL`, or at our own pages (below).

## Legal pages

Public pages, no sign-in needed: `/privacy.html`, `/terms.html` and
`/data-deletion.html` (the URL to give Meta as "Data deletion instructions").
Top-level paths ending in `.html` are skipped by upstream's proxy, so every
visitor and crawler reaches them without an upstream change.

- Routes: `apps/frontend/src/app/(legal)/` (own root layout, light theme, no app
  scripts or trackers).
- Content: `apps/frontend/src/ours/legal/` (`privacy.policy.tsx`,
  `terms.of.service.tsx`, `data.deletion.tsx`). Sources and open points:
  `apps/frontend/src/ours/legal/SOURCES.md`.
- Company facts: `legal.defaults.json`, each overridable by an environment
  variable (frontend build time). Empty values show as `[FILL IN: ...]`, and a
  "Draft" notice shows until all are set and the pages are marked reviewed.

| Variable | Default |
|----------|---------|
| `NEXT_PUBLIC_LEGAL_COMPANY_NAME` | `Steady Lamp Ltd` |
| `NEXT_PUBLIC_LEGAL_COMPANY_NUMBER` | empty |
| `NEXT_PUBLIC_LEGAL_REGISTERED_ADDRESS` | empty |
| `NEXT_PUBLIC_LEGAL_ICO_NUMBER` | empty |
| `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL` | `support@steadylamp.com` |
| `NEXT_PUBLIC_LEGAL_JURISDICTION` | `England and Wales` |
| `NEXT_PUBLIC_LEGAL_LAST_UPDATED` | empty (DD/MM/YYYY) |
| `NEXT_PUBLIC_LEGAL_REVIEWED` | `false`; set `true` after a solicitor's review |

Provider names and regions in the privacy policy (hosting, email, R2
location, backups) are text in `privacy.policy.tsx`, not settings.

Changing `NEXT_PUBLIC_BRAND_*` needs a frontend restart (it is applied at build
time).

## Dates and time zone

Customers who have not chosen their own settings see UK dates: DD/MM/YYYY, a
24-hour clock, weeks starting on Monday, and the calendar in Europe/London.

| Variable | Default | Empty string means |
|----------|---------|--------------------|
| `NEXT_PUBLIC_DEFAULT_LOCALE` | `en-GB` | the browser decides (upstream behaviour) |
| `NEXT_PUBLIC_DEFAULT_TIMEZONE` | `Europe/London` | the browser's time zone (upstream behaviour) |

Defaults live in `apps/frontend/src/ours/locale/locale.defaults.json`. A
user's own choices under Settings (time zone, AM:PM or 24 hours) still win.

How it works: upstream formats dates with dayjs in its built-in `en` locale,
whose short date is US style. `apps/frontend/src/ours/locale/locale.ts`
redefines `en` with dayjs's `en-gb` data, so the calendar, filters and date
pickers change without editing them. To add another region, add its dayjs
locale to `englishVariants` in that file. The interface text itself is still
upstream's English.

## Developer tools (hidden)

Upstream's developer screens point at upstream's own docs, CLI, MCP server and
connectors, so customers do not see them:

- Settings: the "Agents / Dev" tab (a `?tab=agents` link falls back to Global Settings)
- Settings > Apps: the developer "Apps" sub-tab for creating OAuth apps. The tab
  itself stays and shows only "Approved Apps", so customers can still see and
  revoke apps they have authorised.
- Onboarding: the "Connect Agents" step (onboarding goes Connect Channels, then Watch Tutorial)
- Billing page header: the "Developers" link

Set `NEXT_PUBLIC_SHOW_DEVELOPER_TOOLS=true` to show them again. Nothing is
deleted, and the backend public API, MCP server and OAuth apps are unchanged
(hiding the screens does not switch those off).

## Sandbox channel

A pretend channel for testing and demos without platform approvals.

- Enable with `SANDBOX_CHANNEL_ENABLED=true` (backend and orchestrator). Off by default.
- Connect it from "Add channel" → "Sandbox (test only, never publishes)". It
  asks only for a name, stored as `Sandbox · <name>`.
- Posts go through the normal scheduler. When the workflow fires, the provider
  records the post (log line `[SANDBOX - NOT PUBLISHED]`) and returns a release
  link to `/sandbox/<postId>`, our own page that says plainly nothing was
  published. No network call is made.
