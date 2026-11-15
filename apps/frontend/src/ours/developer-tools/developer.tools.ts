// OURS: upstream's developer screens (Agents / Dev, the developer half of
// Apps, the "Connect Agents" onboarding step, the Developers link) point
// customers at upstream's own docs, CLI, MCP server and connectors. They are
// hidden unless NEXT_PUBLIC_SHOW_DEVELOPER_TOOLS=true. Nothing is deleted, and
// the backend public API is unchanged.

export const showDeveloperTools = () =>
  process.env.NEXT_PUBLIC_SHOW_DEVELOPER_TOOLS === 'true';

// Settings tabs that belong to the developer tools. "Apps" stays: without
// developer tools it shows only Approved Apps, where customers revoke apps
// they have authorised.
const developerTabs = ['agents'];

export const customerSettingsTabs = <T extends { tab: string }>(tabs: T[]) =>
  showDeveloperTools()
    ? tabs
    : tabs.filter((item) => !developerTabs.includes(item.tab));
