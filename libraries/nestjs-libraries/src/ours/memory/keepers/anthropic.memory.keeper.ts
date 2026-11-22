// OURS: content engine E4. The Memory keeper on Anthropic's memory tool
// (memory_20250818): Claude keeps its lessons as files in /memories, and our
// handler (MemoryWorkspace) runs and checks every command. One bounded tool
// loop through the SDK's tool runner; our code decides when it runs.
// Docs: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
import Anthropic from '@anthropic-ai/sdk';
import { betaMemoryTool } from '@anthropic-ai/sdk/helpers/beta/memory';
import { Logger } from '@nestjs/common';
import { AiCallUsage } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import { memoryToolHandlers } from '@gitroom/nestjs-libraries/ours/memory/brand.memory.workspace';
import { usagesFrom } from '@gitroom/nestjs-libraries/ours/profile/extractors/anthropic.profile.extractor';
import {
  buildKeeperMessage,
  KEEPER_SYSTEM_PROMPT,
  MemoryKeeper,
  MemoryKeeperError,
  MemoryKeeperInput,
  MemoryKeeperOutput,
  memoryModel,
} from '@gitroom/nestjs-libraries/ours/memory/keepers/memory.keeper';

// at most this many requests in one run: view, a few edits, and a last reply
export const MAX_KEEPER_TURNS = 10;

type MessagesClient = Pick<Anthropic, 'beta'>;

export class AnthropicMemoryKeeper implements MemoryKeeper {
  readonly name = 'anthropic' as const;
  private _logger = new Logger(AnthropicMemoryKeeper.name);

  constructor(
    private _client: MessagesClient = new Anthropic(),
    private _model = memoryModel()
  ) {}

  async keep(input: MemoryKeeperInput): Promise<MemoryKeeperOutput> {
    if (!input.signals.length) return { summary: 'Nothing new to learn.', usages: [] };
    const usages: AiCallUsage[] = [];
    let last: Anthropic.Beta.BetaMessage | undefined;
    try {
      const runner = this._client.beta.messages.toolRunner({
        model: this._model,
        max_tokens: 4000,
        max_iterations: MAX_KEEPER_TURNS,
        // send the whole (short) conversation each turn, nothing kept at Anthropic
        thread: false,
        system: [{ type: 'text', text: KEEPER_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: [betaMemoryTool(memoryToolHandlers(input.workspace))],
        messages: [{ role: 'user', content: buildKeeperMessage(input.signals) }],
      });
      for await (const message of runner) {
        usages.push(...usagesFrom(message));
        last = message;
      }
    } catch (e) {
      if (e instanceof Anthropic.APIError) {
        this._logger.error(`Memory keeper failed (${e.status ?? 'network'}): ${e.message}`);
        throw new MemoryKeeperError(`The memory update failed (${e.status ?? 'network'}).`, usages);
      }
      throw e;
    }
    if (last?.stop_reason === 'refusal') {
      throw new MemoryKeeperError('The memory update stopped early (refusal).', usages);
    }
    const summary = (last?.content || [])
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .trim();
    return { summary: summary || (last?.stop_reason === 'tool_use' ? 'Stopped after the most turns allowed.' : ''), usages };
  }
}
