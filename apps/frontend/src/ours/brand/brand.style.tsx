// OURS: brand colour tokens, layered over upstream's colours without editing
// upstream styles. Rendered once in the root layout <head>.
//
// 1. Upstream's CSS variables (colors.scss) are redefined with higher specificity.
// 2. Upstream also hard-codes its purple (#612BD3) and pinks (#FC69FF, #D82D7E)
//    in Tailwind arbitrary-value classes such as bg-[#612BD3]. We restyle those
//    generated classes here, so no upstream component has to change.
import { brand, shade } from '@gitroom/frontend/ours/brand/brand';

const PURPLES = ['612BD3', '612bd3', '7B3FF2'];
const DARK_PURPLES = ['5520CB'];
const PINKS = ['FC69FF', 'fc69ff', 'D82D7E', 'd82d7e', 'AA0FA4', 'B69DEC'];
// gradient stops of upstream's primary call-to-action buttons
const GRADIENT_STOPS = ['622aff', '8b5cf6', '7c3aff', '9d6eff'];

// Tailwind escapes "[#612BD3]" as "\[\#612BD3\]" in the class selector.
const cls = (prefix: string, hex: string) => `.${prefix}-\\[\\#${hex}\\]`;
const variant = (v: string, prefix: string, hex: string) =>
  `.${v}\\:${prefix}-\\[\\#${hex}\\]:${v}`;

export const brandCss = (c: string) => {
  const accent = shade(c, 0.55);
  const rules: string[] = [
    `html:root .dark {
  --new-btn-primary: ${c};
  --new-table-text-focused: ${accent};
  --color-forth: ${c};
}`,
    `html:root .light {
  --new-btn-primary: ${c};
  --new-table-text-focused: ${c};
  --new-textItemFocused: ${c};
  --new-boxFocused: ${shade(c, 0.88)};
  --new-back-drop: ${shade(c, -0.6)};
  --color-forth: ${c};
}`,
  ];
  for (const hex of PURPLES) {
    rules.push(`${cls('bg', hex)} { background-color: ${c} !important; }`);
    rules.push(`${cls('border', hex)} { border-color: ${c} !important; }`);
    rules.push(`${cls('text', hex)} { color: ${c} !important; }`);
    rules.push(`${variant('hover', 'bg', hex)} { background-color: ${c} !important; }`);
    rules.push(`${variant('hover', 'border', hex)} { border-color: ${c} !important; }`);
    rules.push(`${variant('focus', 'border', hex)} { border-color: ${c} !important; }`);
  }
  const dark = shade(c, -0.2);
  for (const hex of DARK_PURPLES) {
    rules.push(`${cls('bg', hex)} { background-color: ${dark} !important; }`);
    rules.push(`${variant('hover', 'bg', hex)} { background-color: ${dark} !important; }`);
  }
  for (const hex of GRADIENT_STOPS) {
    for (const p of ['from', 'to']) {
      rules.push(
        `${cls(p, hex)}, ${variant('hover', p, hex)} { --tw-gradient-from: ${c} !important; --tw-gradient-to: ${c} !important; --tw-gradient-stops: ${c}, ${c} !important; }`
      );
    }
  }
  for (const hex of PINKS) {
    rules.push(`${cls('bg', hex)} { background-color: ${accent} !important; }`);
    rules.push(`${cls('border', hex)} { border-color: ${accent} !important; }`);
    rules.push(`${cls('text', hex)} { color: ${accent} !important; }`);
  }
  return rules.join('\n');
};

export const BrandStyle = () => (
  <style
    id="brand-tokens"
    dangerouslySetInnerHTML={{ __html: brandCss(brand.colour) }}
  />
);
