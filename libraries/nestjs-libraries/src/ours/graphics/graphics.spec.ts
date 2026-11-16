// OURS: post graphics say only what the business profile says, come in the
// right size for each platform, stay readable on any brand colour, and only
// accept real images as logos.
import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import {
  emptyFields,
  ProfileFields,
} from '@gitroom/nestjs-libraries/ours/profile/business.profile.fields';
import {
  accentOnPaper,
  automaticLayout,
  contrastRatio,
  DARK_TEXT,
  GRAPHIC_LAYOUTS,
  GRAPHIC_SIZES,
  graphicContent,
  LIGHT_TEXT,
  MAX_HEADLINE_LENGTH,
  PAPER,
  textColourOn,
} from '@gitroom/nestjs-libraries/ours/graphics/graphic.content';
import { renderGraphic } from '@gitroom/nestjs-libraries/ours/graphics/graphic.renderer';

vi.mock('@gitroom/nestjs-libraries/database/prisma/media/media.service', () => ({ MediaService: class {} }));
vi.mock('@gitroom/nestjs-libraries/ours/profile/business.profile.service', () => ({ BusinessProfileService: class {} }));
vi.mock('@gitroom/nestjs-libraries/upload/upload.factory', () => ({
  UploadFactory: { createStorage: () => ({ uploadSimple: vi.fn() }) },
}));

const site = (value: string) => ({ value, origin: 'website' as const, sources: [{ url: 'https://example.test/', quote: value }] });

const profile = (): ProfileFields => {
  const f = emptyFields();
  f.businessName = { claims: [site('Harbour Lane Bakery')] };
  f.whatTheyDo = { claims: [site('A small family bakery in Exampletown, baking sourdough and pastries every morning.')] };
  f.services = { claims: [site('Sourdough loaves'), site('Celebration cakes to order')] };
  f.highlights = { claims: [site('Baking in Exampletown since 2009')] };
  f.location = { claims: [site('Exampletown')] };
  f.phone = { claims: [site('01632 960123')] };
  f.openingHours = { claims: [site('Tuesday to Saturday, 7am to 3pm')] };
  return f;
};

const FIXED_LABELS = ['Our services', 'About us', 'Find us', 'Where', 'Open', 'Call'];
const profileValues = (f: ProfileFields) =>
  Object.values(f).flatMap((field) => field.claims.map((c) => c.value));

describe('graphic content', () => {
  it('uses the caption’s own fact as the headline, word for word', () => {
    const c = graphicContent('statement', [{ field: 'businessName', value: 'Harbour Lane Bakery' }, { field: 'services', value: 'Celebration cakes to order' }], profile())!;
    expect(c).toMatchObject({ layout: 'statement', businessName: 'Harbour Lane Bakery', label: 'Our services', headline: 'Celebration cakes to order' });
  });

  it('puts nothing on any layout that isn’t in the profile or a fixed label', () => {
    const f = profile();
    const allowed = new Set([...profileValues(f), ...FIXED_LABELS]);
    for (const { key } of GRAPHIC_LAYOUTS) {
      for (const facts of [[], [{ field: 'highlights', value: 'Baking in Exampletown since 2009' }]]) {
        const c = graphicContent(key, facts, f)!;
        const words = [c.businessName, c.label, c.headline, ...c.details.flatMap((d) => [d.label, d.value])].filter(Boolean);
        for (const w of words) expect(allowed.has(w as string), `"${w}" on ${key}`).toBe(true);
      }
    }
  });

  it('never cuts a long fact short: it uses a shorter one instead', () => {
    const f = profile();
    const long = 'x'.repeat(MAX_HEADLINE_LENGTH + 1);
    const c = graphicContent('card', [{ field: 'services', value: long }], f)!;
    expect(c.headline).toBe('A small family bakery in Exampletown, baking sourdough and pastries every morning.');
    f.whatTheyDo = { claims: [site(long)] };
    // nothing short enough for a headline: the name-and-logo layout instead
    expect(graphicContent('statement', [{ field: 'services', value: long }], f)!.layout).toBe('name');
  });

  it('falls back to a layout the profile can fill', () => {
    const f = profile();
    f.location = { claims: [] };
    f.phone = { claims: [] };
    f.openingHours = { claims: [] };
    expect(graphicContent('details', [], f)!.layout).toBe('card');
    const withContact = graphicContent('details', [], profile())!;
    expect(withContact.details).toEqual([
      { label: 'Where', value: 'Exampletown' },
      { label: 'Open', value: 'Tuesday to Saturday, 7am to 3pm' },
      { label: 'Call', value: '01632 960123' },
    ]);
    expect(withContact.headline).toBeNull();
  });

  it('draws nothing without a business name', () => {
    const f = profile();
    f.businessName = { claims: [] };
    expect(graphicContent('statement', [], f)).toBeNull();
  });

  it('rotates one layout a day', () => {
    expect([0, 1, 2, 3, 4].map(automaticLayout)).toEqual(['statement', 'card', 'details', 'name', 'card']);
    expect(automaticLayout(5)).toBe('statement');
  });
});

describe('colours', () => {
  it('chooses readable text for any brand colour', () => {
    expect(textColourOn('#1F5F5B')).toBe(LIGHT_TEXT);
    expect(textColourOn('#E8C547')).toBe(DARK_TEXT);
    expect(textColourOn('#FFFFFF')).toBe(DARK_TEXT);
    for (const bg of ['#000000', '#FF0000', '#00FF00', '#0000FF', '#777777', '#E8C547', '#1F5F5B']) {
      // WCAG AA for large text; every word on a graphic is 24px or bigger
      expect(contrastRatio(bg, textColourOn(bg))).toBeGreaterThanOrEqual(3);
    }
  });

  it('only uses the brand colour as text on paper when it is readable there', () => {
    expect(accentOnPaper('#1F5F5B')).toBe('#1F5F5B');
    expect(accentOnPaper('#E8C547')).toBe(DARK_TEXT);
    expect(contrastRatio(PAPER, DARK_TEXT)).toBeGreaterThan(4.5);
  });
});

describe('renderGraphic', () => {
  const logo = async () =>
    sharp({ create: { width: 400, height: 160, channels: 4, background: '#C0392B' } }).png().toBuffer();

  it('draws every layout at each platform’s size, with and without a logo', async () => {
    const f = profile();
    for (const platform of ['instagram', 'facebook', 'linkedin'] as const) {
      for (const { key } of GRAPHIC_LAYOUTS) {
        const png = await renderGraphic({
          content: graphicContent(key, [{ field: 'services', value: 'Celebration cakes to order' }], f)!,
          ...GRAPHIC_SIZES[platform],
          brandColour: '#1F5F5B',
          logo: key === 'name' || platform === 'linkedin' ? await logo() : null,
        });
        const meta = await sharp(png).metadata();
        expect(meta.format).toBe('png');
        expect([meta.width, meta.height]).toEqual([GRAPHIC_SIZES[platform].width, GRAPHIC_SIZES[platform].height]);
      }
    }
    expect(GRAPHIC_SIZES).toEqual({
      instagram: { width: 1080, height: 1350 },
      facebook: { width: 1080, height: 1350 },
      linkedin: { width: 1200, height: 1200 },
    });
  }, 60_000);

  it('draws text with markup characters and very long words without breaking', async () => {
    const png = await renderGraphic({
      content: {
        layout: 'statement',
        businessName: 'Smith & Sons <Builders>',
        label: 'Our services',
        headline: 'Kitchens & bathrooms <fitted> Supercalifragilisticexpialidociouslylongword',
        details: [],
      },
      width: 1080,
      height: 1350,
      brandColour: '#E8C547',
    });
    expect((await sharp(png).metadata()).width).toBe(1080);
  });

  it('really uses the brand colour as the background', async () => {
    const png = await renderGraphic({
      content: graphicContent('statement', [], profile())!,
      width: 1080,
      height: 1350,
      brandColour: '#1F5F5B',
    });
    const { data } = await sharp(png).extract({ left: 5, top: 5, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    expect([...data.subarray(0, 3)]).toEqual([0x1f, 0x5f, 0x5b]);
  });
});

describe('GraphicService logo', () => {
  const makeService = async () => {
    const { GraphicService } = await import('@gitroom/nestjs-libraries/ours/graphics/graphic.service');
    const repo = {
      getKit: vi.fn(async () => null),
      hasLogo: vi.fn(async () => 0),
      setLogo: vi.fn(async () => ({ id: 'k' })),
      setColour: vi.fn(async () => ({ id: 'k' })),
    };
    return { service: new GraphicService(repo as never, {} as never, {} as never), repo };
  };
  const dataUrl = (mime: string, buf: Buffer) => `data:${mime};base64,${buf.toString('base64')}`;

  it('re-encodes an uploaded logo as a small PNG', async () => {
    const { service, repo } = await makeService();
    const big = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#123456' } }).jpeg().toBuffer();
    await service.setLogo('org-1', dataUrl('image/jpeg', big));
    const [orgId, saved, colour] = repo.setLogo.mock.calls[0] as unknown as [string, Buffer, string];
    expect(orgId).toBe('org-1');
    expect(colour).toBe('#2F3B45');
    const meta = await sharp(saved).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['png', 600, 300]);
  });

  it('refuses anything that isn’t a PNG, JPEG or WebP image', async () => {
    const { service, repo } = await makeService();
    const svgWithScript = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
    await expect(service.setLogo('org-1', dataUrl('image/png', svgWithScript))).rejects.toThrow('PNG, JPEG or WebP');
    await expect(service.setLogo('org-1', dataUrl('image/png', Buffer.from('not an image')))).rejects.toThrow('PNG, JPEG or WebP');
    await expect(service.setLogo('org-1', 'https://example.test/logo.png')).rejects.toThrow('PNG, JPEG or WebP');
    await expect(service.setLogo('org-1', dataUrl('image/png', Buffer.alloc(3 * 1024 * 1024 + 1)))).rejects.toThrow('too big');
    expect(repo.setLogo).not.toHaveBeenCalled();
  });

  it('stores colours in one format', async () => {
    const { service, repo } = await makeService();
    await service.setColour('org-1', '#1f5f5b');
    expect(repo.setColour).toHaveBeenCalledWith('org-1', '#1F5F5B');
  });
});
