# AGPL_COMPLIANCE.md

How Kanosena complies with the GNU Affero General Public License v3 that upstream Postiz is released under. This is a working checklist, **not legal advice**. The last section lists what a lawyer should confirm before launch.

- Upstream: https://github.com/gitroomhq/postiz-app, licence **AGPL-3.0** (`LICENSE`, and `"license": "AGPL-3.0"` in `package.json`).
- Our fork: https://github.com/calvin22580/postiz-app (public).
- Based on upstream release **v2.26.0**.

## Why AGPL matters for a hosted service

Section 13 of the AGPL says that if we run a modified version and users interact with it over a network, we must offer those users the **Corresponding Source** of the version they are using, free of charge. Our customers use Kanosena in a browser, so this applies to every customer. It is the main obligation beyond keeping notices.

## What we do

Status key: ✅ in place · ⬜ to do before launch. Items marked "(1a)" were delivered by Milestone 1a.

### Licence and notices
- ✅ Keep the upstream `LICENSE` file unchanged at the repo root.
- ✅ Keep `"license": "AGPL-3.0"` in `package.json` and `apps/sdk/package.json`.
- ✅ Keep upstream's copyright and licence notices. Upstream source files carry no per-file headers (checked 15/11/2026), so the notices to keep are `LICENSE`, the README licence section and any notice shown in the app.
- ✅ (1a) The rebrand keeps any legal, copyright or licence notice the app already displays, even where it names Postiz (`FORK_RULES.md`, "Licence and branding").
- ⬜ Add a short "Based on Postiz, © Gitroom, AGPL-3.0" credit and a link to `LICENSE` in our repo `README.md` and on an About or Legal page in the app. Not strictly required beyond the kept notices, but it is the clearest way to give "appropriate legal notices".

### Offering the source (section 13)
- ✅ The fork is a public GitHub repository.
- ✅ (1a) A **"Source code" link in the app footer** (`apps/frontend/src/ours/brand/footer.tsx`), pointing at `sourceCodeUrl` in `brand.defaults.json` (https://github.com/calvin22580/postiz-app). It is visible on every logged-in page.
- ⬜ Make the link point at the **exact version running**: a tag or commit for each deployed release (for example `.../tree/<git-sha>`, or a `NEXT_PUBLIC_VERSION`-style variable filled in at build time). A link to `main` is weaker if production lags behind.
- ⬜ Deploy only from commits that are pushed to the public repo. Never run production from unpushed local changes or a private branch.
- ⬜ Nothing needed to build and run our version may be kept private, except secrets and config values (API keys, `.env`). Our own modules, Docker files and build scripts all go in the public repo.

### Marking what we changed (section 5a)
AGPL section 5(a) requires modified files to "carry prominent notices stating that you modified it, and giving a relevant date".
- ✅ Rule in place: every upstream file we touch carries an `OURS (YYYY-MM-DD): <reason>` comment (`FORK_RULES.md`, additive-only rule 2).
- ✅ `UPSTREAM_PATCHES.md` lists every modified upstream file, with the date and reason. Current entry: `CLAUDE.md`.
- ✅ (1a) The rebrand and sandbox edits are listed in `UPSTREAM_PATCHES.md`, each with an `OURS` marker.
- ✅ Our new files are clearly ours by location (our own directories), and are released under AGPL-3.0 with the rest of the work.
- ⬜ Add a line to our `README.md` stating that this is a modified version of Postiz and pointing at `UPSTREAM_PATCHES.md`.

### Trademarks and third parties
- ✅ (1a) No Postiz name, logo or trademark where customers can see it (AGPL grants no trademark rights).
- ✅ (1a) Upstream's links to **postiz.com/terms** and **postiz.com/privacy** in `register.tsx` are rewritten at build time to our own pages (`/terms.html`, `/privacy.html`, see `ours/README.md` "Legal pages"). ⬜ They are drafts with `[FILL IN]` company details, awaiting a solicitor's review. ⬜ Other `postiz.com` links (affiliate in `top.menu.tsx`, `docs.postiz.com`, `api.postiz.com` in `apps/sdk`) should also be removed or replaced.
- ✅ Never use Postiz's API keys, developer apps or paid services (`FORK_RULES.md`). That includes the `ghcr.io/gitroomhq/postiz-app` Docker image: we build our own (see `DEPLOYMENT.md`).
- ⬜ Check the licences of optional third-party services before enabling them. In particular, **Polotno** (`NEXT_PUBLIC_POLOTNO`, the design editor) is a commercial SDK that needs our own licence key. Leave it unset until we have one.

### Contributor agreements
Upstream has `ICLA.md` and `CCLA.md`. They apply only if we **contribute back** to upstream. They do not restrict running our fork. If we ever send a pull request upstream, the person sending it needs to read and sign the relevant CLA first.

## What a lawyer should confirm before launch

1. That a footer "Source code" link to the public repository (pinned to the deployed commit) satisfies section 13's "prominently offer" requirement for our hosted service.
2. That the kept notices plus `UPSTREAM_PATCHES.md` and the `OURS` markers satisfy section 5(a), the "prominent notices" with a relevant date.
3. That our planned **customer content** (business profiles, generated captions, images) is not "Corresponding Source" and is unaffected by the AGPL. We believe it is user data, not code.
4. Whether **AI prompts and prompt templates** that ship in our code must be published. As part of the program they would be. Keep any truly confidential material out of the code, in config or the database.
5. How the AGPL interacts with any **proprietary third-party SDK or API** we add later (for example a paid image API). Calling a network API is generally fine. Linking a non-free library into the build may not be.
6. Trademark: that using "Postiz" only in legal and licence notices, and "based on Postiz" in the README, is acceptable nominative use under UK law.
7. That our customer **terms of service** correctly state the open-source licence of the software and that no warranty is implied by upstream (AGPL sections 15 and 16), while our own service terms can still offer our own commitments.
