# ours/

Everything in this fork that is ours rather than upstream Postiz. Read
`FORK_RULES.md` first. Every upstream file we had to touch is listed in
`UPSTREAM_PATCHES.md`.

## Where our code lives

| Area | Path |
|------|------|
| Fork tooling, dev stack, tests config | `ours/` |
| Backend and orchestrator code | `libraries/nestjs-libraries/src/ours/` |
| Frontend code | `apps/frontend/src/ours/` (brand, locale, developer-tools, sandbox, profile, captions, graphics, seasonal) |
| Frontend routes | `apps/frontend/src/app/(app)/(site)/{sandbox,business-profile,captions}/` (new files only) |
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

Public pages, no sign-in needed: `/about.html` (what the service does and what
each platform is used for; the website URL for the Meta and LinkedIn apps),
`/privacy.html`, `/terms.html` and `/data-deletion.html` (the URL to give Meta
as "Data deletion instructions"). The log-in and sign-up panel links to all four.
Meta and LinkedIn setup and review pack: `ours/docs/platform-review/`.
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
- Settings: the "Webhooks" tab (sends post data to any address; a developer feature)
- Left menu and typed addresses: upstream's "Agent" (`/agents`, needs an OpenAI
  key and can't schedule since M8) goes to the calendar, "Analytics"
  (`/analytics`) to "What worked", "Billing" (`/billing`, upstream's USD Stripe
  screen) to "Plan and usage", and the "Affiliate" link (upstream's own
  programme) is gone. The redirects are in `proxy.ts`, so a bookmark lands on our screen.

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

## Business profile

An owner enters their website and gets a profile they can check and edit.
Screen: `/business-profile` (menu: "Business profile"). Code:
`libraries/nestjs-libraries/src/ours/{crawler,profile,ai}/`,
`apps/backend/src/ours/`, `apps/frontend/src/ours/profile/`.

How it works:

1. **Crawl** (`WebsiteCrawler`): the homepage plus up to 10 same-site pages,
   about/services/contact first. Follows robots.txt, refuses private and local
   addresses (checked on every redirect), 10 s and 2 MB per page.
2. **Clean** (`cleanHtml`): visible text only. Scripts, styles, comments,
   menus, hidden and screen-reader-only text are removed, and lines that read
   like instructions to an AI are replaced with a marker. Email addresses
   hidden by Cloudflare's email obfuscation are decoded.
3. **Extract**: Claude reads the pages, marked as untrusted, and returns claims
   with a source URL and an exact quote for each. Without `ANTHROPIC_API_KEY` a
   rule-based demo extractor runs instead, and the screen says "Demo mode".
4. **Ground** (`groundExtraction`): a claim is kept only if its quote really is
   on a page we read (and, for phone, email, name and social links, the value
   is in the quote). Everything else is dropped, and the field shows "Not found
   on your website".
5. Every AI call's tokens and cost are logged per organisation in `ours_ai_usage`.

Owner edits are saved as "Added by you" and survive "Read my website again".
The build runs in the background in the backend process and the screen polls
it. A build stuck for more than 10 minutes (for example after a restart) is
marked as failed so the owner can try again.

| Variable | Used by | Default |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | backend: AI extraction | empty (demo extractor) |
| `OURS_AI_MODEL` | backend | `claude-opus-5-5` |
| `OURS_CRAWLER_ALLOW_PRIVATE` | backend: lets the crawler read localhost (dev and browser tests only, never in production) | off |


## Weekly posts (captions)

The owner gets a week of posts written from their business profile, and
approves each one. Screen: `/captions` (menu: "Weekly posts"). Code:
`libraries/nestjs-libraries/src/ours/captions/`,
`apps/backend/src/ours/captions.controller.ts`, `apps/frontend/src/ours/captions/`.

How it works:

1. **Plan** (`caption.plan.ts`): the week starting next Monday, one post a
   weekday, each written for Facebook (12:30), Instagram (18:30) and LinkedIn
   (08:30), in the organisation's time zone (`OURS_DEFAULT_TIMEZONE`, default
   `Europe/London`). The facts are the profile's claims (website or owner),
   each with an id. Tone of voice comes from the profile, or "friendly, clear
   and professional" when it was not found.
2. **Write**: Claude gets the facts inside `<untrusted_business_profile>` and
   must cite the fact ids each caption uses. Without `ANTHROPIC_API_KEY` a
   template-based demo writer runs, and the screen says "Demo mode". A thin
   profile gives fewer days rather than padded posts.
3. **Check** (`groundCaptions`): a caption is kept only if it cites real facts
   and every number, price or percentage, email, web address, @handle and
   offer, award or quality word ("free", "best", "award-winning" and so on) is
   in the profile. Anything else is dropped, and the screen says how many.
4. **Approve**: each caption shows "Waiting for your approval". "Approve and
   schedule" creates one upstream post (`PostsService.createPost`, type
   `schedule`) at the planned time. For now only Sandbox channels are
   accepted, so nothing reaches a real platform. Captions that are not
   approved are never scheduled.

Writing runs in the background in the backend process (like the profile
build) and the screen polls it; a week stuck for 10 minutes is marked as
failed. Each AI call's cost is logged under the feature `captions`.

| Variable | Used by | Default |
|----------|---------|---------|
| `OURS_DEFAULT_TIMEZONE` | backend: caption posting times | `Europe/London` |

### Reviewing the week (Milestone 5)

The same screen is the review screen. While a post waits for approval the
owner can:

- **Edit** it in their own words (`PUT /ours/captions/:id/text`, platform
  length limits). Owner wording is their own claim, so it is never removed,
  but details the profile doesn't have (numbers, prices, links and so on, the
  same check as step 3) are shown as "Check before approving".
- **Rewrite** it (`POST /ours/captions/:id/rewrite`, optional note of up to
  300 characters). One caption is written again from the profile as it is
  now, and goes through the same check; if it fails, the current version is
  kept. Each caption can be rewritten 5 times (`MAX_REWRITES`), counted before
  the call is made. Each AI call is logged under the feature
  `caption-rewrite`. In demo mode the writer picks another prepared version
  and ignores the note, and the screen says so.
- **Reject** it (`POST /ours/captions/:id/reject`): it is never scheduled, and
  can be brought back (`/restore`).
- **Approve all**: the screen calls the single approve endpoint once per
  waiting post, so each one gets the same checks and plan limit.

Filters show all, waiting, approved or rejected posts. An approved post no
longer changes here (it is an upstream post by then). Approval is still
Sandbox-only: see ARCHITECTURE.md "Approval before scheduling".

## Post graphics

Every weekly post gets a graphic in the business's own colour and logo.
Screen: the "Your graphics" panel and a preview on each post in `/captions`.
Code: `libraries/nestjs-libraries/src/ours/graphics/`,
`apps/backend/src/ours/brand.kit.controller.ts`, `apps/frontend/src/ours/graphics/`.

How it works:

1. **Brand kit**: the owner picks a brand colour (a neutral grey until then,
   never our product's colour) and can upload a logo (PNG, JPEG or WebP, up to
   3 MB). The logo is re-encoded as a PNG of at most 600 px, so nothing else
   in the file survives, and kept in `ours_brand_kit`.
2. **Layouts** (`graphic.content.ts`): statement, card, contact details, and
   name and logo. One a day is chosen automatically and is the same on every
   platform that day; the owner can pick another or "No graphic" before
   approving.
3. **Words**: only fixed labels ("Our services", "Find us") and business
   profile values, copied as they are. Too long to fit means not used, never
   shortened. A layout without what it needs falls back to one that has it.
4. **Sizes**: Instagram and Facebook 1080 × 1350 (4:5 portrait), LinkedIn
   1200 × 1200.
5. **Drawing** (`graphic.renderer.ts`): `sharp`, with our bundled font files,
   so it needs no fonts on the server and no image service.
6. **Approval**: the graphic is drawn, saved to the organisation's media
   library (upstream storage) and attached to the scheduled post. Previews
   are never stored.

| Variable | Used by | Default |
|----------|---------|---------|
| `OURS_GRAPHICS_FONT_DIR` | backend: where the graphic fonts are, if not found next to the source | found automatically |


## UK dates in posts (Milestone 6)

When a bank holiday or an occasion like Mother's Day is coming up, the weekly
posts may mention it. Screen: the "UK dates in your posts" panel in
`/captions`, and a "UK date: … Source: …" line on each post that uses one.
Code: `libraries/nestjs-libraries/src/ours/seasonal/`,
`apps/backend/src/ours/seasonal.controller.ts`, `apps/frontend/src/ours/seasonal/`.

How it works:

1. **The calendar** (`uk.calendar.ts`) is written by hand, never generated.
   Bank holidays are copied from GOV.UK (`https://www.gov.uk/bank-holidays.json`)
   per nation. Occasions (Black Friday, Small Business Saturday, Christmas,
   Mothering Sunday, Pancake Day, Valentine's, Easter Sunday, Father's Day,
   Halloween, Bonfire Night, and the national days of each nation) each carry
   the page they were checked against. Remembrance, moon-sighted festivals,
   school holidays and unofficial "awareness days" are left out on purpose
   (see the file's header).
2. **The owner's choices** (`ours_seasonal_settings`): their nation (England
   until they choose; bank holidays differ), dates on or off, and dates they
   skip (skipping applies every year).
3. **Writing a week**: `SeasonalService.factsForWeek` picks the dates in that
   week, plus ones coming up within their lead time (Mothering Sunday 14
   days, a bank holiday 4), at most 3, nearest first. They go to the writer as
   facts with the field `seasonal`, listed apart from the untrusted profile.
4. **Checks** (`groundCaptions`): a caption can cite a date but still needs a
   profile fact; a date's day and date only count for a caption that cites
   it; offer words ("deal", "sale") are still dropped. The writer is told
   never to say the business is open, closed or has something on for a date
   unless the profile says so. Days GOV.UK marks without bunting (Good
   Friday, Battle of the Boyne) are listed but never suggested.
5. **Demo mode** adds one "Coming up: …" post for the nearest kept date.

API: `GET /ours/seasonal`, `PUT /ours/seasonal/settings` (`nation`, `enabled`),
`PUT /ours/seasonal/dates/:key` (`skip`).

**Adding a year** (the occasions run to 31/12/2027, bank holidays to the end
of 2028): copy the dates from the same sources into `uk.calendar.ts`, update
`CALENDAR_CHECKED_ON` and `CALENDAR_COVERS_UNTIL`, and run our unit tests;
they cross-check the dates against each other (Easter, Mothering Sunday,
Pancake Day, weekdays). When the list runs out, the panel says how far it has
been checked.

## Plans and usage (Milestone 7)

Screen: `/plan` ("Plan and usage" in the menu). Code:
`libraries/nestjs-libraries/src/ours/plans/`, `apps/backend/src/ours/plan.controller.ts`,
`apps/backend/src/ours/channel.limit.guard.ts`, `apps/frontend/src/ours/plans/`.

- **Plans and limits** are in `plans.config.ts`. Every price and limit there is
  a **placeholder** to tune. Starter £79, Growth £149, Pro £299 a month, plus a
  free trial for new organisations.
- **What's counted each month** (calendar month, `OURS_DEFAULT_TIMEZONE`):
  weeks of posts written, posts scheduled (approvals), AI rewrites, website
  reads for the profile. Connected channels (including disabled ones) are
  counted as they stand. A week, website read or post that fails is given
  back; an AI rewrite counts once it is written, even if it isn't kept. Graphics are drawn locally at no cost and come
  with each scheduled post, so they have no separate limit.
- **Fair use**: AI cost logged in `ours_ai_usage` is capped per plan
  (`aiSpendUsd`). The owner sees a fair-use message, never the amount.
- **Trial**: starts the first time an organisation is seen, `OURS_TRIAL_DAYS`
  long (14). Its allowance covers the whole trial. When it ends, new AI work,
  approvals and new channels stop until a plan is chosen; scheduled posts still go out.

Settings (all optional):

| Variable | Default | Meaning |
|---|---|---|
| `OURS_BILLING_MODE` | `off` | `test`: admins switch plan on `/plan`, no payment, labelled "Test mode". `off`: the screen asks the owner to email us (`NEXT_PUBLIC_LEGAL_CONTACT_EMAIL`). |
| `OURS_TRIAL_DAYS` | `14` | Length of the free trial. |
| `OURS_CURRENCY` | `GBP` | Currency the prices are shown in. |
| `OURS_VAT_REGISTERED` | `false` | `true` shows prices as "+ VAT" with the VAT-inclusive figure. |
| `OURS_VAT_RATE` | `0.2` | VAT rate used when registered. |

Do not set upstream's `STRIPE_PUBLISHABLE_KEY`: it turns on upstream's own
billing screens and USD limits. A payment provider for our plans goes in
`plan.payment.ts` with our own env names.

To move a customer to a plan by hand while `OURS_BILLING_MODE=off`, set
`plan` on their row in `ours_plan_subscription` (Prisma Studio) to `starter`,
`growth` or `pro`.

API: `GET /ours/plan`, `PUT /ours/plan` (`plan`).

## What worked (Milestone 8)

Screen: `/results` ("What worked" in the menu). Code:
`libraries/nestjs-libraries/src/ours/performance/`,
`libraries/nestjs-libraries/src/ours/approval/`,
`apps/backend/src/ours/performance.controller.ts`,
`apps/backend/src/ours/direct.posting.guard.ts`, `apps/frontend/src/ours/results/`.

- Each approved post's results are read through upstream's post analytics when
  the owner opens the screen. Sandbox posts report **simulated** results
  (labelled everywhere, repeatable per post).
- Until 20 posts have results the screen says there isn't enough to go on and
  nothing changes. After that it says which kinds of post, days and graphics
  did clearly better or worse than the rest (at least 5 posts each, 99% range one side).
- Kinds that did clearly better or worse steer which ideas next week's posts
  use. They never add claims: the business profile is still the only source.
- Posts from the public API, CLI and MCP/agent tools can only be drafts, so
  nothing is scheduled without approval in the app.

| Variable | Default | Meaning |
|---|---|---|
| `OURS_ALLOW_DIRECT_POSTING` | `false` | `true` lets the public API, CLI and MCP/agent schedule posts directly again (skipping approval). Leave off for customers. |

API: `GET /ours/performance`.

## Deleting data (pre-launch)

Upstream only marks a deleted account's organisation and a disconnected
channel as deleted. Ours then erases the data, so the data deletion page is true:

- **Account deleted** (Settings > Global Settings > Delete Account): our
  business profile, captions, weeks, brand kit, UK date choices and post
  results are deleted; upstream's post text, comments, signatures, sets,
  webhooks, auto-post feeds, plugs, error logs and notifications are deleted or
  emptied; uploaded files and approved graphics are removed from storage; stored
  third-party keys and app tokens are hashed or cleared; the organisation is
  renamed "Deleted organisation" and its API key cleared; tags, customer
  names, video clippings and OAuth app secrets are emptied too. Upstream already
  hashes the user's details and the channels' tokens.
- **Channel disconnected**: its tokens, profile and picture are hashed or
  cleared. Its name and internal id stay, so connecting the same page again
  revives it cleanly; disconnecting it again erases it again.
- Kept: our AI cost log, plan and usage counters (billing records, no customer
  content), and the emptied upstream rows other rows point at.
- When: straight after upstream's delete route answers (a global interceptor,
  no upstream edit), when the backend starts, and once a day. Each organisation
  and channel is erased once (`ours_erasure`) and a failed one is retried.

| Variable | Default | Meaning |
|---|---|---|
| `OURS_ERASURE_SWEEP` | on | `false` turns off the start-up and daily sweep (the erasure straight after a delete still runs). |

The browser test `prelaunch.spec.ts` checks the database directly, at
`E2E_DATABASE_URL` (default: the local dev database).
