import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/main.ts'],
  format: ['esm'],
  outDir: 'dist/cli',
  platform: 'node',
  target: 'node24',
  clean: true,
  sourcemap: true,
  dts: true,
  splitting: false,
  shims: false,
});
