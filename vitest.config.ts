import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup/scrub-git-env.ts'],
  },
  define: {
    __QUEQUE_COMMIT__: JSON.stringify('test-build'),
    __QUEQUE_VERSION__: JSON.stringify('0.0.0-test'),
    // The build id the daemon pong carries and ensureDaemon compares (quick 261030-tq3).
    __QUEQUE_BUILD_ID__: JSON.stringify('0.0.0-test+test-build'),
    // Inert telemetry endpoint: an empty key (nothing is sent) and the discard port, so a test
    // that sets QQ_TELEMETRY_KEY but forgets to inject fetch can never reach the internet.
    __QUEQUE_TELEMETRY_KEY__: JSON.stringify(''),
    __QUEQUE_TELEMETRY_HOST__: JSON.stringify('http://127.0.0.1:9'),
  },
});
