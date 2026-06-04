import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Regression tests for bug-159 (commit a46d7a5):
//
// isDirectRun used process.argv[1] (symlink path, e.g. /usr/local/bin/qq) but
// import.meta.url resolves to the real Cellar path — they never matched so
// main() was never called from the Homebrew binary.
//
// Fix: wrap process.argv[1] in fs.realpathSync() before comparison.
// This mirrors the logic in src/cli/main.ts exactly.
// ---------------------------------------------------------------------------

function buildIsDirectRun(
  argv1: string | undefined,
  metaUrl: string,
  realpathSync: (p: string) => string,
): boolean {
  return argv1 ? metaUrl === new URL(`file://${realpathSync(argv1)}`).href : false;
}

const CELLAR_REAL =
  '/usr/local/Cellar/queque/0.2.13/libexec/node_modules/@k-leumas/queque-cli/dist/cli/main.js';
const HOMEBREW_SYMLINK = '/usr/local/bin/qq';
const META_URL = `file://${CELLAR_REAL}`;

describe('isDirectRun — symlink resolution (bug-159 regression)', () => {
  it('returns true when argv[1] equals the real path (dev / npm global install)', () => {
    expect(buildIsDirectRun(CELLAR_REAL, META_URL, (p) => p)).toBe(true);
  });

  it('returns false without realpathSync when argv[1] is a symlink — pre-fix Homebrew failure', () => {
    // Documents the exact failure mode: bare symlink path never equals import.meta.url
    expect(buildIsDirectRun(HOMEBREW_SYMLINK, META_URL, (p) => p)).toBe(false);
  });

  it('returns true when realpathSync resolves the symlink to the real path — post-fix', () => {
    const resolveSymlink = (p: string) => (p === HOMEBREW_SYMLINK ? CELLAR_REAL : p);
    expect(buildIsDirectRun(HOMEBREW_SYMLINK, META_URL, resolveSymlink)).toBe(true);
  });

  it('returns false when argv[1] is undefined', () => {
    expect(buildIsDirectRun(undefined, META_URL, (p) => p)).toBe(false);
  });

  it('URL construction round-trips correctly for both symlink and real paths', () => {
    const real = '/opt/homebrew/Cellar/queque/1.0.0/lib/node_modules/qq/dist/cli/main.js';
    const symlink = '/opt/homebrew/bin/qq';
    const url = `file://${real}`;

    // With realpathSync resolving: symlink → real — isDirectRun should be true
    expect(buildIsDirectRun(symlink, url, () => real)).toBe(true);
    // Without resolution: isDirectRun should be false
    expect(buildIsDirectRun(symlink, url, (p) => p)).toBe(false);
  });
});
