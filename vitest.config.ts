import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
  define: {
    __QUEQUE_COMMIT__: JSON.stringify('test-build'),
    __QUEQUE_VERSION__: JSON.stringify('0.0.0-test'),
    // Inert telemetry endpoint: an empty key (nothing is sent) and the discard port, so a test
    // that sets QQ_TELEMETRY_KEY but forgets to inject fetch can never reach the internet.
    __QUEQUE_TELEMETRY_KEY__: JSON.stringify(''),
    __QUEQUE_TELEMETRY_HOST__: JSON.stringify('http://127.0.0.1:9'),
  },
});
