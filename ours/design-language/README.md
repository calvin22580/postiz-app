# Kanosena design language: Story Mode

Chosen by Calvin on 20/11/2026 after six rounds of persona testing (see `ours/design-lab/`).

- `story-mode.html`: the full design language (principles, sticker K, colour, type, components, motion, voice, rollout). Open it in a browser.
- `tokens.css`: the design tokens. The homepage, the app theme and emails read from these values.

The rules that matter most:

1. Kanosena's stickers, highlights and scribbles never appear on a customer's post.
2. One violet button per decision. Edit always sits beside Approve. Approve is never red.
3. Every approved post says when it goes out, for example "Goes out Mon 23/11 at 07:30".
4. Fonts: Dela Gothic One (display), Instrument Sans (interface), Caveat (scribbles, four words at most). All SIL Open Font License.
5. Platform app icons keep the current teal K until Meta's app review is finished.

Where it lives:

- Homepage: `ours/site/public` (tokens copied into the page's `:root`).
- App: `apps/frontend/src/ours/brand`. `brand.defaults.json` sets the violet, `brand.style.tsx` restyles upstream's purple and adds the fonts and the `k-display`, `k-hand` and `k-sticker` classes our own screens use, `sticker.k.tsx` is the mark, and `brand.fonts.ts` loads the fonts. No upstream file changed for the theme.
