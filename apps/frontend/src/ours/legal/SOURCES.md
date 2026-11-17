# Legal pages: sources and open points

The privacy policy, terms of service and data deletion page in this folder are
drafts written on 15/11/2026. **A solicitor should review them before launch.**
They are not legal advice.

Pages: `/privacy.html`, `/terms.html`, `/data-deletion.html` (routes in
`apps/frontend/src/app/(legal)/`). Company facts come from `legal.ts`
(`legal.defaults.json`, overridable by `NEXT_PUBLIC_LEGAL_*`). Anything not yet
known is printed as a visible `[FILL IN: ...]` marker, and a "Draft" notice
shows until every fact is set and `NEXT_PUBLIC_LEGAL_REVIEWED=true`.

## What each requirement asks for, and where it is met

| Requirement | Source (checked 15/11/2026) | Where |
|---|---|---|
| Privacy policy at a public, crawlable, non-geoblocked URL, clearly a privacy policy, entered in the App Dashboard | [Meta Platform Terms](https://developers.facebook.com/terms) s.4.a (last updated 03/02/2026); [Meta privacy policy expectations](https://developers.facebook.com/docs/development/terms-and-policies/privacy-policy/) | `/privacy.html`, a top-level `.html` path the frontend proxy never redirects, so signed-out visitors and crawlers get a 200 |
| Policy explains what data is processed, how, and how users request deletion; the right is open to all users | Meta Platform Terms s.4.b–c | Privacy policy s.2, 3, 5 and the deletion link; `/data-deletion.html` |
| An easily accessible, clearly marked way to request deletion; delete promptly on request, account closure, or when no longer needed | Meta Platform Terms s.3.d.i | `/data-deletion.html`; privacy policy s.5 and s.8 |
| Data deletion callback **or** an instructions URL in App Settings | [Meta data deletion callback](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback); [Meta, user data deletion requests (15/11/2024)](https://developers.facebook.com/blog/post/2024/11/15/user-data-deletion-requests/) | Instructions URL `/data-deletion.html`. No callback is built (upstream has none) |
| No selling, profiling without consent, eligibility decisions, or use beyond permitted purposes | Meta Platform Terms s.3.a | Privacy policy s.5 |
| App has its own user agreement and privacy policy, prominently placed; describes collection, use, sharing, storage and deletion, including user-directed deletion; at least as protective as LinkedIn's | [LinkedIn API Terms of Use](https://developer.linkedin.com/legal/api-terms-of-use) s.5.1 (revised 13/12/2022) | Both pages, linked from sign-up and from each other |
| Tell users that you, not LinkedIn, support them | LinkedIn API Terms s.8.1 | Terms s.5 |
| Pre-filled content: notice that it is covered by the privacy policy, and users can edit it | LinkedIn API Terms s.3.1(4) | Privacy policy s.4; terms s.4 |
| Delete API content immediately when a user asks or closes their account | LinkedIn API Terms s.4.4 | Data deletion page ("as soon as we have confirmed the request") |
| Encryption of personal information in transit and at rest | LinkedIn API Terms s.7.1(a) | Privacy policy s.12 (at rest: PlanetScale and Cloudflare R2 both encrypt with AES, checked 17/11/2026) |
| AI: say users are dealing with AI, output may be inaccurate, whether data trains AI or goes to third parties, how to report harmful output; users can edit before publishing | [LinkedIn developer AI policy](https://learn.microsoft.com/en-us/linkedin/marketing/developer-ai-policy) s.III | Privacy policy s.4; terms s.4 |
| LinkedIn data only to manage the connected Pages or profiles; not combined, exported or shown to others | [LinkedIn restricted uses](https://learn.microsoft.com/en-us/linkedin/marketing/restricted-use-cases) | Privacy policy s.5 |
| UK GDPR Articles 13 and 14: identity, contact, purposes and lawful basis, legitimate interests, recipients, transfers, retention, rights, complaint to the ICO, automated decisions | [ICO: what privacy information should we provide?](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide) | Privacy policy s.1–13 |
| Complaints to the controller: accept them, acknowledge within 30 days, say so in privacy notices (in force 19/06/2026) | Data (Use and Access) Act 2025, summarised by [CMS](https://cms.law/en/gbr/legal-updates/data-use-and-access-act-2025-new-statutory-rules-on-handling-data-protection-complaints-from-19th-june-2026) | Privacy policy s.10 |
| Processor terms where customers put others' personal data in | UK GDPR Article 28(3) | Terms s.10 |

## Facts checked in the code

- Stored at sign-up and sign-in: IP address, browser type, last online (`User.ip`, `User.agent`, `User.lastOnline` in upstream's schema).
- Sign-up source: `UtmSaver` and `attribution.component.tsx` keep landing page, referrer and campaign tag in local storage and send them at sign-up.
- Cookies: `auth` (1 year), `showorg` (1 year), `org` (2 days), `impersonate` (staff only), `i18next` (language).
- Channel tokens are encrypted at rest when `ENCRYPTION_KEY` is set (DEPLOYMENT.md says to set it).
- Upstream's `deleteChannel` and organisation/user deletes are **soft deletes**: rows and tokens stay in the database. See "Before launch" below.
- Optional trackers in upstream's root layout (Plausible, Dub, Facebook pixel, Google Tag Manager, Datafast) are all off unless their environment variables are set. Note that Plausible and Dub switch on whenever `STRIPE_PUBLISHABLE_KEY` is set.

## Before launch (not done in this change)

1. Fill in every `[FILL IN]` marker, then set `NEXT_PUBLIC_LEGAL_REVIEWED=true` after the solicitor's review.
2. Deletion must really happen. Today an emailed request has to be carried out by hand in the database, because upstream soft-deletes. A proper hard-delete job (account, profile, media, tokens) would make the promises in these pages easy to keep.
3. Disconnecting a channel keeps its token (soft delete). LinkedIn's terms say to keep content only as long as necessary. Consider clearing tokens on disconnect.
4. LinkedIn's Data Storage Requirements limit how long member profile data (24 hours) and social activity (48 hours) may be cached. Check what upstream stores for LinkedIn channels before the LinkedIn review.
5. Before billing (Milestone 7): add the payment provider to the policy, and decide on analytics consent, because `STRIPE_PUBLISHABLE_KEY` turns on Plausible and Dub.
6. Sign LinkedIn's Data Processing Agreement (API Terms s.4.6) and check the AI provider's terms meet LinkedIn's AI policy s.V.
7. Consider an online complaint form as well as email (DUAA 2025 asks controllers to make complaining easy).
