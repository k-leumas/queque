import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  disablePrewarm,
  enablePrewarm,
  type PrewarmSpec,
  prewarmKey,
  prewarmSnapshot,
  retirePrewarmed,
  schedulePrewarm,
  takePrewarmed,
} from '../src/providers/claude-prewarm.js';

// Pool tests against real fixture children (09.1-05, D-11/D-12). spawnClaudeChild is
// wrapped in a pass-through spy only to count spawn attempts; every child is real.
const { appendDebugLogMock, spawnSpy } = vi.hoisted(() => ({
  appendDebugLogMock: vi.fn().mockResolvedValue(undefined),
  spawnSpy: vi.fn(),
}));

vi.mock('../src/shared/debug-log.js', () => ({
  appendDebugLog: appendDebugLogMock,
}));

vi.mock('../src/providers/claude-process.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/providers/claude-process.js')>();
  spawnSpy.mockImplementation(actual.spawnClaudeChild);
  return { ...actual, spawnClaudeChild: spawnSpy };
});

const FIXTURE = fileURLToPath(new URL('./fixtures/fake-claude-stream.mjs', import.meta.url));

const trackedPids = new Set<number>();
const tmpDirs: string[] = [];

function scratchDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'qq-claude-prewarm-'));
  tmpDirs.push(dir);
  return dir;
}

function spec(overrides: Partial<PrewarmSpec> = {}, scenario = 'success'): PrewarmSpec {
  return {
    command: process.execPath,
    argv: [FIXTURE, scenario, '--effort', 'low', '--system-prompt', 'steered prompt'],
    cwd: process.cwd(),
    ...overrides,
  };
}

/** The idle child's pid once the slot holds a spawned child. */
function idlePid(): number {
  const snapshot = prewarmSnapshot();
  expect(snapshot.state).toBe('idle');
  const pid = snapshot.pid;
  if (typeof pid !== 'number') {
    throw new Error('prewarm slot has no pid');
  }
  trackedPids.add(pid);
  return pid;
}

interface ExitLog {
  pid?: number;
  code?: number | null;
  signal?: string | null;
}

/** The pool's `prewarm exit` debug line for `pid`, once it has been logged. */
async function exitLogFor(pid: number): Promise<ExitLog> {
  let found: ExitLog | undefined;
  await vi.waitFor(
    () => {
      found = appendDebugLogMock.mock.calls
        .filter((call) => call[0] === 'provider' && call[1] === 'prewarm exit')
        .map((call) => call[2] as ExitLog)
        .find((detail) => detail.pid === pid);
      expect(found).toBeDefined();
    },
    { timeout: 5000 },
  );
  return found as ExitLog;
}

function messages(): string[] {
  return appendDebugLogMock.mock.calls.map((call) => String(call[1]));
}

beforeEach(() => {
  appendDebugLogMock.mockClear();
  spawnSpy.mockClear();
});

afterEach(() => {
  disablePrewarm();
  for (const pid of trackedPids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
  trackedPids.clear();
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

describe('prewarmKey (D-12)', () => {
  it('is equal for equal command, cwd and argv', () => {
    expect(prewarmKey(spec())).toBe(prewarmKey(spec()));
    expect(prewarmKey(spec())).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs when the cwd or any argv element differs', () => {
    const base = prewarmKey(spec());
    expect(prewarmKey(spec({ cwd: '/elsewhere' }))).not.toBe(base);
    expect(
      prewarmKey(
        spec({
          argv: [FIXTURE, 'success', '--effort', 'high', '--system-prompt', 'steered prompt'],
        }),
      ),
    ).not.toBe(base);
    expect(
      prewarmKey(
        spec({ argv: [FIXTURE, 'success', '--effort', 'low', '--system-prompt', 'other prompt'] }),
      ),
    ).not.toBe(base);
  });
});

describe('prewarm pool disabled (default)', () => {
  it('misses with disabled and spawns nothing', () => {
    expect(takePrewarmed(spec())).toEqual({ miss: 'disabled' });
    schedulePrewarm(spec());
    expect(prewarmSnapshot()).toEqual({ enabled: false, state: 'empty' });
    expect(spawnSpy).not.toHaveBeenCalled();
  });
});

describe('prewarm pool enabled', () => {
  beforeEach(() => {
    enablePrewarm();
  });

  it('keeps one idle child, reuses it for the same spec, and hands it over on a hit', () => {
    schedulePrewarm(spec());
    const pid = idlePid();
    expect(messages()).toContain('prewarm spawned');

    schedulePrewarm(spec());
    expect(prewarmSnapshot().pid).toBe(pid);
    expect(spawnSpy).toHaveBeenCalledTimes(1);

    const take = takePrewarmed(spec());
    expect('child' in take && take.child.pid).toBe(pid);
    expect(prewarmSnapshot()).toEqual({ enabled: true, state: 'empty' });
  });

  it('misses with empty when nothing is prewarmed', () => {
    expect(takePrewarmed(spec())).toEqual({ miss: 'empty' });
  });

  it('misses with cwd for another cwd and retires the old child with a clean stdin-EOF exit', async () => {
    schedulePrewarm(spec());
    const pid = idlePid();

    expect(takePrewarmed(spec({ cwd: scratchDir() }))).toEqual({ miss: 'cwd' });
    expect(prewarmSnapshot().state).toBe('empty');

    const exit = await exitLogFor(pid);
    expect(exit.code).toBe(0);
    expect(exit.signal).toBeNull();
  });

  it('misses with prompt when the argv differs', async () => {
    schedulePrewarm(spec());
    const pid = idlePid();

    const other = spec({
      argv: [FIXTURE, 'success', '--effort', 'low', '--system-prompt', 'another steered prompt'],
    });
    expect(takePrewarmed(other)).toEqual({ miss: 'prompt' });
    expect(prewarmSnapshot().state).toBe('empty');
    expect((await exitLogFor(pid)).code).toBe(0);
  });

  it('misses with dead after the idle child is killed from outside, and does not respawn', async () => {
    schedulePrewarm(spec());
    const pid = idlePid();

    process.kill(pid, 'SIGKILL');
    await exitLogFor(pid);
    expect(prewarmSnapshot().state).toBe('empty');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(takePrewarmed(spec())).toEqual({ miss: 'dead' });
    expect(takePrewarmed(spec())).toEqual({ miss: 'empty' });
    expect(spawnSpy).toHaveBeenCalledTimes(1);
  });

  it('retires the idle child on stdin EOF: exit code 0 and an empty slot', async () => {
    schedulePrewarm(spec());
    const pid = idlePid();

    retirePrewarmed();

    expect(prewarmSnapshot().state).toBe('empty');
    expect(messages()).toContain('prewarm retired');
    const exit = await exitLogFor(pid);
    expect(exit.code).toBe(0);
    expect(exit.signal).toBeNull();
  });

  it('SIGKILLs a retired child that ignores stdin EOF after the grace period (ignore-eof)', async () => {
    schedulePrewarm(spec({}, 'ignore-eof'));
    const pid = idlePid();

    retirePrewarmed(100);

    expect(prewarmSnapshot().state).toBe('empty');
    const exit = await exitLogFor(pid);
    expect(exit.signal).toBe('SIGKILL');
  });

  it('clears the slot without throwing when the command is missing, with one spawn attempt', async () => {
    expect(() => {
      schedulePrewarm(spec({ command: '/nonexistent/claude-qq-test' }));
    }).not.toThrow();

    await vi.waitFor(() => expect(prewarmSnapshot().state).toBe('empty'), { timeout: 5000 });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(spawnSpy).toHaveBeenCalledTimes(1);
    expect(prewarmSnapshot().state).toBe('empty');
  });
});
