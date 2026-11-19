import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.js';

// The nightly live contract jobs only (phase 10 D-01, quick 261118-v58): `live` runs
// `pnpm test:live tests/live/sdk-contract.live.ts` and `live-cli` runs
// `pnpm test:live tests/live/cli-contract.live.ts` (a file argument, never after `--`; the
// shared harness tests/live/live-daemon.ts is not collected). A fresh config, not
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
    // A fresh config does not inherit vitest.config.ts's `test.env`: repeat the update-check
    // opt-out so the live job never reaches registry.npmjs.org (quick 261117-jpp).
    env: { QQ_NO_UPDATE_CHECK: '1' },
  },
  define: baseConfig.define,
});
