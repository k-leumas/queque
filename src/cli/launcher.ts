/**
 * CLI launcher, built as dist/cli/main.js (quick 261011-jbh, LD-2).
 *
 * bin, the zsh widget and the Homebrew symlink all point at main.js. This file imports only
 * Node built-ins: it enables Node's module compile cache in a per-user directory, then loads
 * the bundled app (dist/cli/app.js, built from src/cli/main.ts with every dependency inlined)
 * and runs it. The compile cache only covers modules compiled after it is enabled, and a
 * single-file bundle is compiled before any of its code runs, so the cache has to be enabled
 * here, before app.js is imported.
 *
 * The cache dir is `${XDG_CACHE_HOME:-~/.cache}/queque/node-compile-cache`, never Node's default
 * under os.tmpdir() (shared /tmp on Linux, where another local user could plant cache files).
 * It is used only when both it and its `queque` parent are real directories (not symlinks)
 * owned by this user with no group or world write bit. Any failure leaves the cache off and
 * prints nothing, so `--help`, the daemon and the client's debug-log stderr stay clean.
 * NODE_COMPILE_CACHE / NODE_DISABLE_COMPILE_CACHE are Node's own switches and win.
 */
import { lstatSync, mkdirSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

/** Group or world write permission bits. */
const SHARED_WRITE_BITS = 0o022;

/** True when `path` is a real directory owned by `uid` that nobody else can write to. */
function isPrivateDirectory(path: string, uid: number): boolean {
  const stats = lstatSync(path);
  return (
    stats.isDirectory() &&
    !stats.isSymbolicLink() &&
    stats.uid === uid &&
    (stats.mode & SHARED_WRITE_BITS) === 0
  );
}

/** Enables the per-user compile cache when it is safe to; silent on every failure. */
function enablePerUserCompileCache(): void {
  try {
    if (
      process.env.NODE_COMPILE_CACHE !== undefined ||
      process.env.NODE_DISABLE_COMPILE_CACHE !== undefined
    ) {
      return;
    }
    const enableCompileCache = (nodeModule as { enableCompileCache?: unknown }).enableCompileCache;
    if (typeof enableCompileCache !== 'function' || typeof process.getuid !== 'function') {
      return;
    }
    const xdgCacheHome = process.env.XDG_CACHE_HOME;
    const cacheRoot =
      xdgCacheHome !== undefined && isAbsolute(xdgCacheHome)
        ? xdgCacheHome
        : join(homedir(), '.cache');
    const appDir = join(cacheRoot, 'queque');
    const cacheDir = join(appDir, 'node-compile-cache');
    mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
    const uid = process.getuid();
    if (!isPrivateDirectory(appDir, uid) || !isPrivateDirectory(cacheDir, uid)) {
      return;
    }
    (enableCompileCache as (directory: string) => unknown)(cacheDir);
  } catch {
    // The cache is an optimisation: never let it change what the user sees.
  }
}

enablePerUserCompileCache();

// A runtime-computed specifier on purpose: esbuild neither inlines app.js into this launcher
// nor needs it to exist at build time.
const appUrl = new URL('./app.js', import.meta.url).href;

try {
  const app = (await import(appUrl)) as typeof import('./main.js');
  await app.main();
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
