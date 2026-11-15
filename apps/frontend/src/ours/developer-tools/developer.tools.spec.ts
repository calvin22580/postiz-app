import { afterEach, describe, expect, it } from 'vitest';
import {
  customerSettingsTabs,
  showDeveloperTools,
} from './developer.tools';

// The tab list upstream's settings screen builds for a full-access admin.
const upstreamTabs = [
  'global_settings',
  'agents',
  'teams',
  'webhooks',
  'autopost',
  'sets',
  'signatures',
  'integrations',
  'plugs',
  'apps',
].map((tab) => ({ tab, label: tab }));

describe('developer tools flag', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SHOW_DEVELOPER_TOOLS;
  });

  it('hides Agents / Dev from customers by default, keeping Apps (Approved Apps)', () => {
    expect(showDeveloperTools()).toBe(false);
    expect(customerSettingsTabs(upstreamTabs).map((t) => t.tab)).toEqual([
      'global_settings',
      'teams',
      'webhooks',
      'autopost',
      'sets',
      'signatures',
      'integrations',
      'plugs',
      'apps',
    ]);
  });

  it('shows them again with NEXT_PUBLIC_SHOW_DEVELOPER_TOOLS=true', () => {
    process.env.NEXT_PUBLIC_SHOW_DEVELOPER_TOOLS = 'true';
    expect(showDeveloperTools()).toBe(true);
    expect(customerSettingsTabs(upstreamTabs)).toEqual(upstreamTabs);
  });

  it('treats anything other than "true" as off', () => {
    process.env.NEXT_PUBLIC_SHOW_DEVELOPER_TOOLS = '1';
    expect(showDeveloperTools()).toBe(false);
  });
});
