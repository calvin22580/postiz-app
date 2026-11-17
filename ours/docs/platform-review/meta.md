# Meta (Facebook and Instagram) review pack

Sources, checked 16/11/2026:
- App Review for Instagram API: https://developers.facebook.com/documentation/instagram-platform/app-review
- Pages use case ("Manage everything on your Page"): https://developers.facebook.com/documentation/development/create-an-app/pages-use-case
- Instagram use case ("Manage messaging and content on Instagram"): https://developers.facebook.com/documentation/development/create-an-app/instagram-use-case
- Business Login for Instagram: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
- Facebook Login for Business: https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/
- Data deletion: https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/data-deletion-callback
- Data handling questions: https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/data-handling-questions/questions-preview

## What Meta requires, in short

- We serve many businesses, so we are a **Tech Provider**: every permission needs **App Review for Advanced Access**, plus **Business Verification** of the Steady Lamp Ltd business portfolio and **Tech Provider access verification**.
- Per permission: describe how it is used, a **screencast** of the end-to-end flow, step-by-step **reviewer instructions** and **test credentials**. App UI in English, captions where a button isn't obvious.
- **At least one successful API call** with each permission before submitting it. People with a role on the app can use every permission in Development mode, so recording the screencasts does this.
- **Only request what we use**, and include any permission another one depends on, or "your submission will not be approved".
- App settings: 1024×1024 icon, privacy policy URL, data deletion URL, category, business email. Publishing also needs Data Protection Officer contact details if we do business in the EU (**[FILL IN: does Steady Lamp Ltd serve EU customers? If not, leave blank]**).
- The Instagram login button must be visible in the app and screencast and follow Meta's brand guidelines. Our "Add Channel" screen shows each platform's own logo and name.
- Annual Data Use Checkup once approved.

## One Meta app (Instagram Login is not available)

**17/11/2026:** Meta no longer offers "API setup with Instagram login" for newly created apps. Claude in Chrome saw "API setup with Instagram login is not available for newer apps" on the second app. New apps only get the unified login, which runs through Facebook Login for Business. So there is no separate Instagram app ID or secret, and upstream's **Instagram (Standalone)** channel (`instagram-standalone`, `INSTAGRAM_APP_*`) can't be used.

We use **one app, `Tidepost`** (Business type), with "Manage everything on your Page" and "Manage messaging and content on Instagram" → **API setup with Facebook Login**. It powers:
- the Facebook Page channel (`facebook`);
- the Instagram (Facebook Business) channel (`instagram`).

**Limitation:** customers need an Instagram professional account **linked to a Facebook Page**. An Instagram account with no Page can't be connected. The Instagram (Standalone) channel is hidden from the add-channel screen on the live site (`HIDDEN_PROVIDERS`).

A second app, "Tidepost Business" (App ID 1428592625924097), was created before this was found. Calvin's decision: leave it unused, don't delete it, and don't submit it for review.

## Permissions and justification text

The code checks that **every** permission in its list was granted (`checkScopes`), so ask for all of them, exactly these, at Advanced Access. Paste the text into each permission's "How will your app use this permission?" box. Each one describes what the app really does today.

### Facebook Page channel (`facebook.provider.ts`)

**`pages_show_list`**
> Tidepost is a social media scheduling service for small businesses. After the business owner logs in with Facebook from our "Add Channel" screen, we use pages_show_list to list the Facebook Pages they manage, so they can choose which Page Tidepost should publish to. We store only the chosen Page's ID, name and picture. The owner can disconnect the Page at any time, which deletes its tokens and details.

**`business_management`**
> Many small businesses manage their Facebook Page through a Meta business portfolio rather than directly. We use business_management only to read the Pages owned by the business portfolios the owner belongs to (/me/businesses and /{business-id}/owned_pages), so those Pages appear in the list they choose from. We do not create, change or read any other business assets.

**`pages_manage_posts`**
> This is the core of our product. The business owner approves each post in Tidepost (text with an optional photo or video), and at the scheduled time we publish it to the Page they connected. Nothing is ever published without the owner's explicit approval in our app. We also use it to show the owner the post's link once it is live.

**`pages_manage_engagement`**
> When writing a post in Tidepost, the owner can add a first comment (for example a link or extra details) using "Add comment" in the post editor. Right after the approved post is published, we publish that comment on the post as the Page. We only post comments the owner has written and approved; we do not reply to, hide or delete other people's comments.

**`pages_read_engagement`**
> We read the connected Page's basic details (name, picture) and the engagement on posts published through Tidepost (reactions, comments and shares counts), so we can show the owner how their approved posts performed on our "What worked" screen and in each post's Statistics. It is also required by read_insights and pages_manage_posts.

**`read_insights`**
> We read post-level insights (reach and impressions) for posts published through Tidepost, and show them to the business owner on our "What worked" screen and in each post's Statistics window. This helps them see which kinds of posts work for their business. Insights are only shown to members of that business's Tidepost account and are deleted when the Page is disconnected or the account is closed.

### Instagram (Facebook Business) channel (`instagram.provider.ts`)

**`instagram_basic`**
> After the business owner logs in with Facebook from our "Add Channel" screen and picks "Instagram (Facebook Business)", we use instagram_basic to read the Instagram professional account linked to their Facebook Page (username, name and profile picture), so they can confirm it is the right account. We store only that account's ID, username and picture.

**`instagram_content_publish`**
> This is the core of our product. The business owner approves each Instagram post in Tidepost (a photo, carousel, Reel or Story with a caption), and at the scheduled time we publish it to their Instagram professional account. Nothing is ever published without the owner's explicit approval in our app.

**`instagram_manage_comments`**
> When writing a post, the owner can add a first comment using "Add comment" in the post editor. Right after the approved post is published, we publish that comment on it. We only post comments the owner wrote and approved; we do not reply to, hide or delete other people's comments.

**`instagram_manage_insights`**
> We read insights (reach, likes, comments, saves) for posts published through Tidepost and show them to the business owner on our "What worked" screen and in each post's Statistics window, so they can see which kinds of posts work. Shown only to that business's Tidepost account; deleted when the account is disconnected or closed.

**`pages_show_list`, `pages_read_engagement`, `business_management`** (needed by the Instagram channel too)
> An Instagram professional account is reached through the Facebook Page it is linked to. We use pages_show_list and business_management to find the Pages the owner manages (directly or through their business portfolio), and pages_read_engagement to read the linked Instagram account from that Page. We do not publish to the Page through this channel.

## Allowed usage confirmations

Tick the "I agree that I will use this permission in compliance with its allowed usage" box for each permission. Our uses above are within the stated purpose of each (publishing, managing own comments and reading insights for the business's own Page or account).

## Reviewer instructions (paste into App Review → "Reviewer instructions")

Replace `<password>` with the test password from the password manager when pasting. Do not save it in this file.

> **Website:** https://app.steadylamp.com
> **Test login:** review@steadylamp.com / `<password>`
>
> Tidepost lets a small business owner approve social media posts, which we then publish at the planned time. Nothing is published without the owner's approval.
>
> **Connect a Facebook Page (pages_show_list, business_management)**
> 1. Log in at https://app.steadylamp.com/auth/login with the test login.
> 2. In the left sidebar, click "Add Channel", then "Facebook Page".
> 3. Log in with your Facebook test user and allow access. Choose a Page from the list (this list uses pages_show_list, and Pages owned through a business portfolio come from business_management). The Page now appears in the sidebar.
>
> **Publish a post (pages_manage_posts) with a first comment (pages_manage_engagement)**
> 4. Click "Create Post". Select the Facebook Page avatar at the top.
> 5. Type some text and, optionally, add a photo with "Insert Media".
> 6. Click "Add comment" under the editor and type a comment.
> 7. Click "Post now" (next to "Add to Calendar"). The post is published to the Page, then the comment is added to it.
> 8. Open the Page on Facebook to see the post and comment.
>
> **See results (pages_read_engagement, read_insights)**
> 9. Back in Tidepost, open the post in the calendar and click "Statistics" to see reach and engagement read from the Page. Insights can take a few minutes to appear after publishing.
> 10. Click "What worked" in the left menu to see the same results summarised.
>
> **Instagram (instagram_basic, instagram_content_publish, instagram_manage_comments, instagram_manage_insights)**
> 11. Click "Add Channel", then "Instagram (Facebook Business)". Log in with Facebook and choose the Instagram professional account linked to your Page.
> 12. Click "Create Post", select the Instagram avatar, add a photo (required by Instagram) and a caption, add a first comment with "Add comment", then "Post now". The post and comment appear on the Instagram account.
> 13. Open the post in the calendar and click "Statistics", or open "What worked", to see insights.
>
> A "Sandbox" channel is also connected to the test account. It is a simulated channel for demonstrations and never publishes anywhere; you can ignore it.
>
> The "Weekly posts" screen is how owners normally get posts: it drafts a week of posts from their business profile, they approve each one, and approved posts are scheduled to their connected channels in the same way as above.

**Before submitting, check every label above against the live app** (menu names can change with the brand). The screencast scripts use the same steps.

## Data handling questions (answers)

Meta asks these during App Review and Data Use Checkup. "Platform Data" means anything we receive from Meta (IDs, names, pictures, access tokens, post IDs, insights).

| Question | Answer |
|---|---|
| Will any data processors or service providers have access to Platform Data? | **Yes** |
| Processor: Cloudflare, Inc. | Category: "IT solutions and services, including cloud storage and processing" (app hosting in Cloudflare Containers, media storage in Cloudflare R2). Countries: app servers run in the Cloudflare data centre nearest the request (normally Europe; tick United Kingdom and the EU countries Cloudflare lists), R2 bucket in Western Europe (WEUR) |
| Processor: PlanetScale, Inc. | Category: "IT solutions and services, including cloud storage and processing" (Postgres database holding tokens, Page/account details and insights). Country: **United Kingdom** (London, eu-west-2). **[CHECK]** whether PlanetScale staff can access it remotely from other countries (e.g. United States) |
| Processor: Temporal Technologies, Inc. | Category: "IT solutions and services, including cloud storage and processing" (job scheduling; post IDs and integration IDs pass through workflow inputs). Country: **United Kingdom** (AWS eu-west-2, London), 1-day retention |
| Processor: Anthropic | **[CHECK, likely No]** We send business profile and caption text to Anthropic, not Meta Platform Data. M8 passes only our own categories (e.g. "service spotlight did better") derived from results, never raw insights or IDs. If you are unsure, list Anthropic, category "Other: AI text generation", country United States |
| Responsible entity (controls the Platform Data) | **Steady Lamp Ltd**, United Kingdom |
| National security requests in the past 12 months? | **No** |
| Policies for public authority requests | Tick: "Required review of the legality of these requests", "Provisions for challenging these requests if they are considered unlawful", "Data minimization policy", "Documentation of these requests". **[CHECK]** these are policies Steady Lamp Ltd actually has. If not written down yet, write a one-page policy first or tick "None of the above". Never tick something that isn't true |

## Business Verification and Tech Provider

- **Business Verification** (Business Settings → Security Centre → Start verification). Needs: legal name Steady Lamp Ltd, company number 17533499, registered office 128 City Road, London, EC1V 2NX, phone **[FILL IN]**, website `https://steadylamp.com` (add the Tidepost mention first, see README item 2), and a domain or email check (support@steadylamp.com, or DNS/meta-tag domain verification of steadylamp.com). Meta may ask for a Companies House certificate.
- **Tech Provider access verification**: App Dashboard → "Become a Tech Provider" (or Review → Access verification). Answers: we build a social media scheduling service that other businesses use to publish to their own Facebook Pages and Instagram accounts; we access their data only to publish posts they approved and show them their own results.
