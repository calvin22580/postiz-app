// OURS: LinkedIn Page provider for an app that has only the Community
// Management API product. LinkedIn does not allow "Sign In with LinkedIn using
// OpenID Connect" or "Share on LinkedIn" next to that product, so upstream's
// `openid` / `profile` scopes and its /v2/userinfo call can never work for us.
// This keeps everything else from upstream's LinkedinPageProvider (identifier,
// page picker, posting as the Page, analytics) and only swaps how the member
// is identified: r_basicprofile with /v2/me instead of OpenID Connect.
// Registered in place of upstream's provider by one marked line in
// integrations/integration.manager.ts.
import { AuthTokenDetails } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { LinkedinPageProvider } from '@gitroom/nestjs-libraries/integrations/social/linkedin.page.provider';

// Lite profile fields r_basicprofile allows, with the picture URLs resolved
// the same way upstream reads Page logos (logoV2(original~:playableStreams)).
const ME_URL =
  'https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,vanityName,profilePicture(displayImage~:playableStreams))';

export class OursLinkedinPageProvider extends LinkedinPageProvider {
  // Community Management API scopes only. `w_member_social` is left out too:
  // the Page provider always posts as the organisation, and checkScopes is
  // all-or-nothing, so asking for a scope we don't use can only break connect.
  override scopes = [
    'r_basicprofile',
    'rw_organization_admin',
    'w_organization_social',
    'r_organization_social',
  ];

  private async me(accessToken: string) {
    const data = await (
      await fetch(ME_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
    ).json();

    const streams = data?.profilePicture?.['displayImage~']?.elements || [];

    return {
      id: data?.id as string,
      name: [data?.localizedFirstName, data?.localizedLastName]
        .filter(Boolean)
        .join(' '),
      // the last stream is the largest size
      picture: (streams[streams.length - 1]?.identifiers?.[0]?.identifier ||
        '') as string,
      username: (data?.vanityName || '') as string,
    };
  }

  override async refreshToken(
    refresh_token: string
  ): Promise<AuthTokenDetails> {
    const {
      access_token: accessToken,
      expires_in,
      refresh_token: refreshToken,
    } = await (
      await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token,
          client_id: process.env.LINKEDIN_CLIENT_ID!,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        }),
      })
    ).json();

    const { id, name, picture, username } = await this.me(accessToken);

    return {
      id,
      accessToken,
      refreshToken,
      expiresIn: expires_in,
      name,
      picture,
      username,
    };
  }

  override async authenticate(params: {
    code: string;
    codeVerifier: string;
    refresh?: string;
  }) {
    const body = new URLSearchParams();
    body.append('grant_type', 'authorization_code');
    body.append('code', params.code);
    body.append(
      'redirect_uri',
      `${process.env.FRONTEND_URL}/integrations/social/linkedin-page`
    );
    body.append('client_id', process.env.LINKEDIN_CLIENT_ID!);
    body.append('client_secret', process.env.LINKEDIN_CLIENT_SECRET!);

    const {
      access_token: accessToken,
      expires_in: expiresIn,
      refresh_token: refreshToken,
      scope,
    } = await (
      await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      })
    ).json();

    this.checkScopes(this.scopes, scope);

    const { id, name, picture, username } = await this.me(accessToken);

    return {
      // same namespaced placeholder as upstream, until a Page is chosen
      id: `${this.identifier}_${id}`,
      accessToken,
      refreshToken,
      expiresIn,
      name,
      picture,
      username,
    };
  }
}
