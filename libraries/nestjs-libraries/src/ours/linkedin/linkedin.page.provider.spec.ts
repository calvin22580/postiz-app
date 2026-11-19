import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OursLinkedinPageProvider } from '@gitroom/nestjs-libraries/ours/linkedin/linkedin.page.provider';
import { socialIntegrationList } from '@gitroom/nestjs-libraries/integrations/integration.manager';

const json = (body: unknown) =>
  Promise.resolve({ json: () => Promise.resolve(body) } as Response);

const ME = {
  id: 'abc123',
  localizedFirstName: 'Ada',
  localizedLastName: 'Lovelace',
  vanityName: 'ada-l',
  profilePicture: {
    'displayImage~': {
      elements: [
        { identifiers: [{ identifier: 'https://media.licdn.com/small.jpg' }] },
        { identifiers: [{ identifier: 'https://media.licdn.com/large.jpg' }] },
      ],
    },
  },
};

describe('LinkedIn Page provider (Community Management API only)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('LINKEDIN_CLIENT_ID', 'client');
    vi.stubEnv('LINKEDIN_CLIENT_SECRET', 'secret');
    vi.stubEnv('FRONTEND_URL', 'https://app.example.com');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('replaces upstream linkedin-page in the provider list', () => {
    const pages = socialIntegrationList.filter(
      (p) => p.identifier === 'linkedin-page'
    );
    expect(pages).toHaveLength(1);
    expect(pages[0]).toBeInstanceOf(OursLinkedinPageProvider);
  });

  it('asks only for Community Management API scopes', async () => {
    const provider = new OursLinkedinPageProvider();
    expect(provider.scopes).not.toContain('openid');
    expect(provider.scopes).not.toContain('profile');
    expect(provider.scopes).not.toContain('w_member_social');
    expect(provider.scopes).toContain('r_basicprofile');

    const { url } = await provider.generateAuthUrl();
    const scope = new URL(url).searchParams.get('scope')!;
    expect(scope.split(' ')).toEqual(provider.scopes);
    expect(url).toContain(
      encodeURIComponent('https://app.example.com/integrations/social/linkedin-page')
    );
  });

  it('connects with r_basicprofile and /v2/me, never /v2/userinfo', async () => {
    fetchMock
      .mockReturnValueOnce(
        json({
          access_token: 'tok',
          expires_in: 5184000,
          refresh_token: 'ref',
          scope: 'r_basicprofile,rw_organization_admin,w_organization_social,r_organization_social',
        })
      )
      .mockReturnValueOnce(json(ME));

    const result = await new OursLinkedinPageProvider().authenticate({
      code: 'code',
      codeVerifier: 'v',
    });

    expect(result).toEqual({
      id: 'linkedin-page_abc123',
      accessToken: 'tok',
      refreshToken: 'ref',
      expiresIn: 5184000,
      name: 'Ada Lovelace',
      picture: 'https://media.licdn.com/large.jpg',
      username: 'ada-l',
    });
    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls[1]).toMatch(/^https:\/\/api\.linkedin\.com\/v2\/me\?projection=/);
    expect(urls.some((u) => u.includes('userinfo'))).toBe(false);
  });

  it('refuses to connect when a scope is missing', async () => {
    fetchMock.mockReturnValueOnce(
      json({ access_token: 'tok', expires_in: 1, scope: 'r_basicprofile' })
    );
    await expect(
      new OursLinkedinPageProvider().authenticate({ code: 'c', codeVerifier: 'v' })
    ).rejects.toThrow();
  });

  it('refreshes tokens without OpenID Connect and copes with no picture', async () => {
    fetchMock
      .mockReturnValueOnce(
        json({ access_token: 'tok2', expires_in: 10, refresh_token: 'ref2' })
      )
      .mockReturnValueOnce(json({ id: 'abc123', localizedFirstName: 'Ada' }));

    const result = await new OursLinkedinPageProvider().refreshToken('ref');
    expect(result).toEqual({
      id: 'abc123',
      accessToken: 'tok2',
      refreshToken: 'ref2',
      expiresIn: 10,
      name: 'Ada',
      picture: '',
      username: '',
    });
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('userinfo'))).toBe(false);
  });
});
