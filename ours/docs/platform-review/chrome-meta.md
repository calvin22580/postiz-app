# Chrome prompt: Meta apps

**Calvin:** paste the box below into Claude in Chrome. It will ask you to log in where needed.



---

```text
You are setting up a Meta developer app for Tidepost, a social media scheduling service run by Steady Lamp Ltd (UK). Work in a new tab. Follow these rules:
- Do NOT submit anything for App Review, do NOT click Publish / Go Live, and do NOT start Business Verification without asking Calvin first in chat.
- Never type a secret into chat or a note. Copy App IDs and secrets only into the Cloudflare form in step 5.
- If a field asks for something not given here (phone number, or anything else not listed), stop and ask Calvin.
- If a site (developers.facebook.com, business.facebook.com and dash.cloudflare.com) isn't logged in, open its login page, ask Calvin in chat to log in, and wait for him to say done. Calvin does nothing else.
- Before starting, download the icon from https://github.com/calvin22580/postiz-app/raw/main/ours/docs/platform-review/assets/app-icon-1024.png (it saves to Downloads).
- If a screen looks different from these steps, do the closest equivalent and tell Calvin what you did.

Values:
- Business portfolio: Steady Lamp Ltd (create it if it doesn't exist, ask Calvin first). Company number 17533499, registered office 128 City Road, London, EC1V 2NX
- Contact email: support@steadylamp.com
- App domain: app.steadylamp.com
- Website / Site URL: https://app.steadylamp.com/about.html
- Privacy policy URL: https://app.steadylamp.com/privacy.html
- Terms of service URL: https://app.steadylamp.com/terms.html
- User data deletion (instructions URL): https://app.steadylamp.com/data-deletion.html
- Category: Business and pages
- Icon: app-icon-1024.png (downloaded above)

STEP 1. App 1, name "Tidepost"
a. developers.facebook.com/apps → Create app. Name "Tidepost", contact email support@steadylamp.com.
b. Use cases: choose "Manage everything on your Page" AND "Manage messaging and content on Instagram". App type Business if asked. Connect it to the Steady Lamp Ltd business portfolio.
c. Customise "Manage everything on your Page": keep business_management, pages_show_list, public_profile; ADD pages_manage_posts, pages_manage_engagement, pages_read_engagement, read_insights, pages_read_user_content (Meta requires it for pages_manage_engagement). Add nothing else.
d. Customise "Manage messaging and content on Instagram": choose "API setup with Facebook login". Keep/ADD instagram_basic, instagram_content_publish, instagram_manage_comments, instagram_manage_insights, pages_show_list, pages_read_engagement, business_management, pages_read_user_content (Meta requires it for instagram_basic). REMOVE instagram_manage_messages and any other messaging permission if allowed. Tell Calvin if something can't be removed.
e. App settings → Basic: App domains app.steadylamp.com; privacy, terms and data deletion URLs above; category Business and pages; upload the icon; Add platform → Website, Site URL above. Save.
f. Facebook Login for Business → Settings: Client OAuth login ON, Web OAuth login ON, Enforce HTTPS ON, Use Strict Mode for redirect URIs ON, Login with the JavaScript SDK OFF, Login from devices OFF. Valid OAuth Redirect URIs, exactly these two (no trailing slash):
   https://app.steadylamp.com/integrations/social/facebook
   https://app.steadylamp.com/integrations/social/instagram
   Save.
g. App roles: confirm Calvin's Facebook account is an Administrator.

STEP 2. Do nothing with "Tidepost Business" (App ID 1428592625924097). Meta no longer offers Instagram login for new apps. Leave that app unused and do not delete it.

STEP 3. Tech Provider
In App 1's dashboard, find "Become a Tech Provider" / Access verification. Read Calvin the questions and requirements. Do not submit; Calvin decides.

STEP 4. Business Verification
Business settings (business.facebook.com/settings) → Security Centre / Business info. Tell Calvin whether Steady Lamp Ltd is verified, and if not, list exactly what the form asks for (company number, address, phone, domain check). Do not start it without Calvin.

STEP 5. Secrets into Cloudflare (no chat)
dash.cloudflare.com → Workers & Pages → the Worker serving app.steadylamp.com (ask Calvin if unsure which) → Settings → Variables and Secrets → Add, type "Secret", for each:
   FACEBOOK_APP_ID = App 1 App ID (App settings → Basic)
   FACEBOOK_APP_SECRET = App 1 App secret
Deploy/save. Do not show the values in chat.

STEP 6. Report to Calvin in chat (no secrets): the Tidepost App ID (not secret), which permissions it has and anything that could not be added or removed, the redirect URIs as saved, Business Verification status and what it needs, the Tech Provider requirements, and anything that looked different from these steps. Calvin will paste this report back to Claude.
```
