# LinkedIn review pack

Sources, checked 16/11/2026:
- Community Management App Review: https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review
- Getting access (open permissions): https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access
- Product clash report (a developer's own answer, not LinkedIn staff): https://learn.microsoft.com/en-us/answers/questions/5815518/cannot-enabled-community-management-api-on-a-verif
- Upstream's own setup notes (for comparison only): https://docs.postiz.com/providers/linkedin-page.md

## What LinkedIn requires, in short

- **Community Management API** is "only available to registered legal organizations for commercial use cases". Steady Lamp Ltd qualifies.
- Before applying: a **super admin of the Steady Lamp Ltd LinkedIn Page verifies the app**, a verified **business email** on our own domain (support@kanosena.com; personal emails "will not pass the vetting process"), and an app name and logo with no part of "LinkedIn" or "Microsoft".
- **Development tier** first: approved use case, verified business email, verified organisation, verified website and domain, app verified by the Page.
- **Standard tier** next, once the integration works: company and product overview, use case description, test credentials, a valid privacy policy, and a high-resolution, downloadable screencast of "all core functionality".
- **A rejection at either tier means a new app.** "You will not be able to re-apply … with your existing app." So nothing is submitted until every field below is filled in and the legal pages are out of draft.

## Development tier denied (24/11/2026)

LinkedIn denied app "Kanosena" (Client ID 78xvyinuq3th8y, application 266771074) with "Access Denied: Business verification failed". No further reason given. LinkedIn's docs: "If your application is rejected, review the qualifications, create a new app, and submit a new Development tier access request form. You won't be able to re-apply for Development tier access with your existing app."

Likely causes (our reading; LinkedIn does not say which):
1. The website on the form was the app's About page (app.kanosena.com/about.html). It named Steady Lamp Ltd but showed no company number or registered office, and kanosena.com itself had no website until 20/11, the day after we applied.
2. The legal name (Steady Lamp Ltd) did not visibly match the LinkedIn Page ("Kanosena", created days earlier, with little on it).
3. The form went in without the use case description.

Fixed: the legal and About pages now carry "Kanosena is a trading name of Steady Lamp Ltd, registered in England and Wales, company number 17533499. Registered office: 128 City Road, London, EC1V 2NX." The kanosena.com homepage already shows the same.

Before the new application:
- LinkedIn Page "Kanosena": website https://kanosena.com, About text naming Steady Lamp Ltd with company number and address, logo, cover, a few posts.
- New app (a name without "LinkedIn"/"Microsoft", e.g. "Kanosena Publisher"), on the same Page, verified by the Page super admin, same four redirect URLs, logo, privacy policy.
- Form: legal name Steady Lamp Ltd, address as above, email support@kanosena.com, **website https://kanosena.com**, privacy https://app.kanosena.com/privacy.html, Page Management and Page Analytics, the full use case description above.
- After approval: new LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET on the Worker, then the "Deploy to Cloudflare (ours)" workflow.

## Products and scopes (settled 19/11/2026)

The clash is real. With **Community Management API** requested, the Products tab greys out **Sign In with LinkedIn using OpenID Connect** and **Share on LinkedIn**: "Your application has another product requested or added to it which requires that it be the only product on the application for legal and security reasons."

So we use our own LinkedIn Page provider (`libraries/nestjs-libraries/src/ours/linkedin/linkedin.page.provider.ts`, same `linkedin-page` identifier and redirect URL as upstream). It asks for Community Management API scopes only, and refuses to connect if any is missing:

| Scope | Used for |
|---|---|
| `r_basicprofile` | The signed-in member's id, name and picture (`/v2/me`), until they pick a Page |
| `rw_organization_admin` | Listing the Pages the member administers, Page details, Page and post analytics |
| `w_organization_social` | Publishing approved posts as the Page |
| `r_organization_social` | Reading the published posts' social action counts |

Not requested: `openid`, `profile` (OpenID Connect, not allowed on this app) and `w_member_social` (posting as the member, which the Page channel never does). The personal **LinkedIn** channel needs OpenID Connect, so it is hidden (`HIDDEN_PROVIDERS` in `ours/deploy/cloudflare/wrangler.jsonc`). Customers connect a **LinkedIn Page**.

**Do not request the Advertising API.** Upstream's docs tell self-hosters to add it (for refresh tokens), but we don't run ads, and asking for a product whose use case we don't have risks a rejection and a new app.

## Development tier form answers

| Field | Answer |
|---|---|
| Legal name | Steady Lamp Ltd |
| Registered address | 128 City Road, London, EC1V 2NX |
| Business email | support@kanosena.com |
| Website | https://app.kanosena.com/about.html (kanosena.com will point to the product page) |
| Privacy policy | https://app.kanosena.com/privacy.html |
| Use cases | **Page Management** and **Page Analytics**. Not Executive Management, Employee Advocacy or Brand Engagement |
| Use case description | See below |

**Use case description:**
> Kanosena is a social media service for UK small businesses (1–20 staff), run by Steady Lamp Ltd. A business owner connects their company's LinkedIn Page through LinkedIn's OAuth flow. Kanosena drafts posts from the business's own website, the owner approves, edits or rejects each one, and approved posts are published to the LinkedIn Page at the planned time. Nothing is published without the owner's explicit approval. We then show the owner how each published post performed (impressions, reactions, comments and shares counts) so they can see what works. We use rw_organization_admin to list the Pages the member administers so they can choose one, and to read Page and post analytics; w_organization_social to publish approved posts as the Page; r_organization_social to read the published posts' social action counts. We do not message members, scrape profiles, target ads or sell or share LinkedIn data.

## Standard tier form answers

**Company overview:**
> Steady Lamp Ltd is a UK private limited company (company number 17533499, incorporated 21/10/2026) that builds software for small businesses. Contact: support@kanosena.com.

**Product overview:**
> Kanosena plans, writes and schedules social media posts for small businesses, with the promise "You approve. We handle the rest." It builds a business profile from the company's own website, with a source for every fact, drafts a week of posts with simple branded graphics, and publishes only the posts the owner approves to their connected Facebook Page, Instagram account and LinkedIn Page. It is open source (https://github.com/calvin22580/postiz-app).

**Test credentials:**
> https://app.kanosena.com, user review@steadylamp.com, password `<password>` (paste from the password manager). The account has a LinkedIn Page connected **[only once that is true]** and a "Sandbox" channel, which is a simulated channel that never publishes anywhere.

## Reviewer instructions (for the form's notes)

> 1. Log in at https://app.kanosena.com/auth/login.
> 2. To connect a Page: "Add Channel" → "LinkedIn Page" → LinkedIn OAuth → choose the Page.
> 3. To post: "Create Post" → select the LinkedIn Page avatar → type text, optionally "Insert Media" → "Post now". The post appears on the LinkedIn Page.
> 4. Analytics: open the post in the calendar → "Statistics", or open "What worked" in the left menu.
> 5. Comments by members are not displayed in Kanosena, so the comment and commenter-profile test cases don't apply.

## Screencast script (one video, narrated)

LinkedIn: high resolution, downloadable (upload the MP4 to a link that downloads without sign-in, e.g. an R2 public link or a Google Drive file shared to anyone with the link), only our app's screens, narration recommended, and "if your application doesn't include certain functionality … just note that in your recording".

Same set-up as the Meta screencasts (clean Chrome window, macOS recording). Record after the Development tier is granted and the LinkedIn keys are on the live site.

**Page Management**
1. Narrate: "This is Kanosena, a social media service for small businesses by Steady Lamp Ltd. A business owner logs in." Log in.
2. **Test case 1, OAuth:** "The owner connects their company's LinkedIn Page." Add Channel → LinkedIn Page → full LinkedIn consent screen, showing the permissions → Allow → choose the Page from the list → Page appears in the sidebar.
3. **Test case 2, post to the Page:** "The owner writes a post, or approves one from their weekly plan, and Kanosena publishes it to the Page." Create Post → select the Page → test text plus a photo → Post now. Then open the Page on linkedin.com and show the post.
4. Optional: "Weekly posts" → Approve one draft → show it scheduled in the calendar. Narrate: "Nothing is published without the owner's approval."
5. **Test cases 3 and 4:** narrate "Kanosena does not display comments or commenter profile data from LinkedIn."
6. **Test case 5:** narrate "We store only the Page's ID, name and logo and the member's name and picture for the connection. No other member personal data is used."

**Page Analytics**
7. **Test case 2, post performance:** "Kanosena shows how each post performed." Open the post → Statistics (impressions, reactions, comments, shares). Then "What worked".
8. **Test case 3:** narrate "We show only totals. No profile data of members who engaged is displayed."

Keep it under 5 minutes.

## After approval

- Standard tier moves the app off the Development limits (500 calls per app and 100 per member a day).
- LinkedIn can re-review if the app's functionality changes. Showing comments, or adding the personal-profile channel to the offer, would count.
- Check LinkedIn's data storage requirements against what we keep (pre-launch item 11) before submitting the Standard tier.
