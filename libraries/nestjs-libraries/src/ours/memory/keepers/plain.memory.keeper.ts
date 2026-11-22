// OURS: content engine E4. The Memory keeper as one plain request, for the
// test-set comparison with the memory tool version: the model gets every
// current lesson and the new owner actions at once, and returns the changes
// as structured output. Our code applies them through the same checked
// workspace, so the two versions differ only in how the model works.
import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import { formatLessonFile } from '@gitroom/nestjs-libraries/ours/memory/brand.memory';
import { MemoryRefusedError } from '@gitroom/nestjs-libraries/ours/memory/brand.memory.workspace';
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

export const keeperChangesSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['changes', 'summary'],
  properties: {
    changes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'path', 'file'],
        properties: {
          action: { type: 'string', enum: ['save', 'delete'] },
          path: { type: 'string' },
          file: {
            type: 'string',
            description: 'For save: the whole lesson file (lesson, evidence and against lines). For delete: an empty string.',
          },
        },
      },
    },
    summary: { type: 'string', description: 'One short line saying what you changed.' },
  },
};

// The memory tool prompt, with the tool steps swapped for a list of changes.
const PLAIN_SYSTEM_PROMPT = KEEPER_SYSTEM_PROMPT.replace(
  '1. Look at your memory first.',
  '1. Your current memory is given to you in full.'
).replace(
  '7. When you are done, reply with one short line saying what you changed.',
  '7. Reply with the changes: "save" with the whole file to create or replace a lesson, "delete" to remove one. Leave out lessons that stay the same.'
).replace(
  '6. If a change is refused, read the reason, then fix the lesson or leave it out.\n',
  ''
).replace(/^7\./m, '6.');

type MessagesClient = Pick<Anthropic, 'beta'>;

export class PlainMemoryKeeper implements MemoryKeeper {
  readonly name = 'plain' as const;
  private _logger = new Logger(PlainMemoryKeeper.name);

  constructor(
    private _client: MessagesClient = new Anthropic(),
    private _model = memoryModel()
  ) {}

  async keep(input: MemoryKeeperInput): Promise<MemoryKeeperOutput> {
    if (!input.signals.length) return { summary: 'Nothing new to learn.', usages: [] };
    const memory = input.workspace.lessons();
    const current = memory.length
      ? memory.map((l) => `<file path="${l.path}">\n${formatLessonFile(l)}\n</file>`).join('\n')
      : '(empty)';
    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await this._client.beta.messages
        .stream({
          model: this._model,
          max_tokens: 4000,
          output_config: { format: { type: 'json_schema', schema: keeperChangesSchema } },
          system: [{ type: 'text', text: PLAIN_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [
            {
              role: 'user',
              content: `<memory>\n${current}\n</memory>\n\n${buildKeeperMessage(input.signals)}`,
            },
          ],
        })
        .finalMessage();
    } catch (e) {
      if (e instanceof Anthropic.APIError) {
        this._logger.error(`Memory keeper failed (${e.status ?? 'network'}): ${e.message}`);
        throw new MemoryKeeperError(`The memory update failed (${e.status ?? 'network'}).`);
      }
      throw e;
    }
    const usages = usagesFrom(message);
    if (message.stop_reason === 'refusal' || message.stop_reason === 'max_tokens') {
      throw new MemoryKeeperError(`The memory update stopped early (${message.stop_reason}).`, usages);
    }
    let parsed: { changes?: { action: string; path: string; file: string }[]; summary?: string };
    try {
      parsed = JSON.parse(
        message.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('')
      );
    } catch {
      throw new MemoryKeeperError('The memory update returned something we could not read.', usages);
    }
    for (const change of parsed.changes || []) {
      try {
        if (change.action === 'delete') input.workspace.delete(change.path);
        else input.workspace.create(change.path, change.file);
      } catch (e) {
        // refused: already recorded on the workspace
        if (!(e instanceof MemoryRefusedError)) throw e;
      }
    }
    return { summary: String(parsed.summary || ''), usages };
  }
}
