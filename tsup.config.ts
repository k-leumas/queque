import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

let commit = 'unknown';
try {
  commit = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  // non-git environment (e.g. Homebrew build)
}
const version = (JSON.parse(readFileSync('package.json', 'utf-8')) as { version: string }).version;
// Identifies this exact build: ensureDaemon replaces a daemon from any other build (quick
// 261030-tq3, bug-473). `tsup --watch` evaluates this config once, so watch rebuilds share one
// id; `pnpm build` always gets a new one.
const buildId = `${version}+${commit}.${Date.now().toString(36)}`;

export default defineConfig({
  // Two outputs (quick 261011-jbh, LD-2). main.js is a built-in-only launcher: bin, the zsh
  // widget and the Homebrew symlink point at it. It enables Node's compile cache, then imports
  // app.js, which bundles every dependency (src/cli/main.ts; spawnDaemon re-execs app.js).
  entry: { main: 'src/cli/launcher.ts', app: 'src/cli/main.ts' },
  format: ['esm'],
  outDir: 'dist/cli',
  platform: 'node',
  target: 'node24',
  clean: true,
  sourcemap: true,
  dts: true,
  splitting: false,
  shims: false,
  // Inline every dependency so startup loads one file instead of resolving, reading and
  // compiling ink's dependency tree file by file from node_modules.
  noExternal: [/.*/],
  esbuildOptions(options) {
    // ink's devtools.js imports react-devtools-core statically (only used when DEV=true and the
    // package resolves); esbuild hoists it, so point it at a local no-op shim. esbuild resolves
    // alias targets against the working directory (the repo root for build, vitest and Docker).
    // ws (reached only from that devtools path) requires its optional native add-ons inside
    // try/catch; a shim that throws on load keeps ws's "not installed" fallback while the
    // bundle resolves nothing from node_modules at runtime.
    options.alias = {
      ...options.alias,
      'react-devtools-core': './src/shims/react-devtools-core.ts',
      bufferutil: './src/shims/optional-native-module.ts',
      'utf-8-validate': './src/shims/optional-native-module.ts',
    };
  },
  banner: {
    // CJS dependencies inside the ESM bundle (react, signal-exit, ws) call `require`.
    js: [
      '#!/usr/bin/env node',
      "import { createRequire as __quequeCreateRequire } from 'node:module';",
      'const require = __quequeCreateRequire(import.meta.url);',
    ].join('\n'),
  },
  define: {
    __QUEQUE_COMMIT__: JSON.stringify(commit),
    __QUEQUE_VERSION__: JSON.stringify(version),
    __QUEQUE_BUILD_ID__: JSON.stringify(buildId),
    // D-22: empty until the PostHog project exists. An empty key means nothing is ever sent
    // (resolveTelemetryEndpoint returns null). Plan 13 bakes the real public `phc_` project
    // key after a human decision; QQ_TELEMETRY_KEY overrides it at runtime.
    __QUEQUE_TELEMETRY_KEY__: JSON.stringify(''),
    // D-05: PostHog Cloud EU. QQ_TELEMETRY_HOST overrides it at runtime (tests, forks).
    __QUEQUE_TELEMETRY_HOST__: JSON.stringify('https://eu.i.posthog.com'),
  },
});
