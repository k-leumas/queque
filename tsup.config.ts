import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { defineConfig } from 'tsup';

const commit = execSync('git rev-parse --short HEAD').toString().trim();
const version = (JSON.parse(readFileSync('package.json', 'utf-8')) as { version: string }).version;

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
  banner: { js: '#!/usr/bin/env node' },
  define: {
    __QUEQUE_COMMIT__: JSON.stringify(commit),
    __QUEQUE_VERSION__: JSON.stringify(version),
  },
});
