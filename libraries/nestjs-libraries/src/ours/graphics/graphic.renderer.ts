// OURS: draws a post graphic on the server with sharp (already used upstream
// for images), so no paid image service is needed. Shapes are SVG, text is
// rendered by Pango from our bundled font file, so it looks the same on a
// server with no fonts installed.
import sharp, { OverlayOptions } from 'sharp';
import { existsSync } from 'fs';
import { resolve } from 'path';
import {
  accentOnPaper,
  DARK_TEXT,
  GraphicContent,
  PAPER,
  textColourOn,
} from '@gitroom/nestjs-libraries/ours/graphics/graphic.content';

const FONT_DIR_IN_REPO = 'libraries/nestjs-libraries/src/ours/graphics/fonts';
const FAMILY = 'Plus Jakarta Sans';
const WEIGHTS = {
  bold: { file: 'PlusJakartaSans-ExtraBold.ttf', pango: 'Ultra-Bold' },
  medium: { file: 'PlusJakartaSans-Medium.ttf', pango: 'Medium' },
} as const;

// The backend runs from apps/backend (dev and pm2) or the repo root (tests).
let fontDir: string | null = null;
export const graphicFontDir = () => {
  if (fontDir) return fontDir;
  const candidates = [
    process.env.OURS_GRAPHICS_FONT_DIR,
    resolve(process.cwd(), FONT_DIR_IN_REPO),
    resolve(process.cwd(), '../..', FONT_DIR_IN_REPO),
  ].filter(Boolean) as string[];
  const found = candidates.find((dir) => existsSync(resolve(dir, WEIGHTS.bold.file)));
  if (!found) {
    throw new Error(`Graphic fonts not found (looked in ${candidates.join(', ')})`);
  }
  fontDir = found;
  return found;
};

const escapeMarkup = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface TextOptions {
  text: string;
  weight: keyof typeof WEIGHTS;
  size: number;
  colour: string;
  width: number;
  maxHeight: number;
  align?: 'left' | 'centre';
  alpha?: number;
}

interface Block {
  input: Buffer;
  width: number;
  height: number;
}

// Wraps the text to the width, shrinking it until it fits the box.
const textBlock = async (o: TextOptions): Promise<Block> => {
  const weight = WEIGHTS[o.weight];
  const alpha = o.alpha ? ` fgalpha="${Math.round(o.alpha * 100)}%"` : '';
  let size = o.size;
  for (let attempt = 0; attempt < 12; attempt++) {
    const { data, info } = await sharp({
      text: {
        text: `<span foreground="${o.colour}"${alpha}>${escapeMarkup(o.text)}</span>`,
        font: `${FAMILY} ${weight.pango} ${Math.round(size)}`,
        fontfile: resolve(graphicFontDir(), weight.file),
        width: Math.round(o.width),
        dpi: 72,
        rgba: true,
        // breaks inside a word only when one word is wider than the box
        wrap: 'word-char',
        align: o.align === 'centre' ? 'centre' : 'left',
        spacing: Math.round(size * (o.weight === 'bold' ? 0.02 : 0.2)),
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true });
    if ((info.height <= o.maxHeight && info.width <= o.width) || attempt === 11) {
      return { input: data, width: info.width, height: info.height };
    }
    size *= 0.9;
  }
  throw new Error('unreachable');
};

const logoBlock = async (logo: Buffer, maxWidth: number, maxHeight: number): Promise<Block> => {
  const { data, info } = await sharp(logo)
    .resize({ width: Math.round(maxWidth), height: Math.round(maxHeight), fit: 'inside' })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { input: data, width: info.width, height: info.height };
};

const svg = (width: number, height: number, body: string) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`
  );

const rect = (x: number, y: number, w: number, h: number, fill: string, r = 0, opacity = 1) =>
  `<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}" rx="${Math.round(r)}" fill="${fill}" fill-opacity="${opacity}"/>`;

const at = (block: Block, left: number, top: number): OverlayOptions => ({
  input: block.input,
  left: Math.round(left),
  top: Math.round(top),
});

export interface RenderInput {
  content: GraphicContent;
  width: number;
  height: number;
  brandColour: string;
  logo?: Buffer | null;
}

// A logo on a white tile, so any logo reads on any brand colour.
const tiledLogo = async (logo: Buffer, tileHeight: number, maxTileWidth: number) => {
  const pad = Math.round(tileHeight * 0.16);
  const inner = await logoBlock(logo, maxTileWidth - pad * 2, tileHeight - pad * 2);
  const tileWidth = inner.width + pad * 2;
  return { inner, pad, tileWidth, tileHeight };
};

export const renderGraphic = async ({
  content,
  width: W,
  height: H,
  brandColour,
  logo,
}: RenderInput): Promise<Buffer> => {
  const s = W / 1080;
  const pad = Math.round(88 * s);
  const onBrand = textColourOn(brandColour);
  const shapes: string[] = [];
  const layers: OverlayOptions[] = [];
  let background = brandColour;

  // business name with the logo beside it, along the bottom
  const footer = async (colour: string, bottom: number) => {
    const tileHeight = Math.round(104 * s);
    let left = pad;
    if (logo) {
      const tile = await tiledLogo(logo, tileHeight, W * 0.4);
      shapes.push(rect(left, bottom - tileHeight, tile.tileWidth, tileHeight, '#FFFFFF', 18 * s));
      layers.push(at(tile.inner, left + tile.pad, bottom - tileHeight + (tileHeight - tile.inner.height) / 2));
      left += tile.tileWidth + Math.round(28 * s);
    }
    const name = await textBlock({
      text: content.businessName,
      weight: 'bold',
      size: 40 * s,
      colour,
      width: W - left - pad,
      maxHeight: tileHeight * 1.2,
    });
    layers.push(at(name, left, bottom - tileHeight / 2 - name.height / 2));
  };

  if (content.layout === 'statement') {
    const label = content.label
      ? await textBlock({ text: content.label, weight: 'medium', size: 38 * s, colour: onBrand, width: W - pad * 2, maxHeight: 60 * s, alpha: 0.8 })
      : null;
    if (label) layers.push(at(label, pad, pad));
    shapes.push(rect(pad, pad + 70 * s, 96 * s, 10 * s, onBrand, 5 * s, 0.85));
    const headline = await textBlock({
      text: content.headline || '',
      weight: 'bold',
      size: 108 * s,
      colour: onBrand,
      width: W - pad * 2,
      maxHeight: H * 0.56,
    });
    const top = pad + 140 * s + Math.max(0, (H - pad * 2 - 140 * s - 104 * s - headline.height) / 2 - 60 * s);
    layers.push(at(headline, pad, top));
    await footer(onBrand, H - pad);
  }

  if (content.layout === 'card') {
    background = PAPER;
    const bandHeight = Math.round(H * 0.17);
    shapes.push(rect(0, 0, W, bandHeight, brandColour));
    // name and logo in the band
    const tileHeight = Math.round(bandHeight * 0.52);
    let left = pad;
    if (logo) {
      const tile = await tiledLogo(logo, tileHeight, W * 0.35);
      const top = (bandHeight - tileHeight) / 2;
      shapes.push(rect(left, top, tile.tileWidth, tileHeight, '#FFFFFF', 16 * s));
      layers.push(at(tile.inner, left + tile.pad, top + (tileHeight - tile.inner.height) / 2));
      left += tile.tileWidth + Math.round(26 * s);
    }
    const name = await textBlock({ text: content.businessName, weight: 'bold', size: 40 * s, colour: onBrand, width: W - left - pad, maxHeight: bandHeight * 0.7 });
    layers.push(at(name, left, (bandHeight - name.height) / 2));

    const accent = accentOnPaper(brandColour);
    let top = bandHeight + pad;
    if (content.label) {
      const label = await textBlock({ text: content.label, weight: 'medium', size: 38 * s, colour: accent, width: W - pad * 2, maxHeight: 60 * s });
      layers.push(at(label, pad, top));
      top += label.height + 36 * s;
    }
    const headline = await textBlock({
      text: content.headline || '',
      weight: 'bold',
      size: 100 * s,
      colour: DARK_TEXT,
      width: W - pad * 2,
      maxHeight: H - top - pad - 80 * s,
    });
    // sits in the upper middle of the paper, under its label
    layers.push(at(headline, pad, top + Math.max(0, (H - top - pad - 80 * s - headline.height) * 0.3)));
    shapes.push(rect(pad, H - pad - 14 * s, 150 * s, 14 * s, brandColour, 7 * s));
  }

  if (content.layout === 'details') {
    const label = await textBlock({ text: content.label || 'Find us', weight: 'medium', size: 38 * s, colour: onBrand, width: W - pad * 2, maxHeight: 60 * s, alpha: 0.8 });
    layers.push(at(label, pad, pad));
    const name = await textBlock({ text: content.businessName, weight: 'bold', size: 84 * s, colour: onBrand, width: W - pad * 2, maxHeight: H * 0.24 });
    let top = pad + label.height + 40 * s;
    layers.push(at(name, pad, top));
    top += name.height + 64 * s;
    shapes.push(rect(pad, top, W - pad * 2, 3 * s, onBrand, 0, 0.35));
    top += 56 * s;
    const rowSpace = (H - pad - (logo ? 150 * s : 0) - top) / Math.max(1, content.details.length);
    for (const d of content.details) {
      const rowLabel = await textBlock({ text: d.label, weight: 'medium', size: 32 * s, colour: onBrand, width: W - pad * 2, maxHeight: 50 * s, alpha: 0.75 });
      const value = await textBlock({ text: d.value, weight: 'bold', size: 56 * s, colour: onBrand, width: W - pad * 2, maxHeight: Math.max(60 * s, rowSpace - rowLabel.height - 40 * s) });
      layers.push(at(rowLabel, pad, top));
      layers.push(at(value, pad, top + rowLabel.height + 10 * s));
      top += Math.min(rowSpace, rowLabel.height + value.height + 56 * s);
    }
    if (logo) {
      const tile = await tiledLogo(logo, Math.round(104 * s), W * 0.4);
      const tileTop = H - pad - tile.tileHeight;
      shapes.push(rect(pad, tileTop, tile.tileWidth, tile.tileHeight, '#FFFFFF', 18 * s));
      layers.push(at(tile.inner, pad + tile.pad, tileTop + (tile.tileHeight - tile.inner.height) / 2));
    }
  }

  if (content.layout === 'name') {
    const blocks: { block: Block; gap: number; tile?: { pad: number; w: number; h: number } }[] = [];
    if (logo) {
      const tile = await tiledLogo(logo, Math.round(220 * s), W * 0.6);
      blocks.push({ block: tile.inner, gap: 64 * s, tile: { pad: tile.pad, w: tile.tileWidth, h: tile.tileHeight } });
    }
    blocks.push({
      block: await textBlock({ text: content.businessName, weight: 'bold', size: 96 * s, colour: onBrand, width: W - pad * 2, maxHeight: H * 0.3, align: 'centre' }),
      gap: 44 * s,
    });
    if (content.headline) {
      blocks.push({
        block: await textBlock({ text: content.headline, weight: 'medium', size: 44 * s, colour: onBrand, width: W - pad * 2.6, maxHeight: H * 0.3, align: 'centre', alpha: 0.9 }),
        gap: 0,
      });
    }
    const heightOf = (b: (typeof blocks)[number]) => (b.tile ? b.tile.h : b.block.height);
    const total = blocks.reduce((sum, b) => sum + heightOf(b) + b.gap, 0);
    let top = (H - total) / 2;
    for (const b of blocks) {
      if (b.tile) {
        const left = (W - b.tile.w) / 2;
        shapes.push(rect(left, top, b.tile.w, b.tile.h, '#FFFFFF', 24 * s));
        layers.push(at(b.block, left + b.tile.pad, top + (b.tile.h - b.block.height) / 2));
      } else {
        layers.push(at(b.block, (W - b.block.width) / 2, top));
      }
      top += heightOf(b) + b.gap;
    }
  }

  return sharp({ create: { width: W, height: H, channels: 4, background } })
    .composite([{ input: svg(W, H, shapes.join('')), left: 0, top: 0 }, ...layers])
    .flatten({ background })
    .png()
    .toBuffer();
};
