import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { isBuiltin } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, type Options } from 'tsup';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import tsupConfig from '../tsup.config.js';

// ---------------------------------------------------------------------------
// Regression test for the blank `??` modal before the loading frame
// (.planning/debug/modal-blank-before-loading.md, quick 261011-jbh LD-2).
//
// The client cannot draw anything until Node has loaded every module that
// dist/cli/main.js imports statically. When the build left dependencies
// external, that meant resolving, reading and compiling ink's whole dependency
// tree file by file from node_modules: about 2.5 s of CPU before the first
// Ink frame, and 4-17 s of blank pane under heavy machine load. The build now
// emits two files: main.js, a launcher that imports only Node built-ins,
// enables Node's module compile cache in a per-user directory and then loads
// app.js, which bundles every dependency.
//
// The test builds with the real tsup config into a temp dir (no node_modules
// next to it) and checks:
//   1. every emitted file statically imports nothing but Node built-ins;
//   2. both files start on their own (`--help` evaluates every module's top
//      level code: ink, yoga, react, zod, cac);
//   3. the compile cache lands in a 0700 per-user dir, and an unwritable or
//      world-writable cache location changes nothing visible.
// No timing assertions: wall time flakes under load; static imports do not.
// ---------------------------------------------------------------------------

const BUILD_TIMEOUT_MS = 180_000;

/** The usage line `qq --help` prints. */
const USAGE_LINE = '$ qq <command> [options]';

/** The per-user compile cache dir under a cache home (the launcher's contract). */
function compileCacheDir(cacheHome: string): string {
  return join(cacheHome, 'queque', 'node-compile-cache');
}

function baseConfig(): Options {
  const config: unknown = tsupConfig;
  if (Array.isArray(config) || typeof config === 'function' || config === null) {
    throw new Error('tsup.config.ts must export a single options object');
  }
  return config as Options;
}

/**
 * Module specifiers an ESM file can load at runtime by name: top-level static `import`
 * statements, literal dynamic `import("…")` calls and esbuild's `__require("…")` calls.
 */
function moduleSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /^import\s[^;]*?\sfrom\s*["']([^"']+)["']/gm,
    /^import\s*["']([^"']+)["']/gm,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
    /\b__require\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1] !== undefined) {
        specifiers.push(match[1]);
      }
    }
  }
  return specifiers;
}

/** Every file under `dir`, recursively. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

/** The environment of a run: Node's own cache switches removed, a chosen cache home. */
function runEnv(cacheHome: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, XDG_CACHE_HOME: cacheHome, ...extra };
  if (!('NODE_COMPILE_CACHE' in extra)) delete env.NODE_COMPILE_CACHE;
  if (!('NODE_DISABLE_COMPILE_CACHE' in extra)) delete env.NODE_DISABLE_COMPILE_CACHE;
  return env;
}

describe('CLI bundle startup (blank modal before the loading frame)', () => {
  let outDir = '';
  let mainPath = '';
  let appPath = '';
  let scratch = '';

  /** Runs `node <file> --help` from outDir (no node_modules). */
  function help(file: string, env: NodeJS.ProcessEnv): SpawnSyncReturns<string> {
    return spawnSync(process.execPath, [file, '--help'], {
      cwd: outDir,
      encoding: 'utf8',
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: BUILD_TIMEOUT_MS,
    });
  }

  /** A fresh, empty cache home in the scratch dir. */
  function freshCacheHome(): string {
    return mkdtempSync(join(scratch, 'cache-'));
  }

  /** The `--help` run with the cache disabled: the stderr every other run must match. */
  function baselineStderr(): string {
    const run = help(mainPath, runEnv(freshCacheHome(), { NODE_DISABLE_COMPILE_CACHE: '1' }));
    expect(run.status, run.stderr).toBe(0);
    return run.stderr;
  }

  beforeAll(async () => {
    outDir = await mkdtemp(join(tmpdir(), 'qq-bundle-'));
    scratch = await mkdtemp(join(tmpdir(), 'qq-bundle-cache-'));
    await build({
      ...baseConfig(),
      config: false,
      outDir,
      dts: false,
      sourcemap: false,
      clean: false,
      silent: true,
    });
    mainPath = join(outDir, 'main.js');
    appPath = join(outDir, 'app.js');
  }, BUILD_TIMEOUT_MS);

  afterAll(async () => {
    if (scratch) {
      // b4 leaves a read-only dir behind if it fails half way; make it removable.
      for (const entry of readdirSync(scratch)) chmodSync(join(scratch, entry), 0o700);
      await rm(scratch, { recursive: true, force: true });
    }
    if (outDir) {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it('statically imports only Node built-ins (no file-by-file node_modules loading)', async () => {
    const emitted = (await readdir(outDir)).filter((name) => name.endsWith('.js')).sort();
    const specifiers: string[] = [];
    for (const name of emitted) {
      specifiers.push(...moduleSpecifiers(await readFile(join(outDir, name), 'utf8')));
    }
    expect(specifiers.length).toBeGreaterThan(0);
    const external = [...new Set(specifiers.filter((specifier) => !isBuiltin(specifier)))];
    expect(external.join(', ')).toBe('');
    expect(emitted).toEqual(['app.js', 'main.js']);
  });

  it(
    'b2/b3: main.js starts with no node_modules, adds no output, and fills a 0700 per-user cache',
    () => {
      const stderr = baselineStderr();
      const cacheHome = freshCacheHome();
      const run = help(mainPath, runEnv(cacheHome));
      expect(run.status, run.stderr.split('\n').slice(0, 6).join(' | ')).toBe(0);
      expect(run.stdout).toContain(USAGE_LINE);
      expect(run.stderr).toBe(stderr);

      const cacheDir = compileCacheDir(cacheHome);
      expect(statSync(cacheDir).isDirectory()).toBe(true);
      expect(statSync(cacheDir).mode & 0o777).toBe(0o700);
      expect(filesUnder(cacheDir).length).toBeGreaterThan(0);
    },
    BUILD_TIMEOUT_MS,
  );

  it.skipIf(process.getuid?.() === 0)(
    'b4: an unwritable cache home changes nothing visible and creates no cache dir',
    () => {
      const stderr = baselineStderr();
      const reference = help(mainPath, runEnv(freshCacheHome()));
      const cacheHome = freshCacheHome();
      chmodSync(cacheHome, 0o500);
      try {
        const run = help(mainPath, runEnv(cacheHome));
        expect(run.status, run.stderr).toBe(0);
        expect(run.stdout).toBe(reference.stdout);
        expect(run.stderr).toBe(stderr);
        expect(existsSync(join(cacheHome, 'queque'))).toBe(false);
      } finally {
        chmodSync(cacheHome, 0o700);
      }
    },
    BUILD_TIMEOUT_MS,
  );

  it(
    'b5: a world-writable cache dir is not used',
    () => {
      const cacheHome = freshCacheHome();
      const cacheDir = compileCacheDir(cacheHome);
      mkdirSync(cacheDir, { recursive: true });
      chmodSync(cacheDir, 0o777);
      const run = help(mainPath, runEnv(cacheHome));
      expect(run.status, run.stderr).toBe(0);
      expect(run.stdout).toContain(USAGE_LINE);
      expect(statSync(cacheDir).mode & 0o777).toBe(0o777);
      expect(filesUnder(cacheDir)).toEqual([]);
    },
    BUILD_TIMEOUT_MS,
  );

  it(
    'b6: app.js (what spawnDaemon re-execs) also starts on its own',
    () => {
      const run = help(appPath, runEnv(freshCacheHome()));
      expect(run.status, run.stderr.split('\n').slice(0, 6).join(' | ')).toBe(0);
      expect(run.stdout).toContain(USAGE_LINE);
    },
    BUILD_TIMEOUT_MS,
  );
});
