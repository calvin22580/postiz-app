import { afterEach, describe, expect, it } from 'vitest';
import {
  customerMenu,
  customerSettingsTabs,
  hiddenScreenRedirect,
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

  it('hides Agents / Dev and Webhooks from customers by default, keeping Apps (Approved Apps)', () => {
    expect(showDeveloperTools()).toBe(false);
    expect(customerSettingsTabs(upstreamTabs).map((t) => t.tab)).toEqual([
      'global_settings',
      'teams',
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
    expect(customerMenu(upstreamMenu)).toEqual(upstreamMenu);
    expect(hiddenScreenRedirect('/agents/new')).toBeNull();
    expect(hiddenScreenRedirect('/analytics')).toBeNull();
  });

  it('treats anything other than "true" as off', () => {
    process.env.NEXT_PUBLIC_SHOW_DEVELOPER_TOOLS = '1';
    expect(showDeveloperTools()).toBe(false);
  });
});

// The paths of upstream's left menu, plus our own entries.
const upstreamMenu = [
  '/launches',
  '/business-profile',
  '/captions',
  '/results',
  '/plan',
  '/agents',
  '/analytics',
  '/media',
  'https://affiliate.postiz.com',
  '/billing',
  '/settings',
].map((path) => ({ path, name: path }));

describe('hidden upstream screens', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SHOW_DEVELOPER_TOOLS;
  });

  it('drops Agent, Analytics, Affiliate and Billing from the menu', () => {
    expect(customerMenu(upstreamMenu).map((m) => m.path)).toEqual([
      '/launches',
      '/business-profile',
      '/captions',
      '/results',
      '/plan',
      '/media',
      '/settings',
    ]);
  });

  it('sends typed addresses to our own screens', () => {
    expect(hiddenScreenRedirect('/agents')).toBe('/launches');
    expect(hiddenScreenRedirect('/agents/new')).toBe('/launches');
    expect(hiddenScreenRedirect('/agents/abc-123')).toBe('/launches');
    expect(hiddenScreenRedirect('/analytics')).toBe('/results');
    expect(hiddenScreenRedirect('/billing')).toBe('/plan');
    expect(hiddenScreenRedirect('/billing/lifetime')).toBe('/plan');
  });

  it('leaves every other screen alone, including look-alike paths', () => {
    for (const path of [
      '/launches',
      '/results',
      '/plan',
      '/media',
      '/settings',
      '/agentsx',
      '/analytics-report',
      '/p/abc',
      '/business-profile',
    ]) {
      expect(hiddenScreenRedirect(path)).toBeNull();
    }
  });
});
