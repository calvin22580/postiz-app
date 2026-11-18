# Chrome prompt: LinkedIn app

**Calvin:** paste the box below into Claude in Chrome. It will ask you to log in (with the account that is a super admin of the Steady Lamp Ltd LinkedIn Page) where needed.

Important: LinkedIn does not let us re-apply with the same app after a rejection. The prompt therefore sets the app up but does **not** submit the Community Management access form until Calvin has checked it.

---

```text
You are setting up a LinkedIn developer app for Kanosena, a social media scheduling service run by Steady Lamp Ltd (UK). Work in a new tab. Rules:
- Do NOT submit any access request form (Community Management API, Standard tier) without showing Calvin the filled-in form and getting a "yes" in chat. A rejection means starting again with a new app.
- Never type a secret into chat. Copy the client secret only into the Cloudflare form in step 6.
- If anything asks for a detail not given here (phone, or anything else not listed), stop and ask Calvin.
- If a site (linkedin.com/developers and dash.cloudflare.com) isn't logged in, open its login page, ask Calvin in chat to log in, and wait for him to say done. Calvin does nothing else.
- Before starting, download the icon from https://github.com/calvin22580/postiz-app/raw/main/ours/docs/platform-review/assets/app-icon-300.png (it saves to Downloads).
- If a screen differs from these steps, do the closest equivalent and tell Calvin.

Values:
- App name: Kanosena   (must not contain "Linked", "In", "LinkedIn" or "Microsoft")
- LinkedIn Page: Steady Lamp Ltd (the company Page Calvin super-admins)
- Privacy policy URL: https://app.steadylamp.com/privacy.html
- Website: https://app.steadylamp.com/about.html
- Business email: support@steadylamp.com
- Logo: app-icon-300.png (downloaded above)
- Redirect URLs (exactly, no trailing slash):
   https://app.steadylamp.com/integrations/social/linkedin-page
   https://app.steadylamp.com/integrations/social/linkedin

STEP 1. Page check
Confirm a LinkedIn Page for Steady Lamp Ltd exists and Calvin's account is a super admin (Page → Admin tools → Manage admins). If not, stop and tell Calvin.

STEP 2. Create the app
linkedin.com/developers/apps → Create app. Name Kanosena, LinkedIn Page Steady Lamp Ltd, privacy policy URL above, logo, accept the legal agreement. Create.

STEP 3. Verify the app with the Page
Settings tab → Verify → generate the verification URL. Calvin's account is a Page super admin, so open the URL and approve it. Confirm the Settings tab shows the app as verified.

STEP 4. Redirect URLs
Auth tab → OAuth 2.0 settings → Authorized redirect URLs → add both URLs above. Save.

STEP 5. Products (this is a fact-finding step: report exactly what happens)
Products tab:
a. Find "Community Management API" → Request access. Open the form and FILL IT IN but DO NOT SUBMIT. Use:
   - Legal name: Steady Lamp Ltd. Registered address: 128 City Road, London, EC1V 2NX. Business email: support@steadylamp.com (verify it if asked; Calvin may need to click an email link). Website: https://steadylamp.com. Privacy policy: https://app.steadylamp.com/privacy.html
   - Use cases: Page Management and Page Analytics only.
   - Use case description (paste exactly):
     "Kanosena is a social media service for UK small businesses (1–20 staff), run by Steady Lamp Ltd. A business owner connects their company's LinkedIn Page through LinkedIn's OAuth flow. Kanosena drafts posts from the business's own website, the owner approves, edits or rejects each one, and approved posts are published to the LinkedIn Page at the planned time. Nothing is published without the owner's explicit approval. We then show the owner how each published post performed (impressions, reactions, comments and shares counts) so they can see what works. We use rw_organization_admin to list the Pages the member administers so they can choose one, and to read Page and post analytics; w_organization_social to publish approved posts as the Page; r_organization_social to read the published posts' social action counts. We do not message members, scrape profiles, target ads or sell or share LinkedIn data."
   Take a screenshot of the filled form for Calvin, then STOP and ask Calvin whether to submit.
b. Note whether "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn" can be added alongside Community Management API. If the page says one disables or excludes the other, do NOT add it; just report the exact wording. If they are self-serve and compatible, add them.
c. Do NOT add "Advertising API" or any other product.
d. Auth tab: copy the full list of "OAuth 2.0 scopes" shown, for the report.

STEP 6. Secrets into Cloudflare (no chat)
dash.cloudflare.com → Workers & Pages → the Worker serving app.steadylamp.com → Settings → Variables and Secrets → Add, type "Secret":
   LINKEDIN_CLIENT_ID = Auth tab Client ID
   LINKEDIN_CLIENT_SECRET = Auth tab Primary Client Secret
Save/deploy. Do not show the secret in chat.

STEP 7. Report to Calvin in chat (no secrets): the app's Client ID (not secret), whether the app is verified by the Page, the redirect URLs as saved, exactly which products are added/pending and any wording about products excluding each other, the full OAuth scope list from the Auth tab, the state of the Community Management form (filled, not submitted unless Calvin said yes), and anything that looked different. Calvin will paste this report back to Claude.
```
