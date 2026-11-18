# PLATFORM_APPROVALS.md

What we need to apply for so Kanosena can publish to Facebook, Instagram and LinkedIn for customers.

- **Checked against:** upstream Postiz **v2.26.0** code and the official docs linked below, on 15/11/2026.
- **Scopes, callback URLs and env var names** are copied from the code. File references point at `libraries/nestjs-libraries/src/integrations/social/`.
- Anything marked **UNVERIFIED** is not in the code and could not be confirmed against an official page. Check it before relying on it.

> **16/11/2026:** the hands-on setup and review pack (settings, permission justifications, reviewer instructions, screencast scripts, data handling answers and Chrome prompts) is in [`ours/docs/platform-review/`](ours/docs/platform-review/README.md). It wins where it differs from this file.
>
> **17/11/2026: Instagram (Standalone) is not available to us.** Meta no longer offers "API setup with Instagram login" for new apps (only the unified login through Facebook Login for Business), so there is no Instagram app ID or secret for `instagram-standalone`. We use one Meta app for Facebook and for Instagram via a linked Facebook Page (section 2a). Customers need an Instagram professional account linked to a Page. Section 2b and the "apply for both" recommendation below are out of date.

Throughout, `FRONTEND_URL` means the public URL customers use for the app, for example `https://app.kanosena.com`. Callback URLs are built from it, so it must be the final production domain before you register the URLs.

---

## Before you apply: things only you can provide

Both Meta and LinkedIn vet the **business**, not just the app. These are the slowest parts, so start them first.

| Need | Meta | LinkedIn | Notes |
|---|---|---|---|
| A registered legal entity (for example a UK Ltd company) | Needed for Business Verification | **Required.** "Only available to registered legal organizations for commercial use cases only" | If you trade as a sole trader, confirm whether that is accepted before applying. **UNVERIFIED for sole traders.** |
| Business email on your own domain | Strongly advised | **Required.** Personal addresses "won't pass the vetting process" | e.g. `you@kanosena.com`, not Gmail |
| Public website on that domain | Needed | Needed: website and domain are verified | Can be a one-page site |
| Privacy policy URL | Required in App Settings | Required for Standard tier | Must say how users can ask for their data to be deleted. **Draft ready:** `https://<app domain>/privacy.html` (fill in company details first) |
| Terms of service URL | Asked for in App Settings | Asked for | **Draft ready:** `https://<app domain>/terms.html` |
| Data deletion URL (instructions page or callback) | Required for apps that access user data | n/a | **Upstream has no deletion callback.** Use an instructions page for now: `https://<app domain>/data-deletion.html`. See "Gaps in the code" |
| A LinkedIn Company Page for the business | n/a | **Required.** A super admin of the Page must verify the app | |
| A Meta Business Portfolio (Business Manager) | Required | n/a | Business Verification happens here |
| A running, publicly reachable instance | Reviewers must be able to test it | Needed for the Standard tier screencast | Not needed to *start* applications. Needed before you submit for review |
| Test login for reviewers | Required | Required for Standard tier | A reviewer account on the deployed instance |

**Brand rules for app names:** LinkedIn rejects apps whose name or logo includes any part of "LinkedIn" or "Microsoft" (for example "Linked" or "In"). Keep "Kanosena", or the final brand, as the app name on both platforms.

---

## 1. Facebook (Pages)

### Where to apply
1. Create a Meta app (type **Business**) at https://developers.facebook.com/apps. The same app also serves Instagram (section 2).
2. Complete **Business Verification** for the Business Portfolio that owns the app: https://developers.facebook.com/docs/development/release/business-verification. Advanced Access requires it: "Business Verification is required to get Advanced Access" ([Access Levels](https://developers.facebook.com/docs/graph-api/overview/access-levels/)).
3. Complete **Access Verification** to become a **Tech Provider**, because we access other businesses' Pages: https://developers.facebook.com/docs/development/release/tech-providers/. Meta's docs say this is "independent of App Review".
4. Submit **App Review** for each permission below, asking for **Advanced Access**: https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review/submission-guide.

### Permissions the code requests
From `facebook.provider.ts` (`scopes`, lines 36–43):

| Permission | What our app uses it for |
|---|---|
| `pages_show_list` | List the Pages the user manages so they can pick one |
| `business_management` | Read Pages owned through a Business Portfolio (`/me/businesses`, `/{business}/owned_pages`) |
| `pages_manage_posts` | Publish posts, photos and videos to the Page |
| `pages_manage_engagement` | Post the first comment and manage comments |
| `pages_read_engagement` | Read Page content, comments and engagement |
| `read_insights` | Page and post analytics |

**Important:** the code checks that **every** listed permission was granted (`checkScopes` in `social.abstract.ts`). If any one is missing, connecting the channel fails with "not enough scopes". So we must get Advanced Access for all six, or change the scope list later in our own code. Do not apply for a subset without planning that change.

Graph API version used: **v25.0** (`META_GRAPH_API_VERSION` in `facebook.provider.ts`).

### Callback URL
Register this in **Facebook Login for Business → Settings → Valid OAuth Redirect URIs**:

```
{FRONTEND_URL}/integrations/social/facebook
```

When a user reconnects a channel, the token exchange sends `{FRONTEND_URL}/integrations/social/facebook?refresh=<id>` as the `redirect_uri` (`facebook.provider.ts`, around line 346). Test a reconnect on the deployed instance. If Meta rejects it, add the variant as well. **UNVERIFIED** whether Meta's strict redirect matching needs it.

### Environment variables
```
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
```
Both are shared with the "Instagram (Facebook Business)" channel.

### Review requirements (from Meta docs)
- One screencast **per permission**, showing the end-to-end flow, with the app UI in English and captions where buttons are unclear ([Instagram App Review page](https://developers.facebook.com/documentation/instagram-platform/app-review). The same rules apply across Meta permissions).
- Step-by-step test instructions and test credentials for reviewers.
- You must make **at least one successful API call** with a permission before you can request Advanced Access for it. In Development mode, people with a role on the app (admins, developers, testers) can use all permissions without review. Use that to record the screencasts.
- Only request permissions you actually use, or the submission is rejected.
- Advanced Access apps must complete an annual **Data Use Checkup**.
- Which "use case" in the new app dashboard holds each permission: **UNVERIFIED**. Meta's mapping table did not load ([use cases permission mapping](https://developers.facebook.com/documentation/development/create-an-app/use-cases-permission-mapping)). Expect "Manage everything on your Page" for the `pages_*` permissions.

---

## 2. Instagram

Upstream ships **two** Instagram channels. They use different Meta products and different credentials.

| Channel name in app | Identifier | Account type needed | Login | Env vars |
|---|---|---|---|---|
| Instagram (Facebook Business) | `instagram` | Instagram Professional account **linked to a Facebook Page** | Facebook Login | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` |
| Instagram (Standalone) | `instagram-standalone` | Instagram Professional account (Business or Creator), **no Facebook Page needed** | Instagram Login | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` |

Neither works with personal Instagram accounts.

**Recommendation:** apply for **both** in the same Meta app and the same review round. Many UK small businesses have an Instagram business account that was never linked to a Page, so Standalone avoids a confusing setup step for them. The Facebook-linked route is useful when they already manage both together. The screencasts overlap heavily, so doing both costs little extra.

### 2a. Instagram (Facebook Business): `instagram.provider.ts`

**Where to apply:** same Meta app, Business Verification, Tech Provider status and App Review as Facebook (section 1).

**Permissions** (`scopes`, lines 37–45). The all-or-nothing check applies here too:

| Permission | Use |
|---|---|
| `instagram_basic` | Read the Instagram account profile |
| `pages_show_list` | Find the Page the Instagram account is linked to |
| `pages_read_engagement` | Read the linked Page |
| `business_management` | Pages owned through a Business Portfolio |
| `instagram_content_publish` | Publish posts, carousels, Reels and Stories |
| `instagram_manage_comments` | Post the first comment, read comments |
| `instagram_manage_insights` | Analytics |

**Callback URL** (Facebook Login for Business → Valid OAuth Redirect URIs):
```
{FRONTEND_URL}/integrations/social/instagram
```
The reconnect variant `?refresh=<id>` applies here as it does for Facebook.

**Env vars:** `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`. These are the same as Facebook.

### 2b. Instagram (Standalone): `instagram.standalone.provider.ts`

**Where to apply:** add the **Instagram API with Instagram Login** product to the same Meta app. Setup guide: https://developers.facebook.com/docs/instagram-platform/create-an-instagram-app. The product has its own **Instagram app ID and secret**, shown under Instagram → API setup with Instagram business login. These are different from the Facebook app ID.

**Permissions** (`scopes`, lines 32–37):

| Permission | Use |
|---|---|
| `instagram_business_basic` | Profile |
| `instagram_business_content_publish` | Publishing |
| `instagram_business_manage_comments` | First comment, comments |
| `instagram_business_manage_insights` | Analytics |

**Callback URL** (Instagram → Business login settings → OAuth redirect URIs):
```
{FRONTEND_URL}/integrations/social/instagram-standalone
```
Note: if `FRONTEND_URL` does not start with `https`, the code sends the redirect through a third-party service, `https://redirectmeto.com/{FRONTEND_URL}/...`. This only matters for local development. Production must be on https so that it never happens.

**Env vars:**
```
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
```
These are **missing from upstream's `.env.example` and `docker-compose.yaml`**, but the code reads them. `DEPLOYMENT.md` lists them.

**Review requirements:** Meta's [App Review for Instagram API](https://developers.facebook.com/documentation/instagram-platform/app-review) says:
- Apps serving multiple businesses ("I am a Tech Provider") need App Review for both Instagram Login and Facebook Login.
- You need a privacy policy URL, a screencast per permission, a visible login button that follows Meta brand guidelines, and test instructions for reviewers.
- "Web is currently the only platform that supports Instagram API with Instagram Login." That suits us.
- Business Verification and data deletion are not covered on that page. They follow the general rules in section 1.

---

## 3. LinkedIn

Upstream has **two** LinkedIn channels sharing **one** LinkedIn app:

| Channel | Identifier | Posts as | File |
|---|---|---|---|
| LinkedIn | `linkedin` | The member's personal profile | `linkedin.provider.ts` |
| LinkedIn Page | `linkedin-page` | A Company Page the member administers | `linkedin.page.provider.ts` |

For small businesses, **LinkedIn Page** is the main channel. The personal channel suits sole traders who post as themselves.

### Where to apply
1. Create an app at https://www.linkedin.com/developers/apps and associate it with your **LinkedIn Company Page**. A super admin of that Page must verify the app.
2. Request the **Community Management API** product. You start on the **Development tier** after vetting: [app review page](https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review?view=li-lms-2026-10), [tiers](https://learn.microsoft.com/linkedin/marketing/increasing-access).
3. Once the integration works end to end, apply for the **Standard tier** on the same page. Production needs this tier.

### Permissions the code requests
Both providers request the same list (`linkedin.provider.ts` lines 66–74, `linkedin.page.provider.ts` lines 30–38), joined with spaces:

| Scope | Comes from (our reading of LinkedIn docs) | Use |
|---|---|---|
| `openid` | Sign In with LinkedIn using OpenID Connect | `/v2/userinfo` for id, name and picture |
| `profile` | Sign In with LinkedIn using OpenID Connect | Same |
| `w_member_social` | Community Management API (also Share on LinkedIn) | Post as the member |
| `r_basicprofile` | Legacy profile scope | `/v2/me` for the vanity name. **UNVERIFIED** which product grants it today |
| `rw_organization_admin` | Community Management API | List the Pages the member administers, Page analytics |
| `w_organization_social` | Community Management API | Post as the Page |
| `r_organization_social` | Community Management API | Read Page posts and comments |

The same all-or-nothing scope check applies. **Even the personal LinkedIn channel fails to connect unless the app has the organisation scopes too.** So both channels depend on Community Management API approval.

**Risk, UNVERIFIED:** a Microsoft Q&A post (written by a user, not by LinkedIn) says an app cannot have **Community Management API** and **Sign In with LinkedIn using OpenID Connect** enabled at the same time: [thread](https://learn.microsoft.com/en-us/answers/questions/5815518/cannot-enabled-community-management-api-on-a-verif). Upstream's code needs both on one app. Postiz Cloud presumably runs this way, so it may be outdated or wrong. If it turns out to be true when you add the products, tell the next milestone. The fix would be a code change in our own files, such as a second client ID for sign-in.

### Callback URLs
Register both under the app's **Auth → Authorized redirect URLs**:
```
{FRONTEND_URL}/integrations/social/linkedin
{FRONTEND_URL}/integrations/social/linkedin-page
```
The personal channel adds `?refresh=<id>` on reconnect (`linkedin.provider.ts` around line 208). LinkedIn matches redirect URLs exactly, so **UNVERIFIED** whether that variant also needs registering. Test it.

### Environment variables
```
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
```

### Review requirements (from LinkedIn docs)
**Development tier** is checked on: an approved use case, a verified business email, a verified organisation, a verified website and domain, and the app verified by the organisation's LinkedIn Page.
- Limits: 500 calls per app and 100 calls per member per 24 hours, and no batch calls. That is enough for testing, not for customers.
- You must build the core use case within 12 months.
- **If rejected, you cannot re-apply with the same app.** You need a new app. Get the business details right first time.

**Standard tier** requires:
- Development tier approval and a fully working integration.
- A company and product overview, a use case description and reviewer test credentials.
- A high-resolution, downloadable screencast showing only our app, narration recommended, covering the **Page Management** test cases: OAuth approval, posting to the Page, and showing commenter profile fields if we display comments. Add **Page Analytics** if we show post performance.
- A valid privacy policy and compliance with LinkedIn's data storage and security terms.
- Again, a rejection means starting over with a new app.

Choose the use cases on the form that match what the code does: **Page Management** and **Page Analytics**. Add **Executive Management** only if we keep the personal-profile channel.

---

## Gaps in the code that affect approval

These are not fixed in this milestone. They are listed so the right milestone picks them up.

1. **No Meta data deletion callback.** Upstream has no endpoint for Meta's Data Deletion Request callback. Use a data deletion **instructions** page on the website for now. Meta accepts "either a data deletion callback instruction URL or a callback URL" ([docs](https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/data-deletion-callback)). A proper callback would be a small module of our own.
2. **All-or-nothing scopes.** Connecting fails if any requested scope is refused. If Meta or LinkedIn approves only some permissions, we need a provider override in our own files.
3. **Instagram Standalone env vars are undocumented upstream.** See section 2b.
4. **A reviewer-ready deployment is needed** before submitting any review (screencasts, test login). That belongs to a deployment milestone, not this one.

## Suggested order

1. This week: set up the legal entity (if not already), domain, business email, one-page site with privacy policy, terms and data-deletion instructions, the LinkedIn Company Page and the Meta Business Portfolio.
2. Start Meta **Business Verification** and the LinkedIn **Development tier** request. Both need only business details, not a working app.
3. Create the Meta app and add both Instagram products. Test in Development mode with your own accounts.
4. Once a staging instance is live on the final domain, register the callback URLs, record the screencasts and submit Meta App Review, Meta Access Verification and the LinkedIn Standard tier request.
