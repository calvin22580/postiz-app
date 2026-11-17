# Meta screencast scripts

Meta wants one screencast per permission showing "the end-to-end user experience for that specific permission", showing "only how your app uses that permission", UI in English, with captions explaining anything that isn't obvious. Meta lets one video be attached to several permissions, so we record **four videos**, and attach each to the permissions it covers.

## Before recording

- Live site has the Meta app IDs and secrets (see `settings.md`) and has been redeployed.
- Calvin's Facebook account has a role (admin) on the Meta app, so Development mode allows every permission.
- Facebook Page and linked Instagram professional account ready **[FILL IN: names]**. Use a test post text that is plainly a test, e.g. "Test post from Tidepost: please ignore". It goes live on the real Page, so Calvin approves that wording before recording.
- Browser: a clean Chrome window at 1280×800 or larger, English UI, no other tabs or bookmarks bar showing, zoom 100%.
- Record with macOS screen recording (Cmd+Shift+5, "Record selected portion", the Chrome window only). Export MP4.
- Add captions afterwards (iMovie titles, or any editor), one short line per step, as below. Captions are in quotes.
- Keep each video under 5 minutes. No passwords visible: type them before starting, or blur.

## Video 1: Connecting a Facebook Page
**Attach to:** `pages_show_list`, `business_management`

1. Start on https://app.steadylamp.com/auth/login. Caption: "Tidepost: a small business owner logs in".
2. Log in with review@steadylamp.com. The calendar opens.
3. Click "Add Channel". Caption: "The owner connects their Facebook Page".
4. Click "Facebook Page". The Facebook login dialog opens. Caption: "Facebook Login: the owner grants access".
5. Go through the dialog, showing the permissions screen, and allow.
6. Back in Tidepost, the list of Pages appears. Caption: "pages_show_list: Pages the owner manages. Pages owned through a business portfolio are found with business_management". If possible, show a Page that comes from a business portfolio.
7. Choose the Page. It appears in the left sidebar with its name and picture. Caption: "The Page is connected. Only its ID, name and picture are stored".

## Video 2: Publishing to the Page with a first comment
**Attach to:** `pages_manage_posts`, `pages_manage_engagement`, `pages_read_user_content` (dependency)

1. Start logged in, Page already connected. Caption: "The owner writes a post and approves it".
2. Click "Create Post". Select the Facebook Page avatar.
3. Type the test text. Click "Insert Media" and add one photo.
4. Click "Add comment" and type "First comment from Tidepost: please ignore". Caption: "pages_manage_engagement: a first comment the owner wrote".
5. Click "Post now". Caption: "pages_manage_posts: Tidepost publishes the approved post to the Page".
6. Show the post in the calendar with its status.
7. Open the Page on facebook.com in the same window. Show the post and the comment underneath, posted as the Page. Caption: "The post and first comment are live on the Page".
8. (Optional, 20 seconds) Open "Weekly posts", show a drafted post, click Approve. Caption: "Normally posts come from the weekly plan. Nothing is published until the owner approves it".

## Video 3: Showing results
**Attach to:** `pages_read_engagement`, `read_insights`

Record at least an hour after video 2 (insights take time; the app rechecks after an hour).

1. Start logged in. Caption: "The owner checks how their posts did".
2. Open the published post in the calendar ("Preview"), click "Statistics". Caption: "read_insights and pages_read_engagement: reach and engagement for this post".
3. Click "What worked" in the left menu. Show the latest results with reach and interactions for the Facebook post. Caption: "Results are shown only to this business's account".

## Video 4: Instagram via Facebook Login
**Attach to:** `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights` (and again to `pages_show_list`, `pages_read_engagement`, `business_management` as the Instagram dependency)

1. Start logged in. Click "Add Channel", then "Instagram (Facebook Business)". Caption: "The owner connects the Instagram account linked to their Page".
2. Go through Facebook Login and allow. Choose the Instagram account. Caption: "instagram_basic: username and picture to confirm the account. Found through the linked Page (pages_show_list, pages_read_engagement, business_management)".
3. Click "Create Post", select the Instagram avatar, add a photo, a caption, and "Add comment" with a comment.
4. Click "Post now". Caption: "instagram_content_publish and instagram_manage_comments: the approved post and its first comment".
5. Open the account on instagram.com, show the post and comment.
6. (After an hour, can be a cut) Back in Tidepost: post "Statistics", then "What worked". Caption: "instagram_manage_insights: results for this post".

## Narration (optional)

Meta does not require narration. If Calvin wants it, read the captions aloud. Plain British English, no claims beyond what is on screen.
