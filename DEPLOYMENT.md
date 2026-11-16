# DEPLOYMENT.md

What Tidepost (placeholder brand) needs in production. **Nothing is deployed by this document.** It is based on upstream **v2.26.0** (`docker-compose.yaml`, `Dockerfile.dev`, `var/docker/nginx.conf`, `.env.example` and the env vars the code reads).

**Live deployment (16/11/2026):** the review/demo site runs on Cloudflare Containers at `https://app.steadylamp.com`, with PlanetScale Postgres (London), Temporal Cloud (London) and R2. Setup, secrets and deploy steps: `ours/deploy/cloudflare/README.md`. The rest of this document is the general requirements list.

Sizes marked *estimate* are ours, worked out from the compose file and build settings. They are not vendor figures. Check them against real load on a staging box.

## Services

| # | Service | What it does | Options | Minimum size (*estimate*) |
|---|---|---|---|---|
| 1 | **App container** (our image) | One container running nginx on port 5000 plus three Node processes under pm2: **frontend** (Next.js, :4200), **backend** (NestJS API, :3000, served under `/api/`) and **orchestrator** (Temporal workers). On start it runs `prisma db push` | Any Docker host or PaaS (Railway, Render, Fly, a VPS) | 2 vCPU, **4 GB RAM** for a small number of customers. The build alone needs 4 GB (`NODE_OPTIONS=--max-old-space-size=4096`), so build in CI rather than on a tiny box |
| 2 | **PostgreSQL** (app data) | All app data via Prisma | Managed Postgres in a UK or EU region. Upstream uses Postgres 17 | 1 vCPU, 1–2 GB RAM, 10 GB disk, daily backups |
| 3 | **Redis** | Cache, throttling, OAuth state, short-lived keys | Managed Redis (Upstash, Redis Cloud) or a container. Upstream uses 7.x | 256 MB is enough to start |
| 4 | **Temporal** | Runs scheduled posting workflows. **Posts don't publish without it** | **Temporal Cloud** (supported: `TEMPORAL_TLS=true` + `TEMPORAL_API_KEY`), or self-host `temporalio/auto-setup:1.28.1` with its own Postgres 16 and Elasticsearch 7.17 as in `docker-compose.yaml` | Self-hosted: about 2 GB RAM in total for Temporal, its Postgres and Elasticsearch (ES heap is 256 MB in the compose file). Temporal Cloud avoids running three more services |
| 5 | **Object storage** | Uploaded media and channel avatars | `STORAGE_PROVIDER=cloudflare` (Cloudflare R2, the only cloud option in the code) or `local` with a persistent volume | R2 pay-as-you-go. Use `local` only on a single server with backups |
| 6 | **Email** | Account activation, notifications, digests | `EMAIL_PROVIDER` = `resend`, `ses` or `nodemailer` (SMTP) | Our own account and verified sending domain |
| 7 | **TLS / domain** | HTTPS on the final domain | PaaS-managed TLS, or Caddy or Cloudflare in front | Required: OAuth callbacks need https (see `PLATFORM_APPROVALS.md`) |

Not needed for this milestone's scope: Temporal UI and admin tools (keep them internal if used), Spotlight (debug only), pgAdmin and RedisInsight (dev compose only), RunPod, Deepgram, Transloadit, Stripe.

**Single-server option for a pilot (*estimate*):** one VPS with 4 vCPU, 8 GB RAM and 80 GB SSD in a UK or EU region, running services 1–4 from a compose file like upstream's, with R2 for media and managed backups of both Postgres databases.

**Scaling later:** run extra orchestrator workers. `EXCLUDE_QUEUE` pins provider queues to particular workers and `WORKER_CONCURRENCY_DIVIDER` reduces concurrency per worker. Set `RUN_CRON` on exactly one instance, because it registers the infinite or cron workflows (`libs/temporal/infinite.workflow.register.ts`).

## Our own image

Upstream's compose uses `ghcr.io/gitroomhq/postiz-app:latest`. **We must not use it.** It carries Postiz branding, and it is not our source, which breaks AGPL source-matching (see `AGPL_COMPLIANCE.md`). Build our image from our repo at a tagged commit. `Dockerfile.dev` shows the steps: Node 22, pnpm 10.6.1, `pnpm install`, `pnpm run build`, then `nginx && pnpm run pm2`. Publish it to our own registry, for example `ghcr.io/calvin22580/...`, tagged with the git SHA, so the footer "Source code" link can point at the exact commit.

## Environment variables

### Required
| Variable | Value / notes |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Long random string, unique per environment |
| `FRONTEND_URL` | Public app URL, e.g. `https://app.tidepost.example`. **All OAuth callbacks are built from this** |
| `MAIN_URL` | Same as `FRONTEND_URL` in a single-domain setup |
| `NEXT_PUBLIC_BACKEND_URL` | Public API URL. With the bundled nginx: `{FRONTEND_URL}/api` |
| `BACKEND_INTERNAL_URL` | `http://localhost:3000` inside the container |
| `TEMPORAL_ADDRESS` | e.g. `temporal:7233`, or the Temporal Cloud endpoint |
| `IS_GENERAL` | `true` (upstream: "required for now") |
| `STORAGE_PROVIDER` | `cloudflare` (recommended) or `local` |
| `NODE_ENV` | `production` |

### Temporal Cloud (if used)
`TEMPORAL_NAMESPACE`, `TEMPORAL_TLS=true`, `TEMPORAL_API_KEY`.

### Storage
- **R2:** `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ACCESS_KEY`, `CLOUDFLARE_SECRET_ACCESS_KEY`, `CLOUDFLARE_BUCKETNAME`, `CLOUDFLARE_BUCKET_URL`, `CLOUDFLARE_REGION=auto`.
- **Local:** `UPLOAD_DIRECTORY=/uploads`, `NEXT_PUBLIC_UPLOAD_DIRECTORY=/uploads`, and a persistent volume.

### Email
`EMAIL_PROVIDER`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, then one of:
- Resend: `RESEND_API_KEY`
- SES: `SES_REGION`, `SES_ACCESS_KEY`, `SES_SECRET_ACCESS_KEY`
- SMTP: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASS`

Setting `EMAIL_PROVIDER` turns on account activation by email.

### Security (strongly recommended)
| Variable | Notes |
|---|---|
| `ENCRYPTION_PROVIDER=local` + `ENCRYPTION_KEY` | Encrypts channel tokens at rest. Create the key with `openssl rand -base64 32` and **keep it safe**: losing it means every customer reconnects every channel. `aws-kms` is the alternative (`ENCRYPTION_KMS_*`) |
| `DISABLE_REGISTRATION` | `true` until we open sign-ups |
| `API_LIMIT` | Public API requests per hour (default 30 in `.env.example`) |

### Social platforms (first platforms)
| Variable | Platform |
|---|---|
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | Facebook Pages and Instagram (Facebook Business) |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | Instagram (Standalone). **Not in upstream `.env.example`**, but read by `instagram.standalone.provider.ts` |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | LinkedIn and LinkedIn Page |
| `HIDDEN_PROVIDERS` | Comma-separated identifiers to hide from the add-channel screen. Use it to show only the platforms we support, e.g. everything except `facebook,instagram,instagram-standalone,linkedin,linkedin-page` and the Sandbox |

How to get these: `PLATFORM_APPROVALS.md`.

### Ours
- `SANDBOX_CHANNEL_ENABLED`: turns on the Sandbox channel (off by default, `libs/ours/sandbox/sandbox.config.ts`). Keep it off in production unless the environment is deliberately a demo. Sandbox posts are always labelled.
- `NEXT_PUBLIC_DEFAULT_LOCALE` (default `en-GB`) and `NEXT_PUBLIC_DEFAULT_TIMEZONE` (default `Europe/London`): date format and calendar time zone for users who haven't chosen their own. Leave them unset for UK defaults; an empty string switches back to the browser. Frontend build time. See `ours/README.md`.
- `NEXT_PUBLIC_LEGAL_*`: company facts printed on the privacy, terms and data deletion pages (company number, registered address, ICO number, last-updated date, reviewed). Frontend build time. List and defaults in `ours/README.md` ("Legal pages").
- `NEXT_PUBLIC_SHOW_DEVELOPER_TOOLS`: leave unset in production. `true` shows upstream's developer screens (Agents / Dev, OAuth apps, Connect Agents onboarding step), which point at upstream's docs and tools. Hiding them does not turn off the public API.

### Leave unset in production
These are upstream or third-party extras we haven't chosen to use. Leaving them unset disables the feature.

- **Billing:** `STRIPE_*`, `REVENUECAT_*`, `FEE_AMOUNT`. Milestone 7 decides. Note that **without `STRIPE_PUBLISHABLE_KEY` all plan limits are off**.
- **AI:** `OPENAI_API_KEY`, `FAL_KEY`, `EVOLINK_API_KEY`, `ELEVENSLABS_API_KEY`, `TAVILY_API_KEY`. Setting `OPENAI_API_KEY` turns on upstream's AI features, including the agent that can schedule posts directly. Keep it unset until our approval-first AI milestones decide how to handle those features.
- **Analytics and tracking:** `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_FACEBOOK_PIXEL`, `FACEBOOK_PIXEL_ACCESS_TOKEN`, `DATAFAST_*`, `CHATBASE_TOKEN`, `LEADJOURNEY_*`. Add only with our own accounts and a cookie notice (UK GDPR / PECR).
- **Other third-party features:** `NEXT_PUBLIC_POLOTNO` (needs our own commercial licence), `RUNPOD_*`, `DEEPGRAM_API_KEY`, `TRANSLOADIT_*`, `DUB_*` / `SHORT_IO_*` / `KUTT_*` / `LINK_DRIP_*`, `NEYNAR_*`, `HUBSPOT_*`, `MCP_*`, `OPENAI_OAUTH_CLIENT_ID`, `APPLE_*`, `GITHUB_CLIENT_*`, `POSTIZ_GENERIC_OAUTH` and `POSTIZ_OAUTH_*`.
- **Other platforms' credentials** until we support them.
- `NOT_SECURED`: must never be `true` in production.
- `DISABLE_SSRF_PROTECTION`: must never be `true` in production.

### Optional monitoring
`NEXT_PUBLIC_SENTRY_DSN` with our own Sentry project.

## UK and data notes

- Host the database, Redis and storage in a UK or EU region, and record the region in the privacy policy.
- `TZ` can be set on the container. Scheduling uses each user's own timezone setting, so leave `TZ=UTC` on servers and set **Europe/London** as the user default in the app. Milestone 1a records where that is possible.
- Back up both the app Postgres and (if self-hosted) the Temporal Postgres. Losing Temporal's database loses scheduled-but-unsent posts' timers. The posts stay in the app database. Upstream also has a `missing.post.workflow` that searches for missed posts.

## Before the first deploy (checklist)

- [ ] Final domain chosen and `FRONTEND_URL` fixed (OAuth callbacks depend on it)
- [ ] Our image built from a pushed, tagged commit
- [ ] Managed Postgres and Redis provisioned in the UK or EU, with backups on
- [ ] Temporal Cloud namespace or self-hosted Temporal running
- [ ] R2 bucket and keys
- [ ] Email domain verified (SPF, DKIM, DMARC)
- [ ] `ENCRYPTION_KEY` generated and stored in a password manager
- [ ] `DISABLE_REGISTRATION=true` until launch
- [ ] Platform credentials added as each approval lands
- [ ] `SANDBOX_CHANNEL_ENABLED` set deliberately (off unless it's a demo environment)
