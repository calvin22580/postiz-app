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
| Week writer | Live (M3) | `OURS_AI_MODEL` (Opus 5.5) | Profile facts, UK dates, results preferences | Draft captions | `captions` |
| Rewriter | Live (M5) | `OURS_AI_MODEL` (Opus 5.5) | Profile facts, current caption, owner note | One draft caption | `caption-rewrite` |
| Hard rules | Live (M3) | none (code) | Caption, facts | Keep or drop | none |
| Owner signals | Live (E1) | none (code) | Owner actions | `ours_brand_signal` | none |
| Checker | Planned (E2) | Sonnet 5.5 | Caption, facts, brand "avoid" list | Pass, fix or drop per caption | `captions.check` |
| Strategist | Planned (E3) | Opus 5.5 | Profile, brand brief, UK dates, results, recent themes | Week plan (ideas and facts) | `captions.plan` |
| Writer | Planned (E3) | Sonnet 5.5 | Week plan, brand brief, platform rules | Draft captions | `captions.write` |
| Memory keeper | Planned (E4) | Haiku 5.5, Anthropic memory tool | New owner signals, current memory | `ours_brand_memory`, through our checked tool handler | `memory.update` |

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
- `ours_brand_memory` (planned, E4): lessons about voice and preferences, each citing the signals behind it.
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
