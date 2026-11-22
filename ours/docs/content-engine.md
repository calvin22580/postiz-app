# Content engine: system map

The one place that describes every AI step that writes or checks posts, what it reads, and what it may change. Every content-engine milestone updates this file in the same pull request. If a change doesn't fit this map, change the map first, on purpose.

Design and reasoning: the "Kanosena content engine and brand memory: design" doc (21/11/2026). Milestones are E1 to E7 there.

## Principles

1. **Our code runs the steps; models do one job each.** The engine is a fixed workflow, not an open-ended agent loop. Anthropic's guidance is to start with the simplest tier that works, and to use autonomous agents only for open-ended work. Our steps are known in advance, and the fact check and approval must sit between them.
2. **Facts come only from the sourced business profile** (and our checked UK dates). Brand memory, results and owner signals change how we choose and phrase. They never add claims.
3. **Nothing is published without the owner's approval.** No AI step can reach the scheduler. Approval stays in `CaptionService.approve`.
4. **Every step follows the same shape:**
   - an adapter interface with an Anthropic version and a labelled demo version (like `CaptionWriter`), so the app and tests run with no key;
   - structured JSON output (`output_config.format`);
   - its own cost feature name, logged through `AiUsageService.logCall` against the organisation;
   - untrusted input (website text, owner notes) passed as data, never as instructions.
5. **The cheapest model that passes the test set.** Model choice is per step, set in one place, and only changed after a test-set comparison.
6. **Hard rules run last.** `groundCaptions` (numbers, links, handles, claim words) checks every caption after any AI check, whatever the AI said.
7. **Memory is shown to the owner.** Anything the engine learns can be seen, edited, switched off and erased.

## Steps

| Step | Status | Model | Reads | Writes | Cost feature |
| --- | --- | --- | --- | --- | --- |
| Profile reader | Live (M2) | `OURS_AI_MODEL` (Opus 5.5) | Website pages | Business profile, every claim with a source | `business_profile` |
| Week writer | Live (M3) | `OURS_AI_MODEL` (Opus 5.5) | Profile facts, UK dates, results preferences, brand brief (E4, when on) | Draft captions | `captions` |
| Rewriter | Live (M5) | `OURS_AI_MODEL` (Opus 5.5) | Profile facts, current caption, owner note, brand brief (E4, when on; the note wins) | One draft caption | `caption-rewrite` |
| Hard rules | Live (M3) | none (code) | Caption, facts | Keep or drop | none |
| Owner signals | Live (E1) | none (code) | Owner actions | `ours_brand_signal` | none |
| Checker | Built, off (E2) | `OURS_AI_CHECKER_MODEL` (Sonnet 5.5 until the test set decides) | Captions, profile facts, brand memory `avoid` and `phrases` lessons (E4, when on) | Pass, fix or drop per caption, before the hard rules | `caption-check` |
| Strategist | Planned (E3) | Opus 5.5 | Profile, brand brief, UK dates, results, recent themes | Week plan (ideas and facts) | `captions.plan` |
| Writer | Planned (E3) | Sonnet 5.5 | Week plan, brand brief, platform rules | Draft captions | `captions.write` |
| Memory keeper | Built, off (E4) | `OURS_AI_MEMORY_MODEL` (Haiku 5.5), Anthropic memory tool | Owner signals since its last run, current lessons | `ours_brand_memory`, only through `MemoryWorkspace`, which checks every change | `memory-update` |

## Entry points

Every way a post can start goes through the same steps above and ends waiting for the owner's approval in the app.

| Entry point | Status | Goes through | Notes |
| --- | --- | --- | --- |
| Weekly posts screen | Live | Week writer, Checker (when on), hard rules | |
| Rewrite on the review screen | Live (M5) | Rewriter, Checker (when on), hard rules | |
| Upstream public API, MCP and CLI | Live, limited | None of ours | `assertDirectPostingAllowed` keeps these to upstream drafts; they never reach our review screen |
| Claude or ChatGPT connector | Planned (E8) | Checker, hard rules; lands as a post waiting for approval | Our own small tool set: read the profile and this week's posts, add a post or idea. No tool can approve, schedule or publish. Exposing profile data through a connector needs a decision first |

## Data

- `ours_business_profile`: the only source of facts.
- `ours_caption_week` / `ours_caption_draft`: the week and its drafts. `rejectReason` holds the owner's latest reason.
- `ours_brand_signal` (E1): an append-only log of owner actions, written by code, never by AI. Kinds:
  - `approved`: the scheduled text, and whether the owner had changed it (`edited`);
  - `edited`: the text before and after the owner's own change;
  - `rejected`: the text that was rejected;
  - `reject-reason`: the one-tap reason (`topic`, `tone`, `untrue`, `salesy`, `other`);
  - `restored`: a rejected post brought back;
  - `rewrite`: the text before, the new version (empty if none could be kept), and the owner's note.
  Recording a signal never blocks the owner's action: a failure is logged only. Signals are erased with the organisation.
- `ours_brand_memory` (E4): lessons about how the owner likes posts written and chosen, one row per memory-tool file (`/memories/{voice,phrases,likes,topics,avoid}/<name>.md`). Each cites the signals behind it (`evidence`, `against`: first 8 characters of signal ids). Our code sets the status: evidence minus against of 2 or more is `active` (used in the brief), 1 `tentative`, 0 or less `retired`. At most 30 lessons of 200 characters. `source` owner means the owner wrote or edited it, and the keeper can't change it; `offAt` means the owner switched it off, and it can't come back. Erased with the organisation.
- `ours_brand_memory_run` (E4): one row per keeper run: the newest signal covered (the next run starts after it), what changed, what was refused and why.
- Brand memory (E4) runs only with `OURS_BRAND_MEMORY=true`. Before a week is written, the keeper runs if there are new signals (Haiku 5.5, memory tool, at most 10 turns, `OURS_MEMORY_KEEPER=plain` swaps in the single-call version for comparison; the labelled demo keeper runs without an AI key). `MemoryWorkspace` refuses paths outside the folders, lessons without real evidence, business details (the caption hard rules plus fact patterns), switched-off lessons and changes to owner lessons; refusals go back to the keeper as tool errors. Accepted changes are saved only when the run ends. If the run fails, writing goes ahead with the lessons as they were. Rewrites read the brief but never run the keeper. The brief is a preference for wording and choice of post, never a source of claims; the Checker and hard rules still check every claim against the profile.
- The Checker (E2) runs only with `OURS_CAPTION_CHECKER=true`, after the writer and the rewriter. One call checks a whole week. A fixed caption still goes through the hard rules. If the check call fails, the captions go on to the hard rules unchanged and the failure is logged: the hard rules and the owner's approval still apply.
- `ours_ai_usage`: one row per AI call. `ours/scripts/ai-cost-summary.mjs` prints cost per step.

## Adding or changing a step

1. Re-read the Anthropic docs below that apply.
2. Write the plan: what the step reads, what it may write, which model, how it is tested, and what it costs.
3. Fit it to the shape in principle 4 and add it to the table above.
4. Compare on the test set before switching a model or adding a step (from E2).

## Anthropic docs to re-read before each milestone

- Choosing a surface, and when to use an agent: Claude API skill, "Which Surface Should I Use?"
- Agent design (tool surface, context, caching): https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
- Memory tool (E4): https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- Managed Agents, for any future long-running research agent: https://platform.claude.com/docs/en/managed-agents/overview and https://platform.claude.com/docs/en/managed-agents/memory
- Structured outputs and prompt caching: https://platform.claude.com/docs/en/build-with-claude/structured-outputs and https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Pricing: https://platform.claude.com/docs/en/about-claude/pricing
