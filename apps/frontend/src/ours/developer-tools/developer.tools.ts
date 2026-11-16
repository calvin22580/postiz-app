// OURS: upstream's developer screens (Agents / Dev, Webhooks, the developer
// half of Apps, the "Connect Agents" onboarding step, the Developers link) and
// the upstream screens our own ones replace (Agent, Analytics, Billing) point
// customers at upstream's own docs, CLI, MCP server, OpenAI agent and USD
// pricing. They are hidden unless NEXT_PUBLIC_SHOW_DEVELOPER_TOOLS=true.
// Nothing is deleted, and the backend public API is unchanged.

export const showDeveloperTools = () =>
  process.env.NEXT_PUBLIC_SHOW_DEVELOPER_TOOLS === 'true';

// Settings tabs that belong to the developer tools. "Apps" stays: without
// developer tools it shows only Approved Apps, where customers revoke apps
// they have authorised.
const developerTabs = ['agents', 'webhooks'];

export const customerSettingsTabs = <T extends { tab: string }>(tabs: T[]) =>
  showDeveloperTools()
    ? tabs
    : tabs.filter((item) => !developerTabs.includes(item.tab));

// Upstream screens a customer could open from the menu or by typing the
// address, and where they go instead.
// - Agent needs an OpenAI key we don't use, and can't schedule since M8.
// - Analytics is replaced by "What worked" (/results).
// - Billing is upstream's USD Stripe screen; ours is "Plan and usage".
// - Affiliate is upstream's own affiliate programme.
const hiddenScreens: { path: string; to: string }[] = [
  { path: '/agents', to: '/launches' },
  { path: '/analytics', to: '/results' },
  { path: '/billing', to: '/plan' },
  { path: 'https://affiliate.postiz.com', to: '/launches' },
];

const matches = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

// Menu entries without the hidden screens. Used once in top.menu.tsx.
export const customerMenu = <T extends { path: string }>(items: T[]) =>
  showDeveloperTools()
    ? items
    : items.filter(
        (item) => !hiddenScreens.some((screen) => matches(item.path, screen.path))
      );

// Where to send someone who types the address of a hidden screen, or null.
// Used once in proxy.ts.
export const hiddenScreenRedirect = (pathname: string): string | null => {
  if (showDeveloperTools()) {
    return null;
  }
  return (
    hiddenScreens.find((screen) => matches(pathname, screen.path))?.to || null
  );
};
