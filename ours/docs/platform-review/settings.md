# Settings for the developer apps

All values below are for the live site `https://app.steadylamp.com` (`FRONTEND_URL` in `ours/deploy/cloudflare/wrangler.jsonc`). If the domain changes, every redirect URI changes with it.

## Public URLs (same for Meta and LinkedIn)

| Field | Value |
|---|---|
| Website / Site URL | `https://app.steadylamp.com/about.html` |
| App domain | `app.steadylamp.com` (Meta "App domains" also accepts `steadylamp.com`) |
| Privacy policy URL | `https://app.steadylamp.com/privacy.html` |
| Terms of service URL | `https://app.steadylamp.com/terms.html` |
| User data deletion: instructions URL | `https://app.steadylamp.com/data-deletion.html` |
| Contact / business email | `support@steadylamp.com` |
| App icon | `assets/app-icon-1024.png` (1024×1024) |
| LinkedIn logo | `assets/app-icon-300.png` |
| App name | `Kanosena`. Must not contain "Linked", "In", "LinkedIn", "Microsoft", "Facebook", "Instagram", "Meta" or "FB" |
| Category (Meta) | Business and pages |
| Company | Steady Lamp Ltd, company number 17533499, registered office 128 City Road, London, EC1V 2NX |

## Redirect URIs

Copied from the code (`{FRONTEND_URL}/integrations/social/{identifier}`).

| App | Where in the dashboard | Add exactly |
|---|---|---|
| Meta app `Kanosena` (Facebook and Instagram via Facebook Login) | Facebook Login for Business → Settings → Valid OAuth Redirect URIs | `https://app.steadylamp.com/integrations/social/facebook` and `https://app.steadylamp.com/integrations/social/instagram`, plus the same two on `https://app.kanosena.com` (all four saved 18/11/2026) |
| LinkedIn app | Auth → OAuth 2.0 settings → Authorized redirect URLs for your app | `https://app.steadylamp.com/integrations/social/linkedin-page` and `https://app.steadylamp.com/integrations/social/linkedin` |

On Meta app 1, also set (Facebook Login for Business → Settings): Client OAuth login **on**, Web OAuth login **on**, Enforce HTTPS **on**, Use Strict Mode for redirect URIs **on**, Login from devices **off**, Login with the JavaScript SDK **off**.

Instagram (Standalone) is not used: Meta no longer offers Instagram Login to new apps (see `meta.md`), so there is no `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET` and no `instagram-standalone` redirect URI.

**Reconnect URLs.** When a customer reconnects a channel, Facebook, Instagram and personal LinkedIn send `…?refresh=<id>` on the end. Meta's strict mode and LinkedIn both match redirect URIs exactly. Test a reconnect after the first connect. If it fails, that is a code issue to fix in our files, not something to register (the id changes per channel).

## Secrets for the live site

Put these on the Cloudflare Worker that serves app.steadylamp.com (Workers & Pages → the app's Worker → Settings → Variables and Secrets → Add → type **Secret**). Never in chat, never in the repo.

| Secret | Comes from |
|---|---|
| `FACEBOOK_APP_ID` | Meta app `Kanosena` → App settings → Basic → App ID |
| `FACEBOOK_APP_SECRET` | Meta app `Kanosena` → App settings → Basic → App secret |
| `LINKEDIN_CLIENT_ID` | LinkedIn app → Auth → Client ID |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn app → Auth → Primary Client Secret |

Then re-run the GitHub workflow **Deploy to Cloudflare (ours)** on `main` so the container picks them up. The code reads these names directly; no code change is needed.
