// OURS: the business's brand kit and the graphics drawn with it. A graphic is
// drawn on demand from the business profile, the brand kit and a fixed
// layout, so previews always match the current profile. Only when a post is
// approved is the image saved to the media library and attached.
import { HttpException, Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { parseDataUrl } from '@gitroom/nestjs-libraries/upload/data.url';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { BusinessProfileService } from '@gitroom/nestjs-libraries/ours/profile/business.profile.service';
import { ProfileFields } from '@gitroom/nestjs-libraries/ours/profile/business.profile.fields';
import { CaptionPlatform } from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import { BrandKitRepository } from '@gitroom/nestjs-libraries/ours/graphics/brand.kit.repository';
import {
  DEFAULT_BRAND_COLOUR,
  GRAPHIC_SIZES,
  GraphicFact,
  graphicContent,
  GraphicLayout,
} from '@gitroom/nestjs-libraries/ours/graphics/graphic.content';
import { renderGraphic } from '@gitroom/nestjs-libraries/ours/graphics/graphic.renderer';

const MAX_LOGO_BYTES = 3 * 1024 * 1024;
const LOGO_FORMATS = ['png', 'jpeg', 'webp'];
// big enough for the largest logo tile, small enough to keep in the database
const LOGO_MAX_SIDE = 600;

@Injectable()
export class GraphicService {
  private _logger = new Logger(GraphicService.name);
  private _storage = UploadFactory.createStorage();

  constructor(
    private _brandKitRepository: BrandKitRepository,
    private _businessProfileService: BusinessProfileService,
    private _mediaService: MediaService
  ) {}

  async getBrandKit(orgId: string) {
    const kit = await this._brandKitRepository.getKit(orgId);
    return {
      colour: kit?.colour || DEFAULT_BRAND_COLOUR,
      chosen: !!kit,
      hasLogo: !!(await this._brandKitRepository.hasLogo(orgId)),
      updatedAt: kit?.updatedAt || null,
    };
  }

  async setColour(orgId: string, colour: string) {
    await this._brandKitRepository.setColour(orgId, colour.toUpperCase());
    return this.getBrandKit(orgId);
  }

  // Only real images are accepted, and they are re-encoded as a small PNG, so
  // nothing else in the upload survives (scripts in an SVG, metadata).
  async setLogo(orgId: string, dataUrl: string) {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed || !parsed.buffer.length) {
      throw new HttpException('Choose a PNG, JPEG or WebP image.', 400);
    }
    if (parsed.buffer.length > MAX_LOGO_BYTES) {
      throw new HttpException('Your logo is too big. Use an image under 3 MB.', 400);
    }
    let logo: Buffer;
    try {
      const meta = await sharp(parsed.buffer).metadata();
      if (!meta.format || !LOGO_FORMATS.includes(meta.format)) {
        throw new Error(`format ${meta.format}`);
      }
      logo = await sharp(parsed.buffer)
        .rotate()
        .resize({ width: LOGO_MAX_SIDE, height: LOGO_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
    } catch (e) {
      this._logger.warn(`Logo rejected for org=${orgId}: ${(e as Error)?.message}`);
      throw new HttpException('Choose a PNG, JPEG or WebP image.', 400);
    }
    const kit = await this._brandKitRepository.getKit(orgId);
    await this._brandKitRepository.setLogo(orgId, logo, kit?.colour || DEFAULT_BRAND_COLOUR);
    return this.getBrandKit(orgId);
  }

  async removeLogo(orgId: string) {
    const kit = await this._brandKitRepository.getKit(orgId);
    if (kit) {
      await this._brandKitRepository.setLogo(orgId, null, kit.colour);
    }
    return this.getBrandKit(orgId);
  }

  async getLogo(orgId: string) {
    const kit = await this._brandKitRepository.getKit(orgId, true);
    if (!kit?.logo) {
      throw new HttpException('No logo', 404);
    }
    return Buffer.from(kit.logo);
  }

  // The graphic for one post, or null when the profile has too little to put
  // on it. Reads the profile and brand kit each time.
  async render(
    orgId: string,
    body: { platform: CaptionPlatform; layout: GraphicLayout; facts: GraphicFact[] }
  ) {
    const { profile } = await this._businessProfileService.getProfile(orgId);
    if (!profile) {
      return null;
    }
    const content = graphicContent(body.layout, body.facts, profile.fields as ProfileFields);
    if (!content) {
      return null;
    }
    const kit = await this._brandKitRepository.getKit(orgId, true);
    const png = await renderGraphic({
      content,
      ...GRAPHIC_SIZES[body.platform],
      brandColour: kit?.colour || DEFAULT_BRAND_COLOUR,
      logo: kit?.logo ? Buffer.from(kit.logo) : null,
    });
    return { png, layout: content.layout };
  }

  // Saves a finished graphic to the organisation's media library (upstream's
  // storage and Media table), the same way upstream saves generated images.
  async saveToMediaLibrary(orgId: string, png: Buffer) {
    const path = await this._storage.uploadSimple(
      'data:image/png;base64,' + png.toString('base64')
    );
    const media = await this._mediaService.saveFile(orgId, path.split('/').pop()!, path);
    return { id: media.id, path: media.path };
  }
}
