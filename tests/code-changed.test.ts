import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = resolve(__dirname, '..', 'scripts', 'ci', 'code-changed.mjs');
const ZERO_SHA = '0'.repeat(40);

const repos: string[] = [];

function git(cwd: string, args: string[]): string {
  const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function writeFiles(cwd: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    const full = join(cwd, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

/** A repo on branch `topic` (no main/master ref) with one base commit; returns the base SHA. */
function makeRepo(): { cwd: string; base: string } {
  const cwd = mkdtempSync(join(tmpdir(), 'qq-code-changed-'));
  repos.push(cwd);
  git(cwd, ['init', '-q', '-b', 'topic']);
  writeFiles(cwd, { 'src/b.ts': 'export const b = 1;\n', 'README.md': '# r\n' });
  git(cwd, ['add', '-A']);
  git(cwd, ['commit', '-q', '-m', 'base']);
  return { cwd, base: git(cwd, ['rev-parse', 'HEAD']) };
}

function commitAll(cwd: string): void {
  git(cwd, ['add', '-A']);
  git(cwd, ['commit', '-q', '-m', 'change']);
}

/** Runs the script; returns the `code=` line it appended to GITHUB_OUTPUT and its stdout. */
function run(
  cwd: string,
  base: string | undefined,
): { output: string; stdout: string; status: number | null } {
  const outFile = join(cwd, '..', `${cwd.split('/').pop()}-github-output`);
  writeFileSync(outFile, '');
  repos.push(outFile);
  const env: NodeJS.ProcessEnv = { ...process.env, GITHUB_OUTPUT: outFile };
  delete env.QQ_CHANGES_BASE;
  delete env.QQ_BASE_REF;
  delete env.GITHUB_BASE_REF;
  if (base !== undefined) env.QQ_CHANGES_BASE = base;
  const result = spawnSync(process.execPath, [SCRIPT], { cwd, env, encoding: 'utf8' });
  return {
    output: readFileSync(outFile, 'utf8').trim(),
    stdout: result.stdout,
    status: result.status,
  };
}

afterEach(() => {
  for (const path of repos.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('scripts/ci/code-changed.mjs', () => {
  it('writes code=false when only docs and planning files changed', () => {
    const { cwd, base } = makeRepo();
    writeFiles(cwd, {
      'README.md': '# changed\n',
      '.planning/x.md': 'plan\n',
      '.wolf/memory.md': 'memory\n',
      'docs/a.txt': 'doc\n',
    });
    commitAll(cwd);

    const result = run(cwd, base);

    expect(result.output).toBe('code=false');
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^code=false \(4 changed paths, base [0-9a-f]{7,}\)$/m);
  });

  it('writes code=true when a source file changed', () => {
    const { cwd, base } = makeRepo();
    writeFiles(cwd, { 'src/a.ts': 'export const a = 1;\n', 'README.md': '# also docs\n' });
    commitAll(cwd);

    expect(run(cwd, base).output).toBe('code=true');
  });

  it('writes code=true when a workflow file changed', () => {
    const { cwd, base } = makeRepo();
    writeFiles(cwd, { '.github/workflows/ci.yml': 'name: CI\n' });
    commitAll(cwd);

    expect(run(cwd, base).output).toBe('code=true');
  });

  it('writes code=true when a source file was deleted', () => {
    const { cwd, base } = makeRepo();
    git(cwd, ['rm', '-q', 'src/b.ts']);
    git(cwd, ['commit', '-q', '-m', 'delete']);

    expect(run(cwd, base).output).toBe('code=true');
  });

  it('writes code=true (fail open) for an all-zeros base with no main or master ref', () => {
    const { cwd } = makeRepo();
    writeFiles(cwd, { 'docs/a.txt': 'doc\n' });
    commitAll(cwd);

    const result = run(cwd, ZERO_SHA);

    expect(result.output).toBe('code=true');
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^code=true/m);
  });

  it('writes code=true (fail open) for a base SHA the repo does not have', () => {
    const { cwd } = makeRepo();
    writeFiles(cwd, { 'docs/a.txt': 'doc\n' });
    commitAll(cwd);

    const result = run(cwd, 'deadbeef'.repeat(5));

    expect(result.output).toBe('code=true');
    expect(result.status).toBe(0);
  });

  it('falls back to the merge base with main when the base is all zeros', () => {
    const { cwd } = makeRepo();
    git(cwd, ['branch', 'main']);
    writeFiles(cwd, { '.planning/y.md': 'plan\n' });
    commitAll(cwd);

    expect(run(cwd, ZERO_SHA).output).toBe('code=false');
  });

  it('diffs a push (no base) against the merge base with main, not the last push (WR-04)', () => {
    // Push A changes code (its run was cancelled or failed), push B changes docs only:
    // B must still run everything, because the branch carries untested code against main.
    const { cwd } = makeRepo();
    git(cwd, ['branch', 'main']);
    writeFiles(cwd, { 'src/a.ts': 'export const a = 1;\n' });
    commitAll(cwd);
    const pushA = git(cwd, ['rev-parse', 'HEAD']);
    writeFiles(cwd, { 'docs/a.txt': 'doc\n' });
    commitAll(cwd);

    // What the old `github.event.before` base reported for push B: a false doc-only green.
    expect(run(cwd, pushA).output).toBe('code=false');
    // What ci.yml now passes for a push: an empty base.
    expect(run(cwd, '').output).toBe('code=true');
    expect(run(cwd, undefined).output).toBe('code=true');
  });

  it('runs everything on main itself, where the merge base is HEAD (WR-04)', () => {
    const { cwd } = makeRepo();
    git(cwd, ['checkout', '-q', '-b', 'main']);
    writeFiles(cwd, { 'docs/a.txt': 'doc\n' });
    commitAll(cwd);

    const result = run(cwd, '');

    expect(result.output).toBe('code=true');
    expect(result.status).toBe(0);
  });

  it('runs everything when the explicit base is HEAD itself', () => {
    const { cwd } = makeRepo();
    expect(run(cwd, git(cwd, ['rev-parse', 'HEAD'])).output).toBe('code=true');
  });

  it('writes code=true and exits 0 outside a git repository', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'qq-code-changed-nogit-'));
    repos.push(cwd);

    const result = run(cwd, undefined);

    expect(result.output).toBe('code=true');
    expect(result.status).toBe(0);
  });
});
