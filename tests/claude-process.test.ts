import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type ClaudeChild,
  type ClaudeTurnFailure,
  type ClaudeTurnOptions,
  type ClaudeTurnStage,
  type ClaudeTurnStageDetail,
  runClaudeTurn,
  STDERR_CAP_BYTES,
  spawnClaudeChild,
} from '../src/providers/claude-process.js';
import { isAbortError } from '../src/providers/provider.js';

// Real child processes only: the fixture replays the recorded Claude Code 2.1.285
// stream-json event shapes (09.1-RESEARCH Probes 2, 3, 5 and 8). No timing thresholds:
// the tests assert stage order and content (bug-206).
const FIXTURE = fileURLToPath(new URL('./fixtures/fake-claude-stream.mjs', import.meta.url));
const PROMPT = 'show me how to use z3';
const SUCCESS_ANSWER = JSON.stringify([
  { command: 'tldr z3', explanation: 'Show concise usage examples for z3' },
  { command: 'z3 -smt2 <file>', explanation: 'ⓘ Solve an SMT-LIB2 file with z3' },
]);

interface StageRecord {
  stage: ClaudeTurnStage;
  detail?: ClaudeTurnStageDetail;
}

const spawnedPids = new Set<number>();
const tmpDirs: string[] = [];

afterEach(() => {
  for (const pid of spawnedPids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
  spawnedPids.clear();
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

function scratchDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'qq-claude-process-'));
  tmpDirs.push(dir);
  return dir;
}

function startTurn(
  scenario: string,
  overrides: Partial<ClaudeTurnOptions> = {},
  onStageHook?: (stage: ClaudeTurnStage) => void,
): { promise: Promise<string>; stages: StageRecord[]; deltas: string[] } {
  const stages: StageRecord[] = [];
  const deltas: string[] = [];
  const promise = runClaudeTurn({
    command: process.execPath,
    argv: [FIXTURE, scenario],
    cwd: process.cwd(),
    env: process.env,
    prompt: PROMPT,
    budgetMs: 20_000,
    onTextDelta: (text) => {
      deltas.push(text);
    },
    onStage: (stage, detail) => {
      stages.push({ stage, detail });
      if (stage === 'spawned' && typeof detail?.pid === 'number') {
        spawnedPids.add(detail.pid);
      }
      onStageHook?.(stage);
    },
    ...overrides,
  });
  return { promise, stages, deltas };
}

function stageNames(stages: StageRecord[]): ClaudeTurnStage[] {
  return stages.map((record) => record.stage);
}

describe('runClaudeTurn', () => {
  it('resolves on the result event, before the child exits', async () => {
    const { promise, stages, deltas } = startTurn('success');

    const text = await promise;
    const atResolve = stageNames(stages);

    expect(text).toBe(SUCCESS_ANSWER);
    expect(atResolve).toEqual(['spawned', 'init', 'first-delta', 'result']);
    expect(atResolve).not.toContain('exit');
    // The ⓘ bytes arrive in two writes; the decoded deltas still rebuild the answer.
    expect(deltas.join('')).toContain('ⓘ Solve an SMT-LIB2 file with z3');
    expect(deltas.join('')).toBe(SUCCESS_ANSWER);

    await vi.waitFor(() => expect(stageNames(stages)).toContain('exit'), { timeout: 5000 });
    expect(stages.find((record) => record.stage === 'exit')?.detail?.code).toBe(0);
  });

  it('sends the prompt as one stream-json user line on stdin and never in argv', async () => {
    const dir = scratchDir();
    const stdinFile = join(dir, 'stdin.txt');
    const argvFile = join(dir, 'argv.json');
    const { promise } = startTurn('success', {
      argv: [FIXTURE, 'success', '-p', '--input-format', 'stream-json'],
      env: { ...process.env, FAKE_CLAUDE_STDIN_FILE: stdinFile, FAKE_CLAUDE_ARGV_FILE: argvFile },
    });

    await promise;

    const stdinText = readFileSync(stdinFile, 'utf8');
    const lines = stdinText.split('\n').filter((line) => line !== '');
    expect(lines).toHaveLength(1);
    expect(stdinText.endsWith('\n')).toBe(true);
    expect(JSON.parse(lines[0] ?? '')).toEqual({
      type: 'user',
      message: { role: 'user', content: PROMPT },
    });
    const childArgv = JSON.parse(readFileSync(argvFile, 'utf8')) as string[];
    expect(childArgv).toEqual(['-p', '--input-format', 'stream-json']);
    expect(childArgv.join(' ')).not.toContain(PROMPT);
  });

  it('aborts with SIGTERM: rejects with an AbortError and drops every later delta', async () => {
    const controller = new AbortController();
    let deltasAtAbort = -1;
    const run = startTurn('sigterm-slow', { signal: controller.signal }, (stage) => {
      if (stage === 'first-delta') {
        setTimeout(() => {
          deltasAtAbort = run.deltas.length;
          controller.abort();
        }, 0);
      }
    });

    const error = await run.promise.catch((caught: unknown) => caught);

    expect(isAbortError(error)).toBe(true);
    expect(stageNames(run.stages)).toContain('aborted');
    // The fixture keeps streaming for 300 ms after SIGTERM, then exits 143 (Probe 8).
    await vi.waitFor(() => expect(stageNames(run.stages)).toContain('exit'), { timeout: 5000 });
    expect(deltasAtAbort).toBeGreaterThan(0);
    expect(run.deltas).toHaveLength(deltasAtAbort);
    expect(run.stages.find((record) => record.stage === 'exit')?.detail?.code).toBe(143);
  });

  it('rejects an is_error result with the result text as stdout and no deltas', async () => {
    const { promise, deltas } = startTurn('auth');

    const error = (await promise.catch((caught: unknown) => caught)) as ClaudeTurnFailure;

    expect(error).toBeInstanceOf(Error);
    expect(error.reason).toBe('is-error');
    expect(error.stdout).toBe('Not logged in · Please run /login');
    expect(error.killed).toBe(false);
    expect(deltas).toEqual([]);
  });
});

// Failure paths (plan 06, D-04/D-13): each ends in the shape claude-default maps to
// today's copy, against a real child. Stage order and failure shapes only, no timings.
describe('runClaudeTurn failure paths', () => {
  it('times out with QueQue flags although claude exits 143, and drops later deltas', async () => {
    let deltasAtReject = -1;
    // sigterm-slow streams for 10 s, so any budget well under that times out mid-stream.
    const run = startTurn('sigterm-slow', { budgetMs: 1000 });

    const error = (await run.promise.catch((caught: unknown) => {
      deltasAtReject = run.deltas.length;
      return caught;
    })) as ClaudeTurnFailure;

    expect(error.reason).toBe('timeout');
    expect(error.killed).toBe(true);
    expect(error.signal).toBe('SIGTERM');
    expect(error.code).toBeNull();
    expect(error.stdout).toBe('');
    // The fixture keeps streaming for 300 ms after SIGTERM, then exits 143 (Probe 8).
    await vi.waitFor(() => expect(stageNames(run.stages)).toContain('exit'), { timeout: 5000 });
    const names = stageNames(run.stages);
    expect(names.indexOf('timed-out')).toBeGreaterThan(-1);
    expect(names.indexOf('timed-out')).toBeLessThan(names.indexOf('exit'));
    expect(run.stages.find((record) => record.stage === 'exit')?.detail?.code).toBe(143);
    expect(run.deltas).toHaveLength(deltasAtReject);
  });

  it('resolves, then the backstop SIGKILLs a child that ignores SIGTERM (hang-after-result)', async () => {
    const { promise, stages, deltas } = startTurn('hang-after-result', {
      backstopMs: 100,
      killGraceMs: 100,
    });

    const text = await promise;
    const deltasAtResolve = deltas.length;

    expect(text).toBe(SUCCESS_ANSWER);
    expect(stageNames(stages)).toEqual(['spawned', 'init', 'first-delta', 'result']);
    await vi.waitFor(() => expect(stageNames(stages)).toContain('exit'), { timeout: 5000 });
    expect(stages.find((record) => record.stage === 'exit')?.detail?.signal).toBe('SIGKILL');
    expect(deltas).toHaveLength(deltasAtResolve);
  }, 10_000);

  it('settles exactly once on hang-after-result: no reject after the backstop kill and close', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      let fulfilled = 0;
      let rejected = 0;
      const { promise, stages } = startTurn('hang-after-result', {
        backstopMs: 100,
        killGraceMs: 100,
      });
      const observed = promise.then(
        () => {
          fulfilled += 1;
        },
        () => {
          rejected += 1;
        },
      );

      await observed;
      // SIGTERM (ignored), SIGKILL, `exit` and `close` all arrive after the resolve.
      await vi.waitFor(() => expect(stageNames(stages)).toContain('exit'), { timeout: 5000 });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(fulfilled).toBe(1);
      expect(rejected).toBe(0);
      expect(stageNames(stages).filter((stage) => stage === 'result')).toHaveLength(1);
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  }, 10_000);

  it('kills a child whose stdout passes 1 MiB without a newline (stdout-flood)', async () => {
    // A short budget only so a missing cap fails fast as `timeout`; the cap fires first.
    const { promise, stages, deltas } = startTurn('stdout-flood', { budgetMs: 3000 });

    const error = (await promise.catch((caught: unknown) => caught)) as ClaudeTurnFailure;

    expect(error.reason).toBe('invalid-result');
    expect(error.message).toBe('Command failed: claude');
    expect(error.killed).toBe(false);
    expect(error.signal).toBeNull();
    expect(error.code).toBeNull();
    expect(error.stdout).toBe('');
    expect(error.sawInit).toBe(true);
    await vi.waitFor(() => expect(stageNames(stages)).toContain('exit'), { timeout: 5000 });
    expect(deltas).toEqual([]);
    expect(stageNames(stages)).not.toContain('timed-out');
  }, 10_000);

  it('rejects an exit without result after init (exit-no-result)', async () => {
    const { promise, deltas } = startTurn('exit-no-result');

    const error = (await promise.catch((caught: unknown) => caught)) as ClaudeTurnFailure;

    expect(error.reason).toBe('exit-without-result');
    expect(error.code).toBe(1);
    expect(error.killed).toBe(false);
    expect(error.stderr).toContain('boom');
    expect(error.stdout).toBe('');
    expect(error.sawInit).toBe(true);
    expect(deltas).toEqual([]);
  });

  it('rejects a death before init with sawInit false (die-before-init)', async () => {
    const { promise, stages } = startTurn('die-before-init');

    const error = (await promise.catch((caught: unknown) => caught)) as ClaudeTurnFailure;

    expect(error.reason).toBe('exit-without-result');
    expect(error.code).toBe(1);
    expect(error.stdout).toBe('');
    expect(error.sawInit).toBe(false);
    expect(stageNames(stages)).not.toContain('init');
  });

  it('rejects a missing binary with ENOENT and spawn-error, and no spawned stage', async () => {
    const { promise, stages } = startTurn('success', { command: '/nonexistent/claude-qq-test' });

    const error = (await promise.catch((caught: unknown) => caught)) as ClaudeTurnFailure;

    expect(error.code).toBe('ENOENT');
    expect(error.reason).toBe('spawn-error');
    expect(stageNames(stages)).not.toContain('spawned');
  });

  it('rejects a zero budget with the timeout shape and spawns nothing', async () => {
    const { promise, stages } = startTurn('success', { budgetMs: 0 });

    const error = (await promise.catch((caught: unknown) => caught)) as ClaudeTurnFailure;

    expect(error.reason).toBe('timeout');
    expect(error.killed).toBe(true);
    expect(error.signal).toBe('SIGTERM');
    expect(error.code).toBeNull();
    expect(stages).toEqual([]);
  });

  it('rejects an already-aborted signal with an AbortError and spawns nothing', async () => {
    const controller = new AbortController();
    controller.abort();
    const { promise, stages } = startTurn('success', { signal: controller.signal });

    const error = await promise.catch((caught: unknown) => caught);

    expect(isAbortError(error)).toBe(true);
    expect(stages).toEqual([]);
  });

  it('caps the collected stderr at STDERR_CAP_BYTES (stderr-flood)', async () => {
    const { promise } = startTurn('stderr-flood');

    const error = (await promise.catch((caught: unknown) => caught)) as ClaudeTurnFailure;

    expect(error.reason).toBe('exit-without-result');
    expect(error.code).toBe(1);
    expect(error.stderr?.length ?? 0).toBeGreaterThan(0);
    expect(error.stderr?.length ?? 0).toBeLessThanOrEqual(STDERR_CAP_BYTES);
    expect(Buffer.byteLength(error.stderr ?? '', 'utf8')).toBeLessThanOrEqual(STDERR_CAP_BYTES);
  });
});

// Prewarmed child (plan 05, D-11/D-13): the turn runs on a child spawned earlier and left
// idle, the way claude-prewarm.ts hands it over. Real fixture children only.
describe('runClaudeTurn on a prewarmed child', () => {
  function idleChild(scenario: string, env: NodeJS.ProcessEnv = process.env): ClaudeChild {
    const child = spawnClaudeChild(process.execPath, [FIXTURE, scenario], process.cwd(), env);
    if (typeof child.pid === 'number') {
      spawnedPids.add(child.pid);
    }
    return child;
  }

  it('answers on an idle child without spawning, with exactly one stdin user line', async () => {
    const dir = scratchDir();
    const stdinFile = join(dir, 'stdin.txt');
    const child = idleChild('success', { ...process.env, FAKE_CLAUDE_STDIN_FILE: stdinFile });
    await new Promise((resolve) => setTimeout(resolve, 300));

    const { promise, stages } = startTurn('success', { child });
    const text = await promise;

    expect(text).toBe(SUCCESS_ANSWER);
    expect(stageNames(stages)).toEqual(['init', 'first-delta', 'result']);
    const lines = readFileSync(stdinFile, 'utf8')
      .split('\n')
      .filter((line) => line !== '');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '')).toEqual({
      type: 'user',
      message: { role: 'user', content: PROMPT },
    });
  });

  it('rejects at once with exit-without-result when the child has already exited', async () => {
    const child = idleChild('success');
    const exited = new Promise((resolve) => {
      child.once('exit', resolve);
    });
    child.stdin.end();
    await exited;

    const { promise, stages } = startTurn('success', { child, budgetMs: 60_000 });
    const error = (await promise.catch((caught: unknown) => caught)) as ClaudeTurnFailure;

    expect(error.reason).toBe('exit-without-result');
    expect(error.sawInit).toBe(false);
    expect(stages).toEqual([]);
  });

  it('terminates the child and rejects with an AbortError when the signal is already aborted', async () => {
    const child = idleChild('success');
    const exited = new Promise((resolve) => {
      child.once('exit', resolve);
    });
    const controller = new AbortController();
    controller.abort();

    const { promise } = startTurn('success', { child, signal: controller.signal });
    const error = await promise.catch((caught: unknown) => caught);

    expect(isAbortError(error)).toBe(true);
    await exited;
    // Killed by the runner (SIGTERM), not a clean stdin-EOF exit.
    expect(child.signalCode).toBe('SIGTERM');
  });
});
