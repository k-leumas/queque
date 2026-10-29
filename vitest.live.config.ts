import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.js';

// The nightly live contract job only (phase 10, D-01): `pnpm test:live`. A fresh config, not
// mergeConfig with vitest.config.ts, because vitest concatenates `include` arrays and the live
// run would pick up the whole default suite. The default include (`tests/**/*.test.ts`) never
// matches `*.live.ts`, so `pnpm test:run` never calls a real model.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/live/**/*.live.ts'],
    setupFiles: ['tests/setup/scrub-git-env.ts'],
    testTimeout: 60_000,
    hookTimeout: 30_000,
  },
  define: baseConfig.define,
});
