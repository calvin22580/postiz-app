# kanosena.com homepage

The public marketing page at `https://kanosena.com` (and `www.kanosena.com`).
The app itself stays at `https://app.kanosena.com` (`ours/deploy/cloudflare`).

- **What it is:** plain static files in `public/`, served by a Cloudflare
  Worker with static assets (`wrangler.jsonc`, Worker `kanosena-site`). No
  build step, no Worker code, no cookies, no analytics, no third-party
  requests. Fonts are Plus Jakarta Sans (OFL, `public/fonts/OFL.txt`), the same
  files as `libraries/nestjs-libraries/src/ours/graphics/fonts`, converted to
  WOFF2.
- **Prices and allowances** on the page are copied from
  `libraries/nestjs-libraries/src/ours/plans/plans.config.ts`. When those
  change, change the pricing section of `public/index.html` too. The page says
  the service is free while we test, matching the terms ("8. Fees"). Change
  that line when paid plans start.
- **Links:** sign-up goes to `https://app.kanosena.com/auth`, log in to
  `/auth/login`, and the footer links the app's public pages (about, privacy,
  terms, data deletion), the support address and the source code.

## Look at it locally

```sh
cd ours/site/public && python3 -m http.server 8787
```

Then open http://localhost:8787.

## Deploy

Run the **"Deploy homepage (ours)"** workflow on `main` (Actions tab). It uses
the same `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets
as the app deploy and takes under a minute. The token needs Workers Scripts
Edit and Workers Routes Edit on the `kanosena.com` zone (the app deploy
already needs both).

Or from a machine with Wrangler logged in:

```sh
cd ours/site && npx wrangler@4.162.0 deploy
```

The first deploy attaches the `kanosena.com` and `www.kanosena.com` custom
domains, which adds their DNS records. The existing email records (iCloud MX,
SPF, DKIM) are not touched.

Previews: the Worker also answers on its workers.dev address, so a change can
be checked before it is merged.
