import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Phase 10 (10-12 drill): git exports GIT_DIR (and friends) into hook processes run from a
// linked worktree. lefthook's pre-push runs this suite, and the fixture-repo tests passed that
// env on to their child git processes, so `git init --bare`, `git commit` and `git branch` hit
// the real repository (core.bare=true, junk commits on the worktree branch). This runs those
// suites in a child vitest with a hook-like GIT_DIR pointing at a sentinel repo and checks the
// sentinel is untouched. tests/setup/scrub-git-env.ts is what keeps it untouched.

const ROOT = resolve(__dirname, '..');
const FIXTURE_SUITES = ['tests/code-changed.test.ts', 'tests/auto-revert.test.ts'];
const GIT_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};

let sentinel: string;

function git(args: string[], env: NodeJS.ProcessEnv = GIT_ENV): string {
  const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd: sentinel,
    encoding: 'utf8',
    env,
  });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function snapshot(): string {
  return [
    git(['rev-parse', '--is-bare-repository']),
    git(['for-each-ref', '--format=%(refname) %(objectname)']),
    git(['remote']),
  ].join('\n');
}

beforeAll(() => {
  sentinel = mkdtempSync(join(tmpdir(), 'qq-git-sentinel-'));
  git(['init', '-q', '-b', 'trunk']);
  writeFileSync(join(sentinel, 'sentinel.txt'), 'untouched\n');
  git(['add', 'sentinel.txt']);
  git(['commit', '-q', '-m', 'sentinel']);
});

afterAll(() => {
  rmSync(sentinel, { recursive: true, force: true });
});

describe('fixture git tests under a hook-exported GIT_DIR', () => {
  it('never touch the repository GIT_DIR points at', { timeout: 180_000 }, () => {
    const before = snapshot();
    const result = spawnSync(
      process.execPath,
      [join(ROOT, 'node_modules', 'vitest', 'vitest.mjs'), 'run', ...FIXTURE_SUITES],
      {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, GIT_DIR: join(sentinel, '.git'), GIT_WORK_TREE: sentinel },
      },
    );
    expect(snapshot()).toBe(before);
    expect(result.status, result.stdout.slice(-2000)).toBe(0);
  });
});
