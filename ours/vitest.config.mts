// OURS: unit tests for our own modules. Upstream ships no tests of its own and
// its root jest config needs @nx/jest, which is not installed, so ours run on
// vitest (already an upstream devDependency).
// Run from the repo root:  pnpm exec vitest run --config ours/vitest.config.mts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

export default defineConfig({
  root,
  // the frontend's tsconfig preserves JSX for Next.js; compile it for tests
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: [
      { find: /^@gitroom\/nestjs-libraries\/(.*)$/, replacement: `${root}/libraries/nestjs-libraries/src/$1` },
      { find: /^@gitroom\/helpers\/(.*)$/, replacement: `${root}/libraries/helpers/src/$1` },
      { find: /^@gitroom\/frontend\/(.*)$/, replacement: `${root}/apps/frontend/src/$1` },
      { find: /^@gitroom\/react\/(.*)$/, replacement: `${root}/libraries/react-shared-libraries/src/$1` },
    ],
  },
  test: {
    include: ['**/ours/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**', 'ours/e2e/**'],
    environment: 'node',
  },
});
