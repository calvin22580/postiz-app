// OURS: brand settings for the frontend. Every value can be overridden with an
// environment variable, so the placeholder brand is easy to swap later.
import defaults from './brand.defaults.json';

const hex = /^#[0-9a-fA-F]{6}$/;

export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || defaults.name,
  colour: hex.test(process.env.NEXT_PUBLIC_BRAND_COLOUR || '')
    ? (process.env.NEXT_PUBLIC_BRAND_COLOUR as string)
    : defaults.colour,
  // Optional image logo. Without it we show a text wordmark.
  logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_URL || defaults.logoUrl,
  sourceCodeUrl:
    process.env.NEXT_PUBLIC_SOURCE_CODE_URL || defaults.sourceCodeUrl,
};

// Mixes the brand colour with white (amount > 0) or black (amount < 0).
export const shade = (colour: string, amount: number) => {
  const n = parseInt(colour.slice(1), 16);
  const mix = (c: number) => {
    const target = amount > 0 ? 255 : 0;
    return Math.round(c + (target - c) * Math.abs(amount));
  };
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};
