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
