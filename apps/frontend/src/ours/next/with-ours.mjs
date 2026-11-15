// OURS: our additions to the frontend's Next.js config, applied by one marked
// line in apps/frontend/next.config.js. See ours/README.md at the repo root.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const brandDir = path.resolve(here, '../brand');
const defaults = JSON.parse(
  readFileSync(path.join(brandDir, 'brand.defaults.json'), 'utf8')
);

export const brandName = () => process.env.NEXT_PUBLIC_BRAND_NAME || defaults.name;

// Upstream modules we swap for our own, by import path.
const aliases = {
  '@gitroom/frontend/components/new-layout/logo': './src/ours/brand/logo.tsx',
  '@gitroom/frontend/components/ui/logo-text.component':
    './src/ours/brand/logo-text.tsx',
};

export const withOurs = (config) => {
  const loader = {
    loader: require.resolve('../brand/rebrand.cjs'),
    options: {
      name: brandName(),
      // our legal pages: apps/frontend/src/app/(legal) by default, or these URLs if set
      links: {
        'https://postiz.com/terms': process.env.NEXT_PUBLIC_TERMS_URL || '',
        'https://postiz.com/privacy': process.env.NEXT_PUBLIC_PRIVACY_URL || '',
      },
    },
  };

  // Source files that may hold customer-facing text: the frontend itself, the
  // shared React library and its locale files. Never node_modules.
  // No `as`/`type`: the file keeps its own module type after the loader runs.
  const rebrandRule = () => ({
    condition: {
      all: [
        { not: 'foreign' },
        { path: /(apps[\\/]frontend[\\/]src|libraries[\\/]react-shared-libraries[\\/]src)[\\/]/ },
      ],
    },
    loaders: [loader],
  });

  const turbopack = config.turbopack || {};
  const upstreamWebpack = config.webpack;

  return {
    ...config,
    turbopack: {
      ...turbopack,
      resolveAlias: { ...(turbopack.resolveAlias || {}), ...aliases },
      rules: {
        ...(turbopack.rules || {}),
        '*.tsx': rebrandRule(),
        '*.ts': rebrandRule(),
        '*.json': rebrandRule(),
      },
    },
    // Same behaviour when the frontend is built with webpack (next build --webpack).
    webpack: (webpackConfig, ctx) => {
      const out = upstreamWebpack ? upstreamWebpack(webpackConfig, ctx) : webpackConfig;
      out.resolve = out.resolve || {};
      out.resolve.alias = {
        ...(out.resolve.alias || {}),
        ...Object.fromEntries(
          Object.entries(aliases).map(([k, v]) => [k + '$', path.resolve(here, '../..', v.replace('./src/', ''))])
        ),
      };
      out.module.rules.push({
        test: /\.(tsx?|json)$/,
        include: [
          path.resolve(here, '../../'),
          path.resolve(here, '../../../../../libraries/react-shared-libraries/src'),
        ],
        enforce: 'pre',
        use: [loader],
      });
      return out;
    },
  };
};
