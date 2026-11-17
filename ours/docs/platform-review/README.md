# Meta and LinkedIn review packs

Everything needed to set up the developer apps and submit the reviews for Facebook, Instagram and LinkedIn, once Calvin has logged in.

- **Checked on:** 16/11/2026, against the official Meta and LinkedIn pages linked in each file, and against upstream Postiz v2.26.0 code (scopes and callback URLs are copied from `libraries/nestjs-libraries/src/integrations/social/`).
- **Live site:** https://app.steadylamp.com (test login `review@steadylamp.com`, password in Calvin's password manager and Mac `.env` as `DEPLOY_TEST_LOGIN_PASSWORD`. Never put it in this repo).
- **Company:** Steady Lamp Ltd, support@steadylamp.com. Anything only Calvin knows is marked **[FILL IN]**.
- `PLATFORM_APPROVALS.md` (repo root) is the background research. This folder is the hands-on pack and wins where they differ.

## Files

| File | What it is |
|---|---|
| [settings.md](settings.md) | Every URL, redirect URI, app setting and secret the apps need |
| [meta.md](meta.md) | Meta: the app, permissions with justification text, reviewer instructions, data handling answers |
| [meta-screencasts.md](meta-screencasts.md) | One screencast script per Meta permission |
| [linkedin.md](linkedin.md) | LinkedIn: products, form answers, use cases, reviewer instructions, screencast script |
| [chrome-meta.md](chrome-meta.md) | Prompt to paste into Claude in Chrome after logging in to Meta |
| [chrome-linkedin.md](chrome-linkedin.md) | Prompt to paste into Claude in Chrome after logging in to LinkedIn |
| `assets/app-icon-1024.png`, `assets/app-icon-300.png` | Placeholder app icon (Meta wants 1024×1024; LinkedIn wants a square logo) |

**Meta status (17/11/2026):** app `Tidepost` (App ID `1614622909955028`) is set up in Development mode, secrets are on the Worker. See the Status section in `meta.md`. Business Verification, Tech Provider, icon and App Review still to do.

## The order

1. **Calvin logs in** to Meta (developers.facebook.com, business.facebook.com) and LinkedIn in Chrome, and pastes the matching Chrome prompt. The prompt creates the apps, fills in settings and redirect URIs, starts Business Verification and the LinkedIn Development tier request, and puts the app IDs and secrets straight into the Cloudflare Worker (never into chat).
2. **We redeploy** (GitHub workflow "Deploy to Cloudflare (ours)"), so the live site can connect real channels. In Development mode only people with a role on the app can connect, which is what we need to record the screencasts.
3. **Record the screencasts** on the live site with Calvin's own Facebook Page, Instagram professional account and LinkedIn Page, following the scripts. This also makes the "at least one successful API call" Meta needs before each permission can be submitted.
4. **Submit:** Meta App Review (after Business Verification and Tech Provider access verification), then the LinkedIn Standard tier (after the Development tier is granted).

## What the live app was missing, and what this PR fixed

| Gap | Status |
|---|---|
| No public page describing the product. `/` shows "Registration is disabled" with no privacy or terms links. Meta and LinkedIn both ask for a website, and reviewers look for the privacy policy | **Fixed:** new public page `/about.html` (what the service does, what each platform is used for, links to log-in and legal pages). Use it as the app's website URL |
| Log-in page had no privacy, terms or data deletion links | **Fixed:** links added under the panel on the log-in and sign-up pages |
| No app icon at the sizes the dashboards ask for | **Fixed:** placeholder icons in `assets/` (swap when the brand is chosen) |
| Data deletion: Meta wants an instructions URL or a callback | Already there: `/data-deletion.html` (instructions URL). Real erasure exists since PR #12. A signed callback is not needed |

## Still open (not fixed here)

1. **Legal pages say "Draft … not yet in force".** A reviewer can reject a privacy policy that says it is not in force. Company number and registered address are filled in (17/11/2026). Publication date and processor details filled in too. Still needs the ICO registration number and a legal review, then `NEXT_PUBLIC_LEGAL_REVIEWED=true`. **Do this before submitting any review.** Setting up the apps can go ahead now.
2. **steadylamp.com does not mention the product.** It only shows Life in the UK Questions. LinkedIn verifies the organisation's website and Meta checks the business. Add a short "Tidepost" entry (one line and a link to `https://app.steadylamp.com/about.html`) to the steadylamp.com site. This is Calvin's own site, outside this repo.
3. **One Meta app, no Instagram (Standalone).** Meta no longer offers Instagram Login to new apps (found 17/11/2026), so only the Instagram channel that goes through a linked Facebook Page works. Customers need their Instagram professional account linked to a Facebook Page. The standalone channel is hidden on the live site. A second app, "Tidepost Business", was created before this was found and is left unused on Calvin's instruction (see `meta.md`).
4. **LinkedIn product clash (risk, unconfirmed).** A developer reports that **Community Management API** and **Sign In with LinkedIn using OpenID Connect** cannot both be on one app. Our code asks for `openid` and `profile` (from OpenID Connect) and the organisation scopes (from Community Management) on one app, and refuses to connect if any is missing. The Chrome prompt checks this and reports back. If it is true, a small change in our own files is needed (a LinkedIn provider that gets the name and picture from `r_basicprofile` instead of `openid`/`profile`). See `linkedin.md`.
5. **Facebook Login for Business prefers a configuration ID.** Our code sends the classic `scope` list. Meta says for user tokens "scope can still be included, we recommend that you do not use it". So it should work. If the login dialog refuses it during setup, the fix is a configuration ID, which needs a code change.
6. **Test accounts Calvin needs:** a Facebook Page he admins, an Instagram professional account (Business or Creator) linked to that Page, and the LinkedIn Company Page for Steady Lamp Ltd (also needed to verify the LinkedIn app). **[FILL IN: which Page and accounts to use]**
7. **LinkedIn data storage limits** (pre-launch item 11) still need checking before the LinkedIn Standard tier submission.
8. **LinkedIn comments are not shown in the app.** LinkedIn's Page Management test cases 3–4 (show a member's comment and commenter fields) don't apply. LinkedIn says to "just note that in your recording". The script does this.
9. **Personal LinkedIn channel.** Upstream also lists a personal-profile LinkedIn channel. We are not asking for the Executive Management use case, so the script does not show it. Consider hiding it from customers in a later PR.
