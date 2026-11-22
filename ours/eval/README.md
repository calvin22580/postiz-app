# ours/eval: test sets for the content engine

Before an AI step is added to the content engine or its model changes, it is
measured on a fixed, labelled test set (`ours/docs/content-engine.md`,
"Adding or changing a step"). Results stay on your machine (`runs/` is not
committed).

## The Checker (E2)

`checker/sets/<name>/cases.json` holds:

- `profiles`: each business's profile facts (`id`, `field`, `value`), saved as files so a run never depends on a live website;
- `cases`: one caption each, with its profile and platform, labelled `true` (every claim is in the profile) or `invented` with the one detail that isn't. Optional `tags` group cases in the results (for example `missed-by-rules`).

`checker/sets/sample` is a six-caption made-up sample for checking that the runner works. `checker/sets/personas` is the E2 test set: 66 posts for three fictional businesses from the Codex persona test (21/11/2026), 46 of them written by the app and 20 with planted mistakes. Invented details are graded clear (scored), borderline or timing (reported only); posts relabelled after review carry the `relabelled` tag. Each Codex post has `postsAt`, its posting day and time, which the app also gives the Checker.

Run from the repo root:

```
ours/eval/checker/run.sh --set sample --models demo
ANTHROPIC_API_KEY=… ours/eval/checker/run.sh --set <name> --models claude-haiku-5-5,claude-sonnet-5-5,claude-opus-5-5 --reps 2
```

- `--models`: comma-separated model ids, or `demo` (free, passes everything).
- `--reps`: runs per model (default 1). Two runs show how much results vary.
- `--limit N`: only the first N captions, for a pilot.

`run.sh` bundles the runner with the esbuild that is already in `node_modules` (installed with upstream's dependencies, not added by us), so it needs no new package.

Each run calls the real Checker, with a whole profile's captions (up to 12) in one call, as the app does for a written week. Today's hard rules (`unsupportedDetails`) are scored on the same captions for comparison, at no cost.

The run prints, and writes to `runs/<time>-<set>/summary.md`:

- **Mistakes caught**: share of `invented` captions the step fixed or dropped;
- **True posts kept**: share of `true` captions passed unchanged;
- **Fixes passing the hard rules**: a fix that still fails them would be dropped in the app;
- **Cost**: from each call's token usage and `ours/ai/ai.pricing.ts`.

Per-caption rows (verdict, claims, fixed text) are in `runs/<time>-<set>/<model>.results.jsonl`. Paid runs spend from the Anthropic budget: run a `--limit 10` pilot first and check its cost.

## The Memory keeper (E4)

`ours/eval/memory/run.sh` runs the Memory keeper over scripted owner histories and scores what it learned. Each business in `sets/personas/history.json` has four weeks of owner actions (E1 signals) with planted habits (removes exclamation marks, rejects salesy posts, says "pop in"), and traps:

- one-off actions that must stay tentative;
- edits that add a new fact ("now open Sundays", "20 years in the trade"), which must never be stored;
- a lesson the owner switches off before week 2, which must not come back;
- a rewrite note that tries to give the keeper instructions.

The runner calls the real keepers through the same checked workspace as the app, one week at a time, carrying lessons forward. Scores: habits found as active lessons (bar 80%), wrong lessons per business (at most 1), one-offs promoted, facts stored and switched-off lessons back (all 0). Habits are matched by keywords, so read the final lessons in `<keeper>.results.jsonl` too.

```
ours/eval/memory/run.sh --keepers demo                              # free, checks the plumbing
ANTHROPIC_API_KEY=… ours/eval/memory/run.sh --keepers memory-tool,plain --reps 3
ANTHROPIC_API_KEY=… ours/eval/memory/run.sh --keepers memory-tool --model claude-sonnet-5-5
```

`sets/hard/history.json` (built by `node ours/eval/memory/sets/hard/build.mjs`) is harder: eight weeks per business, habits that only hold on one platform (hashtags on Instagram only, no emoji on LinkedIn), an owner who changes their mind (adds a sign-off, then takes it out; turns cake posts down, then brings them back), signals that point both ways (must not become a lesson), facts slipped into edits, a lesson switched off before week 4, and rewrite notes that try to give orders. Run it with `--set hard`. The first set got too easy once the keepers were fixed (both found every habit), so keepers are compared on this one.

`memory-tool` is the app's keeper (Anthropic's memory tool); `plain` is the single-call version it is compared with. A full comparison (2 keepers, 3 businesses, 4 weeks, 3 runs on Haiku 5.5) is about 72 keeper runs and should cost well under $1. The demo keeper only knows two rules, so its low score is expected.
