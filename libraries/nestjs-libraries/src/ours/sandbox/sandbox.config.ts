// OURS: the Sandbox channel is off unless SANDBOX_CHANNEL_ENABLED is "true".
// It must be set for both the backend and the orchestrator (they share .env).
export const SANDBOX_IDENTIFIER = 'sandbox';

export const isSandboxEnabled = (env: NodeJS.ProcessEnv = process.env) =>
  (env.SANDBOX_CHANNEL_ENABLED || '').trim().toLowerCase() === 'true';

// Every name we store or show for a sandbox channel carries this prefix, so it
// can never be mistaken for a real platform account.
export const SANDBOX_LABEL = 'Sandbox';

export const sandboxDisplayName = (name: string) => {
  const clean = (name || '').trim() || 'Test channel';
  return clean.toLowerCase().startsWith(SANDBOX_LABEL.toLowerCase())
    ? clean
    : `${SANDBOX_LABEL} · ${clean}`;
};

// Milestone 8: every metric the Sandbox reports is labelled with this prefix.
// They are invented, so they must never be read as real results.
export const SIMULATED_PREFIX = 'Simulated ';

// Made-up but repeatable numbers for one Sandbox post: the same post always
// gets the same results. Spread roughly like a small business page's posts.
export const simulatedAnalytics = (postId: string, date: string) => {
  let seed = 0;
  for (const c of postId) {
    seed = (Math.imul(seed, 31) + c.charCodeAt(0)) >>> 0;
  }
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const reach = Math.round(40 + 360 * next() * next());
  const reactions = Math.round(reach * (0.01 + 0.07 * next()));
  const comments = Math.floor(5 * next() * next());
  const shares = Math.floor(4 * next() * next());
  return (
    [
      ['Reach', reach],
      ['Reactions', reactions],
      ['Comments', comments],
      ['Shares', shares],
    ] as const
  ).map(([label, total]) => ({
    label: `${SIMULATED_PREFIX}${label}`,
    data: [{ total: String(total), date }],
    percentageChange: 0,
  }));
};
