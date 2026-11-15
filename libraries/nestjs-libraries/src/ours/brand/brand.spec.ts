import { describe, expect, it } from 'vitest';
import { brandName, rebrandText } from '@gitroom/nestjs-libraries/ours/brand/brand';

describe('backend rebrand', () => {
  it('uses the env brand name, with a default', () => {
    expect(brandName({})).toBe('Tidepost');
    expect(brandName({ NEXT_PUBLIC_BRAND_NAME: 'Acme' })).toBe('Acme');
  });

  it('replaces the product name but not URLs or package names', () => {
    const env = { NEXT_PUBLIC_BRAND_NAME: 'Acme' };
    expect(rebrandText('[Postiz] Your latest notifications', env)).toBe(
      '[Acme] Your latest notifications'
    );
    expect(rebrandText('see https://postiz.com and @postiz/cli', env)).toBe(
      'see https://postiz.com and @postiz/cli'
    );
    expect(rebrandText('PostizApi', env)).toBe('PostizApi');
  });
});
