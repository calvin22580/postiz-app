// OURS: post-settings validation entries for our providers. The Sandbox
// channel has no settings of its own (like upstream's telegram or vk).
// Spread into upstream's allProviders() by one marked line.
export const oursProviderSettings = (setEmpty?: any) => [
  { value: setEmpty, name: 'sandbox' },
];
