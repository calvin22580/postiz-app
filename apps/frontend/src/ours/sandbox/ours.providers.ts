// OURS: our extra post-editor providers, spread into upstream's Providers list.
import SandboxProvider from '@gitroom/frontend/ours/sandbox/sandbox.provider';

export const OursProviders = [
  {
    identifier: 'sandbox',
    component: SandboxProvider,
  },
];
