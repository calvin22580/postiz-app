import { describe, expect, it } from 'vitest';
import { oursSocialProviders } from '@gitroom/nestjs-libraries/ours/ours.social.providers';
import {
  isSandboxEnabled,
  sandboxDisplayName,
} from '@gitroom/nestjs-libraries/ours/sandbox/sandbox.config';
import { SandboxProvider } from '@gitroom/nestjs-libraries/ours/sandbox/sandbox.provider';

describe('Sandbox channel gating', () => {
  it('is off when the variable is missing', () => {
    expect(isSandboxEnabled({})).toBe(false);
    expect(oursSocialProviders({})).toHaveLength(0);
  });

  it('is off for anything other than "true"', () => {
    for (const v of ['false', '0', '1', 'yes', '']) {
      expect(isSandboxEnabled({ SANDBOX_CHANNEL_ENABLED: v })).toBe(false);
      expect(oursSocialProviders({ SANDBOX_CHANNEL_ENABLED: v })).toHaveLength(0);
    }
  });

  it('is on when the variable is "true"', () => {
    const list = oursSocialProviders({ SANDBOX_CHANNEL_ENABLED: 'true' });
    expect(list.map((p) => p.identifier)).toEqual(['sandbox']);
  });
});

describe('Sandbox labelling', () => {
  it('always prefixes the channel name with Sandbox', () => {
    expect(sandboxDisplayName('Demo Café')).toBe('Sandbox · Demo Café');
    expect(sandboxDisplayName('')).toBe('Sandbox · Test channel');
    expect(sandboxDisplayName('Sandbox shop')).toBe('Sandbox shop');
  });

  it('names the provider as test-only', () => {
    expect(new SandboxProvider().name).toMatch(/sandbox/i);
    expect(new SandboxProvider().name).toMatch(/never publishes/i);
  });
});

describe('SandboxProvider', () => {
  const provider = new SandboxProvider();
  const code = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64');

  it('connects with a labelled name and a stable id', async () => {
    const a: any = await provider.authenticate({ code: code({ name: 'Demo' }), codeVerifier: '' });
    const b: any = await provider.authenticate({ code: code({ name: 'Demo' }), codeVerifier: '' });
    expect(a.name).toBe('Sandbox · Demo');
    expect(a.id).toBe(b.id);
  });

  it('rejects malformed details', async () => {
    expect(await provider.authenticate({ code: '%%%', codeVerifier: '' })).toBe(
      'Invalid sandbox details'
    );
  });

  it('records posts as sent without any network call', async () => {
    process.env.FRONTEND_URL = 'http://localhost:4200';
    const fetchSpy = (globalThis.fetch = (() => {
      throw new Error('network must not be used');
    }) as any);
    const res = await provider.post(
      'internal',
      'sandbox',
      [{ id: 'post-1', message: 'Hello', settings: {} }],
      { id: 'int-1', organizationId: 'org-1' } as any
    );
    expect(fetchSpy).toBeDefined();
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('post-1');
    expect(res[0].status).toBe('completed');
    expect(res[0].postId).toMatch(/^sandbox-/);
    expect(res[0].releaseURL).toBe('http://localhost:4200/sandbox/post-1');
  });
});
