import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// D-15 auto-revert: scripts/ci/auto-revert.sh runs against real temp git repos (a bare
// remote plus a work clone). Only `gh` is replaced, by tests/fixtures/auto-revert/gh: it is
// a test double for the GitHub REST API (logs argv, serves fixture JSON), not a stub of
// anything the script itself is responsible for.

const SCRIPT = resolve(__dirname, '..', 'scripts', 'ci', 'auto-revert.sh');
const GH_STUB = resolve(__dirname, 'fixtures', 'auto-revert', 'gh');
const ZERO_SHA = '0'.repeat(40);
const RUN_URL = 'https://github.com/k-leumas/queque/actions/runs/200';
const ESC = '\u001b';
// The script is bash by design (it runs on ubuntu-24.04 runners). Alpine images have no
// bash, so the distro test legs skip this file there.
const HAS_BASH = spawnSync('bash', ['-c', 'exit 0']).status === 0;
const TEST_TIMEOUT_MS = 60_000;

/**
 * The head branch auto-revert.sh uses for `branch`: `/` replaced by `-`, plus the first 8 hex
 * digits of the git blob hash of the exact name, so feat/x and feat-x never share one (WR-05).
 */
function revertBranch(branch: string): string {
  const blob = Buffer.from(branch, 'utf8');
  const hash = createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${blob.length}\0`), blob]))
    .digest('hex');
  return `auto-revert/${branch.replaceAll('/', '-')}-${hash.slice(0, 8)}`;
}

const REVERT_FEAT_X = revertBranch('feat/x');
// Command substitution a careless `eval` or unquoted expansion would run: it creates `pwned`.
const SHELL_SYNTAX = ['$(touch', '{IFS}pwned)'].join('$');

// Isolated from the developer's git config (commit signing, hooks, default branch).
const GIT_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_TERMINAL_PROMPT: '0',
};

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function git(cwd: string, args: string[]): string {
  const result = spawnSync(
    'git',
    ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'init.defaultBranch=main', ...args],
    { cwd, encoding: 'utf8', env: GIT_ENV },
  );
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function writeFiles(cwd: string, files: Record<string, string>): void {
  for (const [file, content] of Object.entries(files)) {
    const full = join(cwd, file);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

function commit(cwd: string, files: Record<string, string>, message: string): string {
  writeFiles(cwd, files);
  git(cwd, ['add', '-A']);
  git(cwd, ['commit', '-q', '-m', message]);
  return git(cwd, ['rev-parse', 'HEAD']);
}

interface Fixture {
  root: string;
  remote: string;
  work: string;
  fixtures: string;
  artifacts: string;
  bin: string;
  ghLog: string;
  /** M0 base on main, G green on feat/x, M1 docs on main, MERGE (main into feat/x), H broken. */
  sha: { m0: string; g: string; m1: string; merge: string; h: string };
}

interface FixtureOptions {
  /** H also edits .github/workflows/ci.yml (the workflow token cannot push that). */
  touchWorkflow?: boolean;
}

function smokeJob(image: string, conclusion: string | null) {
  return { name: `distro / smoke (${image})`, conclusion };
}

function makeFixture(options: FixtureOptions = {}): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'qq-auto-revert-'));
  roots.push(root);
  const remote = join(root, 'remote.git');
  const work = join(root, 'work');
  const fixtures = join(root, 'gh-fixtures');
  const artifacts = join(root, 'artifacts');
  const bin = join(root, 'bin');
  for (const dir of [work, fixtures, artifacts, bin]) {
    mkdirSync(dir, { recursive: true });
  }
  git(root, ['init', '-q', '--bare', remote]);
  git(work, ['init', '-q', '-b', 'main']);
  git(work, ['remote', 'add', 'origin', remote]);

  const m0 = commit(
    work,
    {
      'src/a.ts': 'export const a = 0;\n',
      'README.md': '# queque\n',
      '.github/workflows/ci.yml': 'name: CI\n',
    },
    'base',
  );
  git(work, ['push', '-q', 'origin', 'main']);
  git(work, ['switch', '-q', '-c', 'feat/x']);
  const g = commit(work, { 'src/a.ts': 'export const a = 1; // green\n' }, 'green');
  git(work, ['switch', '-q', 'main']);
  const m1 = commit(work, { 'docs/m.md': 'main docs\n' }, 'docs on main');
  git(work, ['push', '-q', 'origin', 'main']);
  git(work, ['switch', '-q', 'feat/x']);
  git(work, ['merge', '-q', '--no-ff', '-m', 'merge main', 'main']);
  const merge = git(work, ['rev-parse', 'HEAD']);
  const broken: Record<string, string> = {
    'src/a.ts': 'export const a = 2; // broken\n',
    'src/new.ts': 'export const added = true;\n',
  };
  if (options.touchWorkflow) {
    broken['.github/workflows/ci.yml'] = 'name: CI\n# edited after green\n';
  }
  const h = commit(work, broken, 'broken');
  git(work, ['push', '-q', 'origin', 'feat/x']);

  const ghLog = join(root, 'gh.log');
  copyFileSync(GH_STUB, join(bin, 'gh'));
  chmodSync(join(bin, 'gh'), 0o755);

  const f: Fixture = {
    root,
    remote,
    work,
    fixtures,
    artifacts,
    bin,
    ghLog,
    sha: { m0, g, m1, merge, h },
  };
  // Current run 200: one smoke leg failed. Branch run 100 at G: smoke passed.
  writeJson(f, 'jobs-200.json', {
    jobs: [
      { name: 'changes', conclusion: 'success' },
      { name: 'checks', conclusion: 'success' },
      { name: 'distro / test-distro (alpine:3.24)', conclusion: 'success' },
      smokeJob('alpine:3.24', 'failure'),
      smokeJob('debian:13', 'success'),
      { name: 'auto-revert', conclusion: null },
    ],
  });
  writeJson(f, 'branch-runs.json', { workflow_runs: [{ id: 100, head_sha: g }] });
  writeJson(f, 'jobs-100.json', {
    jobs: [smokeJob('alpine:3.24', 'success'), smokeJob('debian:13', 'success')],
  });
  writeArtifacts(f, 'alpine:3.24');
  return f;
}

function writeJson(f: Fixture, name: string, value: unknown): void {
  writeFileSync(join(f.fixtures, name), `${JSON.stringify(value)}\n`);
}

function slug(image: string): string {
  return image.replace(/[:/]/g, '-');
}

/** Smoke artifacts for IMAGE; `extraLogs` more PTY logs push the body past its cap. */
function writeArtifacts(f: Fixture, image: string, lineWidth = 0, extraLogs = 0): void {
  const dir = join(f.artifacts, `smoke-${slug(image)}`);
  mkdirSync(dir, { recursive: true });
  const pad = lineWidth > 0 ? ` ${'x'.repeat(lineWidth)}` : '';
  const lines = Array.from({ length: 100 }, (_, i) => `pty line ${i + 1}${pad}`);
  writeFiles(dir, {
    'image.txt': `${image}\n`,
    'doctor.json': `${JSON.stringify({
      version: 1,
      checks: [{ id: 'zsh', status: 'fail', summary: `doctor-mark ${image}` }],
    })}\n`,
    'pty-default.log': `${lines.join('\r\n')}\r\n${ESC}[31mRED-MARK${ESC}[0m${ESC}]0;title\u0007\r\n`,
    'qq-debug.log': `debug-mark ${image}${pad}\n`,
  });
  for (let i = 1; i <= extraLogs; i++) {
    writeFiles(dir, { [`pty-extra-${i}.log`]: `${lines.join('\n')}\n` });
  }
}

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function run(f: Fixture, env: Record<string, string> = {}): RunResult {
  const result = spawnSync('bash', [SCRIPT], {
    cwd: f.work,
    encoding: 'utf8',
    timeout: TEST_TIMEOUT_MS - 5_000,
    env: {
      ...GIT_ENV,
      PATH: `${f.bin}:${process.env.PATH ?? ''}`,
      REPO: 'k-leumas/queque',
      BRANCH: 'feat/x',
      HEAD_SHA: f.sha.h,
      BEFORE_SHA: f.sha.merge,
      RUN_ID: '200',
      RUN_URL,
      ARTIFACTS_DIR: f.artifacts,
      REMOTE: 'origin',
      GH_LOG: f.ghLog,
      GH_FIXTURES: f.fixtures,
      ...env,
    },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function ghCalls(f: Fixture): string[][] {
  if (!existsSync(f.ghLog)) return [];
  return readFileSync(f.ghLog, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as string[]);
}

function prCalls(f: Fixture, sub?: string): string[][] {
  return ghCalls(f).filter((argv) => argv[0] === 'pr' && (sub === undefined || argv[1] === sub));
}

function body(f: Fixture): string {
  return readFileSync(`${f.ghLog}.body`, 'utf8');
}

function hasFlag(argv: string[], flag: string, value: string): boolean {
  return argv.some((arg, i) => arg === flag && argv[i + 1] === value);
}

function remoteHasBranch(f: Fixture, branch: string): boolean {
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], {
    cwd: f.remote,
    env: GIT_ENV,
  });
  return result.status === 0;
}

/** Code points of control characters other than newline and tab. */
function controlChars(text: string): number[] {
  const found: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if ((code < 0x20 && code !== 0x0a && code !== 0x09) || code === 0x7f) found.push(code);
  }
  return found;
}

function tree(cwd: string, rev: string): string {
  return git(cwd, ['rev-parse', `${rev}^{tree}`]);
}

describe.skipIf(!HAS_BASH)('scripts/ci/auto-revert.sh', () => {
  it(
    'restores the last green tree on auto-revert/feat-x-HASH and opens one PR with diagnostics',
    () => {
      const f = makeFixture();
      const result = run(f);
      expect(result.stderr).not.toMatch(/unbound variable|command not found/);
      expect(result.status, result.stderr).toBe(0);

      expect(tree(f.remote, `refs/heads/${REVERT_FEAT_X}`)).toBe(tree(f.work, f.sha.g));
      const files = git(f.remote, ['ls-tree', '-r', '--name-only', `refs/heads/${REVERT_FEAT_X}`]);
      expect(files.split('\n')).not.toContain('src/new.ts');
      expect(git(f.remote, ['rev-parse', `refs/heads/${REVERT_FEAT_X}^`])).toBe(f.sha.h);
      expect(git(f.remote, ['rev-parse', 'refs/heads/feat/x'])).toBe(f.sha.h);

      const creates = prCalls(f, 'create');
      expect(creates.length).toBe(1);
      expect(hasFlag(creates[0], '--base', 'feat/x')).toBe(true);
      expect(hasFlag(creates[0], '--head', REVERT_FEAT_X)).toBe(true);
      expect(prCalls(f, 'edit').length).toBe(0);

      const api = ghCalls(f).filter((argv) => argv[0] === 'api');
      expect(
        api.some((argv) => argv[1].includes('branch=feat%2Fx&event=push&status=success')),
      ).toBe(true);

      const text = body(f);
      expect(text).toContain('alpine:3.24');
      expect(text).not.toContain('debian:13');
      expect(text).toContain(RUN_URL);
      expect(text).toContain(f.sha.g);
      expect(text).toContain('doctor-mark alpine:3.24');
      expect(text).toContain('debug-mark alpine:3.24');
      expect(text).toContain('pty line 100');
      expect(text).toMatch(/^pty line 22$/m);
      expect(text).not.toMatch(/^pty line 21$/m);
      expect(text).toContain('RED-MARK');
      expect(text).toMatch(/approve/i);
      // ANSI escapes and other control characters are stripped; newline and tab survive.
      expect(controlChars(text)).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'edits and comments on the open PR instead of opening another',
    () => {
      const f = makeFixture();
      writeFileSync(join(f.fixtures, 'pr-list.txt'), '7\n');
      const result = run(f);
      expect(result.status, result.stderr).toBe(0);
      expect(prCalls(f, 'create').length).toBe(0);
      expect(prCalls(f, 'edit').filter((argv) => argv[2] === '7').length).toBe(1);
      const comments = prCalls(f, 'comment').filter((argv) => argv[2] === '7');
      expect(comments.length).toBe(1);
      expect(comments[0].join(' ')).toContain(f.sha.h.slice(0, 7));
      expect(tree(f.remote, `refs/heads/${REVERT_FEAT_X}`)).toBe(tree(f.work, f.sha.g));
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'gives feat/x and feat-x separate head branches and only edits a PR with the same base (WR-05)',
    () => {
      const f = makeFixture();
      expect(run(f).status).toBe(0);
      const second = run(f, { BRANCH: 'feat-x' });
      expect(second.status, second.stderr).toBe(0);

      expect(revertBranch('feat-x')).not.toBe(REVERT_FEAT_X);
      expect(remoteHasBranch(f, REVERT_FEAT_X)).toBe(true);
      expect(remoteHasBranch(f, revertBranch('feat-x'))).toBe(true);
      expect(remoteHasBranch(f, 'auto-revert/feat-x')).toBe(false);

      const lists = prCalls(f, 'list');
      expect(lists.length).toBe(2);
      expect(hasFlag(lists[0], '--head', REVERT_FEAT_X)).toBe(true);
      expect(hasFlag(lists[0], '--base', 'feat/x')).toBe(true);
      expect(hasFlag(lists[1], '--head', revertBranch('feat-x'))).toBe(true);
      expect(hasFlag(lists[1], '--base', 'feat-x')).toBe(true);

      const creates = prCalls(f, 'create');
      expect(creates.length).toBe(2);
      expect(hasFlag(creates[1], '--base', 'feat-x')).toBe(true);
      expect(hasFlag(creates[1], '--head', revertBranch('feat-x'))).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'passes over a newer successful run whose smoke jobs were skipped',
    () => {
      const f = makeFixture();
      writeJson(f, 'branch-runs.json', {
        workflow_runs: [
          { id: 150, head_sha: f.sha.merge },
          { id: 100, head_sha: f.sha.g },
        ],
      });
      // A doc-only push: the reusable distro workflow is skipped as a whole.
      writeJson(f, 'jobs-150.json', {
        jobs: [
          { name: 'changes', conclusion: 'success' },
          { name: 'checks', conclusion: 'skipped' },
          { name: 'distro', conclusion: 'skipped' },
          { name: 'ci-ok', conclusion: 'success' },
        ],
      });
      const result = run(f);
      expect(result.status, result.stderr).toBe(0);
      expect(
        ghCalls(f).some((argv) => argv[0] === 'api' && argv[1].includes('/runs/150/jobs')),
      ).toBe(true);
      expect(tree(f.remote, `refs/heads/${REVERT_FEAT_X}`)).toBe(tree(f.work, f.sha.g));
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'falls back to the nearest first-parent ancestor with a green run on any branch',
    () => {
      const f = makeFixture();
      writeJson(f, 'branch-runs.json', { workflow_runs: [] });
      writeJson(f, `sha-runs-${f.sha.g}.json`, { workflow_runs: [{ id: 100, head_sha: f.sha.g }] });
      // M1 is only the merge's second parent: a first-parent walk must never reach it.
      writeJson(f, `sha-runs-${f.sha.m1}.json`, {
        workflow_runs: [{ id: 101, head_sha: f.sha.m1 }],
      });
      writeJson(f, 'jobs-101.json', { jobs: [smokeJob('alpine:3.24', 'success')] });
      const result = run(f);
      expect(result.status, result.stderr).toBe(0);
      expect(
        ghCalls(f).some((argv) => argv[0] === 'api' && argv[1].includes(`head_sha=${f.sha.g}`)),
      ).toBe(true);
      expect(tree(f.remote, `refs/heads/${REVERT_FEAT_X}`)).toBe(tree(f.work, f.sha.g));
      expect(body(f)).toMatch(/ancestor/i);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'falls back to the push before SHA when no green run exists',
    () => {
      const f = makeFixture();
      writeJson(f, 'branch-runs.json', { workflow_runs: [] });
      const result = run(f, { BEFORE_SHA: f.sha.g });
      expect(result.status, result.stderr).toBe(0);
      expect(tree(f.remote, `refs/heads/${REVERT_FEAT_X}`)).toBe(tree(f.work, f.sha.g));
      expect(body(f)).toMatch(/before/i);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'falls back to the merge base with main on a non-main branch',
    () => {
      const f = makeFixture();
      writeJson(f, 'branch-runs.json', { workflow_runs: [] });
      const result = run(f, { BEFORE_SHA: ZERO_SHA });
      expect(result.status, result.stderr).toBe(0);
      // main was merged into feat/x, so the merge base is main's tip M1.
      expect(tree(f.remote, `refs/heads/${REVERT_FEAT_X}`)).toBe(tree(f.work, f.sha.m1));
      expect(body(f)).toMatch(/merge base/i);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'opens no PR when only test-distro failed',
    () => {
      const f = makeFixture();
      writeJson(f, 'jobs-200.json', {
        jobs: [
          { name: 'distro / test-distro (alpine:3.24)', conclusion: 'failure' },
          smokeJob('alpine:3.24', 'success'),
        ],
      });
      const result = run(f);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('no smoke failure in this run; nothing to revert');
      expect(prCalls(f).length).toBe(0);
      expect(remoteHasBranch(f, REVERT_FEAT_X)).toBe(false);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'never reverts a push to an auto-revert branch (no revert-of-revert)',
    () => {
      const f = makeFixture();
      const result = run(f, { BRANCH: 'auto-revert/feat-x' });
      expect(result.status, result.stderr).toBe(0);
      expect(ghCalls(f).length).toBe(0);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'warns and reverts nothing on main with no green base',
    () => {
      const f = makeFixture();
      writeJson(f, 'branch-runs.json', { workflow_runs: [] });
      const result = run(f, { BRANCH: 'main', HEAD_SHA: f.sha.m1, BEFORE_SHA: ZERO_SHA });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('::warning::');
      expect(prCalls(f).length).toBe(0);
      expect(remoteHasBranch(f, revertBranch('main'))).toBe(false);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'rejects an invalid branch name before any gh call',
    () => {
      const f = makeFixture();
      const result = run(f, { BRANCH: 'feat/x..y' });
      expect(result.status, result.stderr).toBe(1);
      expect(ghCalls(f).length).toBe(0);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'never executes shell syntax in a branch name',
    () => {
      const f = makeFixture();
      // A valid ref name, so the script runs end to end with it.
      const branch = `feat/${SHELL_SYNTAX}`;
      const result = run(f, { BRANCH: branch });
      expect(result.status, result.stderr).toBe(0);
      expect(existsSync(join(f.work, 'pwned'))).toBe(false);
      expect(existsSync(join(f.root, 'pwned'))).toBe(false);
      expect(remoteHasBranch(f, revertBranch(branch))).toBe(true);
      const creates = prCalls(f, 'create');
      expect(creates.length).toBe(1);
      expect(hasFlag(creates[0], '--base', branch)).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'keeps workflow files at HEAD, since the workflow token cannot push workflow changes',
    () => {
      const f = makeFixture({ touchWorkflow: true });
      const result = run(f);
      expect(result.status, result.stderr).toBe(0);
      const ref = `refs/heads/${REVERT_FEAT_X}`;
      expect(git(f.remote, ['show', `${ref}:.github/workflows/ci.yml`])).toBe(
        git(f.work, ['show', `${f.sha.h}:.github/workflows/ci.yml`]),
      );
      expect(git(f.remote, ['show', `${ref}:src/a.ts`])).toBe(
        git(f.work, ['show', `${f.sha.g}:src/a.ts`]),
      );
      expect(body(f)).toContain('.github/workflows');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'caps the body below the GitHub limit and keeps code fences balanced',
    () => {
      const f = makeFixture();
      const images = [
        'ubuntu:22.04',
        'ubuntu:24.04',
        'debian:13',
        'fedora:44',
        'archlinux:latest',
        'alpine:3.24',
      ];
      writeJson(f, 'jobs-200.json', { jobs: images.map((image) => smokeJob(image, 'failure')) });
      for (const image of images) {
        writeArtifacts(f, image, 400, 6);
      }
      const result = run(f);
      expect(result.status, result.stderr).toBe(0);
      const text = body(f);
      expect(text.length).toBeLessThanOrEqual(60_000);
      expect(text).toMatch(/truncated/i);
      const fences = text.split('\n').filter((line) => line.startsWith('````')).length;
      expect(fences % 2).toBe(0);
    },
    TEST_TIMEOUT_MS,
  );
});
