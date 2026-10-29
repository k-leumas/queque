import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextEnvelope } from '../src/contracts/request.js';
import { fetchClaudeCliCandidates } from '../src/providers/claude-cli.js';
import { disablePrewarm, enablePrewarm, prewarmSnapshot } from '../src/providers/claude-prewarm.js';

// Phase 10 D-04 (folded 09.1 todo "stale prewarm after laptop sleep"): the real pool and the
// real runner against real fixture children. A `claude` shim on PATH execs
// fake-claude-stream.mjs, so fetchClaudeCliCandidates spawns exactly what it would in the
// daemon. Only the debug log is mocked (to read the stage lines) and only `Date` is faked
// (to age the idle child past PREWARM_BOOT_ALLOWANCE_MS); every timer and child is real.
const { appendDebugLogMock } = vi.hoisted(() => ({
  appendDebugLogMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/shared/debug-log.js', () => ({
  appendDebugLog: appendDebugLogMock,
}));

const FIXTURE = fileURLToPath(new URL('./fixtures/fake-claude-stream.mjs', import.meta.url));
const BUDGET_MS = 25_000;
const CASE_TIMEOUT_MS = 15_000;

const trackedPids = new Set<number>();
const tmpDirs: string[] = [];
let savedPath: string | undefined;
let savedForceSelector: string | undefined;
let queryCwd = '';

function scratchDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/** An executable `claude` on PATH that runs the fixture's `success` scenario. */
function installClaudeShim(): string {
  const dir = scratchDir('qq-prewarm-sleep-bin-');
  const shim = join(dir, 'claude');
  writeFileSync(shim, `#!/bin/sh\nexec "${process.execPath}" "${FIXTURE}" success "$@"\n`);
  chmodSync(shim, 0o755);
  return dir;
}

/** A fixed cwd, so both queries in a case build the same prewarm key. */
function buildEnvelope(): ContextEnvelope {
  return {
    base: {
      queryText: 'how do I use z3',
      cwd: queryCwd,
      ttyPath: '/dev/tty',
      shellPid: 1234,
      shellName: 'zsh',
      platform: 'darwin',
      timestamp: '2026-10-29T00:00:00.000Z',
    },
    extras: [],
  };
}

function query() {
  return fetchClaudeCliCandidates(buildEnvelope(), BUDGET_MS);
}

function messages(): string[] {
  return appendDebugLogMock.mock.calls
    .filter((call) => call[0] === 'provider')
    .map((call) => String(call[1]));
}

function detailFor(message: string): unknown {
  return appendDebugLogMock.mock.calls.find(
    (call) => call[0] === 'provider' && call[1] === message,
  )?.[2];
}

/** The idle child's pid once the slot holds a child other than `previous`. */
async function idlePid(previous?: number): Promise<number> {
  let pid: number | undefined;
  await vi.waitFor(
    () => {
      const snapshot = prewarmSnapshot();
      expect(snapshot.state).toBe('idle');
      expect(typeof snapshot.pid).toBe('number');
      expect(snapshot.pid).not.toBe(previous);
      pid = snapshot.pid;
    },
    { timeout: 5000, interval: 20 },
  );
  trackedPids.add(pid as number);
  return pid as number;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
      return false;
    }
    throw error;
  }
}

/** Resolves once `pid` is gone (signalled, exited and reaped). */
async function waitUntilGone(pid: number): Promise<void> {
  await vi.waitFor(
    () => {
      expect(isAlive(pid)).toBe(false);
    },
    { timeout: 5000, interval: 25 },
  );
}

/** Runs one query so the `finally` refill leaves an idle child; returns its pid. */
async function primeSlot(): Promise<number> {
  const first = await query();
  expect(first).toHaveLength(2);
  const pid = await idlePid();
  appendDebugLogMock.mockClear();
  return pid;
}

beforeEach(() => {
  appendDebugLogMock.mockClear();
  savedPath = process.env.PATH;
  savedForceSelector = process.env.QQ_FORCE_SELECTOR;
  process.env.PATH = `${installClaudeShim()}${delimiter}${savedPath ?? ''}`;
  // Cerebrum 2026-10-17: a worktree otherwise picks up the main checkout's env file.
  process.env.QQ_FORCE_SELECTOR = '0';
  queryCwd = scratchDir('qq-prewarm-sleep-cwd-');
  enablePrewarm();
});

afterEach(() => {
  vi.useRealTimers();
  disablePrewarm();
  for (const pid of trackedPids) {
    try {
      // A stopped child cannot act on anything but SIGKILL; wake it first anyway.
      process.kill(pid, 'SIGCONT');
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
  trackedPids.clear();
  if (savedPath === undefined) {
    delete process.env.PATH;
  } else {
    process.env.PATH = savedPath;
  }
  if (savedForceSelector === undefined) {
    delete process.env.QQ_FORCE_SELECTOR;
  } else {
    process.env.QQ_FORCE_SELECTOR = savedForceSelector;
  }
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

describe('prewarm after laptop sleep (D-04)', () => {
  it(
    'takes a child that was stopped and continued (sleep then wake) and refills the slot',
    async () => {
      const pid = await primeSlot();

      process.kill(pid, 'SIGSTOP');
      process.kill(pid, 'SIGCONT');

      const candidates = await query();

      expect(candidates).toHaveLength(2);
      expect(messages()).toContain('prewarm hit');
      expect(messages()).not.toContain('prewarm retry cold');
      expect(messages()).not.toContain('cli init timed out');
      await idlePid(pid);
    },
    CASE_TIMEOUT_MS,
  );

  it(
    'detects a child still frozen past its boot allowance, kills it and runs cold',
    async () => {
      const pid = await primeSlot();

      process.kill(pid, 'SIGSTOP');
      // Age the idle child: warmInitDeadlineMs reads Date.now(), so a clock 60 s past its
      // spawn leaves only WARM_INIT_DEADLINE_MS of real setTimeout before it counts as stale.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(Date.now() + 60_000);

      const candidates = await query();

      expect(candidates).toHaveLength(2);
      const log = messages();
      const hit = log.indexOf('prewarm hit');
      const initTimedOut = log.indexOf('cli init timed out');
      const retryCold = log.indexOf('prewarm retry cold');
      expect(hit).toBeGreaterThanOrEqual(0);
      expect(initTimedOut).toBeGreaterThan(hit);
      expect(retryCold).toBeGreaterThan(initTimedOut);
      expect(detailFor('cli init timed out')).toMatchObject({ warm: true });

      // terminateChild's SIGTERM stays pending on a stopped child; the SIGKILL after the
      // grace period ends it.
      await waitUntilGone(pid);
      const refilled = await idlePid(pid);
      expect(refilled).not.toBe(pid);
    },
    CASE_TIMEOUT_MS,
  );

  it(
    'misses with dead when the idle child was killed out from under the daemon',
    async () => {
      const pid = await primeSlot();

      process.kill(pid, 'SIGKILL');
      await waitUntilGone(pid);
      await vi.waitFor(
        () => {
          expect(prewarmSnapshot().state).toBe('empty');
        },
        { timeout: 5000, interval: 20 },
      );

      const candidates = await query();

      expect(candidates).toHaveLength(2);
      expect(messages()).not.toContain('prewarm hit');
      expect(detailFor('prewarm miss')).toEqual({ reason: 'dead' });
      await idlePid(pid);
    },
    CASE_TIMEOUT_MS,
  );
});
