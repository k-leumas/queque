import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
  define: {
    __QUEQUE_COMMIT__: JSON.stringify('test-build'),
    __QUEQUE_VERSION__: JSON.stringify('0.0.0-test'),
  },
});
