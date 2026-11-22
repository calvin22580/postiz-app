// OURS: content engine E4. The Memory keeper on a Claude Managed Agents memory
// store, for the test-set comparison. Anthropic hosts the lessons (versioned,
// with redact and rollback) and runs the agent; the agent reads and writes the
// store mounted as a folder, with file tools only. Unlike the memory tool
// version, nothing checks a write as it happens: after the session our code
// reads the store and applies each changed lesson through the same checked
// workspace, so refused lessons never reach Kanosena's copy (and the store is
// put back in line with it before the next run).
// Docs: https://platform.claude.com/docs/en/managed-agents/memory
import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import { AiCallUsage } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import { formatLessonFile, MEMORY_ROOT } from '@gitroom/nestjs-libraries/ours/memory/brand.memory';
import { MemoryRefusedError, MemoryWorkspace } from '@gitroom/nestjs-libraries/ours/memory/brand.memory.workspace';
import {
  buildKeeperMessage,
  KEEPER_SYSTEM_PROMPT,
  MemoryKeeper,
  MemoryKeeperError,
  MemoryKeeperInput,
  MemoryKeeperOutput,
  memoryModel,
} from '@gitroom/nestjs-libraries/ours/memory/keepers/memory.keeper';

const STORE_NAME = 'brand memory';
// the store's folder in the session: the name lower-cased, other characters as hyphens
export const MANAGED_MOUNT = '/mnt/memory/brand-memory';
// a hard cap on one session's spend (US cents, list price)
const SESSION_BUDGET_CENTS = '25';
// session running time is priced on top of tokens
const RUNTIME_USD_PER_HOUR = 0.08;

// The memory tool prompt, with the store's folder in place of /memories and
// file tools in place of the memory tool's commands.
export const MANAGED_SYSTEM_PROMPT = KEEPER_SYSTEM_PROMPT.split(MEMORY_ROOT).join(MANAGED_MOUNT)
  .replace(
    'Kanosena adds a status line when you view a file. You can\'t change it:',
    'Some files have a status line written by Kanosena. Leave it out when you write a file; it is worked out again:'
  )
  .replace('1. Look at your memory first.', `1. Look at your memory first: list ${MANAGED_MOUNT} and read the lesson files.`)
  .replace(
    '6. If a change is refused, read the reason, then fix the lesson or leave it out.',
    '6. To remove a lesson, write its file with nothing in it. Kanosena checks every lesson after you finish and drops any that break these rules.'
  );

type ManagedClient = Pick<Anthropic, 'beta'>;

// Agent and environment are made once and reused (the docs: create once,
// reference by id). Set OURS_MEMORY_AGENT_ID and OURS_MEMORY_ENVIRONMENT_ID to
// reuse ones made earlier; otherwise the first run makes them.
let shared: Promise<{ agentId: string; environmentId: string }> | undefined;

export class ManagedMemoryKeeper implements MemoryKeeper {
  readonly name = 'managed' as const;
  private _logger = new Logger(ManagedMemoryKeeper.name);
  private _storeId?: string;

  constructor(
    private _client: ManagedClient = new Anthropic(),
    private _model = memoryModel()
  ) {}

  private setup() {
    if (process.env.OURS_MEMORY_AGENT_ID && process.env.OURS_MEMORY_ENVIRONMENT_ID) {
      return Promise.resolve({ agentId: process.env.OURS_MEMORY_AGENT_ID, environmentId: process.env.OURS_MEMORY_ENVIRONMENT_ID });
    }
    shared ||= (async () => {
      const environment = await this._client.beta.environments.create({
        name: 'Kanosena memory keeper',
        // the agent needs no network: only the mounted store
        config: { type: 'cloud', networking: { type: 'limited', allow_package_managers: false, allow_mcp_servers: false } },
      });
      const agent = await this._client.beta.agents.create({
        name: 'Kanosena memory keeper',
        model: this._model,
        system: MANAGED_SYSTEM_PROMPT,
        tools: [
          {
            type: 'agent_toolset_20260401',
            // file tools only; the sandbox holds nothing but the store
            default_config: { enabled: false },
            configs: ['read', 'write', 'edit', 'glob', 'grep'].map((name) => ({
              name: name as 'read',
              enabled: true,
              permission_policy: { type: 'always_allow' as const },
            })),
          },
        ],
      });
      return { agentId: agent.id, environmentId: environment.id };
    })();
    return shared;
  }

  private async store() {
    this._storeId ||= (
      await this._client.beta.memoryStores.create({
        name: STORE_NAME,
        description: "Lessons about how one small business's owner likes their social media posts written and chosen. One lesson per file.",
      })
    ).id;
    return this._storeId;
  }

  // The store's files, by path inside the store ("/voice/short.md").
  private async files(storeId: string) {
    const out = new Map<string, { id: string; content: string }>();
    for await (const m of this._client.beta.memoryStores.memories.list(storeId, { path_prefix: '/', view: 'full' })) {
      if (m.type === 'memory') out.set(m.path, { id: m.id, content: m.content || '' });
    }
    return out;
  }

  // Makes the store hold exactly Kanosena's lessons, as the agent should see them.
  private async sync(storeId: string, workspace: MemoryWorkspace) {
    const want = new Map(workspace.lessons().map((l) => [l.path.slice(MEMORY_ROOT.length), formatLessonFile(l)]));
    const have = await this.files(storeId);
    for (const [p, f] of have) {
      if (!want.has(p)) await this._client.beta.memoryStores.memories.delete(f.id, { memory_store_id: storeId });
    }
    for (const [p, content] of want) {
      const f = have.get(p);
      if (!f) await this._client.beta.memoryStores.memories.create(storeId, { path: p, content });
      else if (f.content !== content) await this._client.beta.memoryStores.memories.update(f.id, { memory_store_id: storeId, content });
    }
    return want;
  }

  async keep(input: MemoryKeeperInput): Promise<MemoryKeeperOutput> {
    if (!input.signals.length) return { summary: 'Nothing new to learn.', usages: [] };
    const usages: AiCallUsage[] = [];
    let summary = '';
    let activeSeconds = 0;
    let sessionId: string | undefined;
    try {
      const { agentId, environmentId } = await this.setup();
      const storeId = await this.store();
      const before = await this.sync(storeId, input.workspace);
      const session = await this._client.beta.sessions.create({
        agent: agentId,
        environment_id: environmentId,
        title: 'Brand memory update',
        budget: { type: 'limit', max_list_cost: { amount: SESSION_BUDGET_CENTS, currency: 'USD' } },
        resources: [
          {
            type: 'memory_store',
            memory_store_id: storeId,
            access: 'read_write',
            instructions: 'The brand memory you keep. Every lesson file lives here.',
          },
        ],
      });
      sessionId = session.id;
      const stream = await this._client.beta.sessions.events.stream(session.id);
      await this._client.beta.sessions.events.send(session.id, {
        events: [{ type: 'user.message', content: [{ type: 'text', text: buildKeeperMessage(input.signals, input.workspace.switchedOff()) }] }],
      });
      loop: for await (const event of stream) {
        switch (event.type) {
          case 'agent.message':
            summary = event.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim() || summary;
            break;
          case 'span.model_request_end':
            usages.push({
              provider: 'anthropic',
              model: this._model,
              inputTokens: event.model_usage.input_tokens || 0,
              outputTokens: event.model_usage.output_tokens || 0,
              cacheReadTokens: event.model_usage.cache_read_input_tokens || 0,
              cacheWriteTokens: event.model_usage.cache_creation_input_tokens || 0,
            });
            break;
          case 'session.status_idle':
            if (event.stop_reason.type !== 'requires_action') break loop;
            break;
          case 'session.status_terminated':
            break loop;
        }
      }
      activeSeconds = (await this._client.beta.sessions.retrieve(session.id)).usage?.active_seconds || 0;

      // Apply what the agent changed, through the checked workspace.
      const after = await this.files(storeId);
      for (const [p, f] of after) {
        if (before.get(p) === f.content) continue;
        try {
          if (!f.content.trim()) {
            if (before.has(p)) input.workspace.delete(MEMORY_ROOT + p);
          } else {
            input.workspace.create(MEMORY_ROOT + p, f.content);
          }
        } catch (e) {
          if (!(e instanceof MemoryRefusedError)) throw e;
        }
      }
      for (const p of before.keys()) {
        if (!after.has(p)) {
          try {
            input.workspace.delete(MEMORY_ROOT + p);
          } catch (e) {
            if (!(e instanceof MemoryRefusedError)) throw e;
          }
        }
      }
    } catch (e) {
      if (e instanceof Anthropic.APIError) {
        this._logger.error(`Memory keeper failed (${e.status ?? 'network'}): ${e.message}`);
        throw new MemoryKeeperError(`The memory update failed (${e.status ?? 'network'}).`, usages);
      }
      throw e;
    } finally {
      // the session is done with; deleting it stops its running time
      if (sessionId) await this._client.beta.sessions.delete(sessionId).catch(() => undefined);
    }
    return { summary, usages, extraCostUsd: (activeSeconds / 3600) * RUNTIME_USD_PER_HOUR };
  }

  // The test runner removes the store when a business is done.
  async dispose() {
    if (this._storeId) await this._client.beta.memoryStores.delete(this._storeId).catch(() => undefined);
  }
}
