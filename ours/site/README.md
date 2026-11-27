# kanosena.com homepage

The public marketing page at `https://kanosena.com` (and `www.kanosena.com`).
The app itself stays at `https://app.kanosena.com` (`ours/deploy/cloudflare`).

- **What it is:** plain static files in `public/`, served by a Cloudflare
  Worker with static assets (`wrangler.jsonc`, Worker `kanosena-site`). No
  build step, no Worker code, no cookies, no analytics, no third-party
  requests.
- **Design:** the page follows the Story Mode design language in
  `ours/design-language` (colours, type, stickers and the rules on what may
  touch a customer's post). The colour tokens are copied into the page's
  `:root` block as `--k-*`, matching `ours/design-language/tokens.css`.
- **Fonts** are self-hosted Latin subsets in `public/fonts`, all under the SIL
  Open Font Licence (licence text beside each file): Dela Gothic One for
  headings, Instrument Sans for everything else, and Caveat for the short
  handwritten notes.
- **Prices and allowances** on the page are copied from
  `libraries/nestjs-libraries/src/ours/plans/plans.config.ts`. When those
  change, change the pricing section of `public/index.html` too. The page says
  the service is free while we test, matching the terms ("8. Fees"). Change
  that line when paid plans start.
- **Links:** sign-up goes to `https://app.kanosena.com/auth`, log in to
  `/auth/login`, and the footer links the app's public pages (about, privacy,
  terms, data deletion), the support address and the source code.

## Guide pages ("Social media for your trade")

`public/social-media-for/` holds a hub page and one guide per trade
(restaurants and cafés, salons, tradespeople, estate agents, accountants,
dental practices). They are generated, then committed, so deploying still needs
no build step:

- Words live in `pages/trades.mjs`. Edit there, then run
  `node ours/site/build-pages.mjs` from the repo root and commit the output.
- The build also writes `public/sitemap.xml`. `public/robots.txt` points at it.
- Shared styles for these pages are in `public/site.css` (same tokens as the
  homepage, which keeps its own inline copy).
- Rules for the content: example posts are always for made-up businesses and
  say so; nothing is claimed about Kanosena customers or results; every rule
  that comes from a law or a regulator links to its source (unlinked rules are
  general good practice); the "checked on" date (`CHECKED` in trades.mjs) is
  updated when the facts are re-checked, and `LASTMOD` in build-pages.mjs when
  a page changes.
- Trades were picked from UK keyword data (OpenSEO / DataForSEO, 27/11/2026).
  Town pages were left out on purpose: the town searches are for agencies, and
  a page per town with no local content would count as a doorway page.

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
