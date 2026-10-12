import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextEnvelope } from '../src/contracts/request.js';
import { buildClaudeCliArgv, fetchClaudeCliCandidates } from '../src/providers/claude-cli.js';
import type { PrewarmSpec, PrewarmTake } from '../src/providers/claude-prewarm.js';
import type { ClaudeChild, ClaudeTurnOptions } from '../src/providers/claude-process.js';
import { abortError, isAbortError } from '../src/providers/provider.js';
import { resetQqConfigCache } from '../src/shared/qq-config.js';

// Call-order tests for claude-cli's warm/cold selection (09.1-05, D-11/D-12/D-13). The
// runner and the pool are mocked because these tests check which calls happen in which
// order, not the provider; the pool and runner have their own real-child tests.
const CANDIDATE_JSON = '[{"command":"git status","explanation":"Show repo status"}]';
const FORBIDDEN_DEBUG = /"args"|"env"|"argv"|"stdout"|"stderr"|apiKey|sk-ant-|sk-|token/i;

const { runClaudeTurnMock, takePrewarmedMock, schedulePrewarmMock, appendDebugLogMock, order } =
  vi.hoisted(() => ({
    runClaudeTurnMock: vi.fn<(options: ClaudeTurnOptions) => Promise<string>>(),
    takePrewarmedMock: vi.fn<(spec: PrewarmSpec) => PrewarmTake>(),
    schedulePrewarmMock: vi.fn<(spec: PrewarmSpec) => void>(),
    appendDebugLogMock: vi.fn().mockResolvedValue(undefined),
    order: [] as string[],
  }));

vi.mock('../src/providers/claude-process.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/providers/claude-process.js')>();
  return { ...actual, runClaudeTurn: runClaudeTurnMock };
});

vi.mock('../src/providers/claude-prewarm.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/providers/claude-prewarm.js')>();
  return { ...actual, takePrewarmed: takePrewarmedMock, schedulePrewarm: schedulePrewarmMock };
});

vi.mock('../src/shared/debug-log.js', () => ({
  appendDebugLog: appendDebugLogMock,
}));

const FAKE_CHILD = { pid: 4242 } as unknown as ClaudeChild;

function buildEnvelope(cwd = '/repo'): ContextEnvelope {
  return {
    base: {
      queryText: 'status',
      cwd,
      ttyPath: '/dev/tty',
      shellPid: 1234,
      shellName: 'zsh',
      platform: 'darwin',
      timestamp: '2026-05-02T00:00:00.000Z',
    },
    extras: [],
  };
}

function expectedSpec(envelope: ContextEnvelope): PrewarmSpec {
  return { command: 'claude', argv: buildClaudeCliArgv(envelope), cwd: envelope.base.cwd };
}

/** The runner's failure shape for a child that ended without a `result`. */
function exitWithoutResult(): Error {
  return Object.assign(new Error('Command failed: claude'), {
    code: 1,
    killed: false,
    signal: null,
    stdout: '',
    stderr: '',
    reason: 'exit-without-result',
    sawInit: false,
  });
}

function isErrorFailure(): Error {
  return Object.assign(new Error('Command failed: claude'), {
    code: 1,
    killed: false,
    signal: null,
    stdout: 'Not logged in · Please run /login',
    stderr: '',
    reason: 'is-error',
    sawInit: true,
  });
}

function timeoutFailure(): Error {
  return Object.assign(new Error('Command timed out: claude'), {
    killed: true,
    signal: 'SIGTERM',
    code: null,
    stdout: '',
    stderr: '',
    reason: 'timeout',
    sawInit: true,
  });
}

function runOptions(index: number): ClaudeTurnOptions {
  const options = runClaudeTurnMock.mock.calls[index]?.[0];
  if (!options) {
    throw new Error(`runClaudeTurn call ${index} missing`);
  }
  return options;
}

function providerLog(message: string): Record<string, unknown> | undefined | null {
  const call = appendDebugLogMock.mock.calls.find(
    (entry) => entry[0] === 'provider' && entry[1] === message,
  );
  return call ? ((call[2] as Record<string, unknown> | undefined) ?? undefined) : null;
}

let configDir: string;
let previousConfigFile: string | undefined;

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), 'qq-cli-prewarm-config-'));
  previousConfigFile = process.env.QQ_CONFIG_FILE;
  process.env.QQ_CONFIG_FILE = join(configDir, 'config.json');
  resetQqConfigCache();
  order.length = 0;
  runClaudeTurnMock.mockReset();
  takePrewarmedMock.mockReset();
  schedulePrewarmMock.mockReset();
  appendDebugLogMock.mockClear();
  takePrewarmedMock.mockImplementation(() => {
    order.push('take');
    return { child: FAKE_CHILD };
  });
  schedulePrewarmMock.mockImplementation(() => {
    order.push('schedule');
  });
});

afterEach(() => {
  resetQqConfigCache();
  if (previousConfigFile === undefined) {
    delete process.env.QQ_CONFIG_FILE;
  } else {
    process.env.QQ_CONFIG_FILE = previousConfigFile;
  }
  rmSync(configDir, { recursive: true, force: true });
});

/** Each runClaudeTurn call runs the next behaviour; every call is recorded in `order`. */
function runTurns(...behaviours: Array<(options: ClaudeTurnOptions) => Promise<string>>): void {
  let index = 0;
  runClaudeTurnMock.mockImplementation(async (options) => {
    order.push(options.child ? 'run warm' : 'run cold');
    const behaviour = behaviours[index] ?? behaviours[behaviours.length - 1];
    index += 1;
    if (!behaviour) {
      throw new Error('no behaviour');
    }
    return behaviour(options);
  });
}

describe('claude -p prewarm selection (D-11, D-12, D-13)', () => {
  it('runs a hit on the prewarmed child, logs prewarm hit, then refills with the same spec', async () => {
    runTurns(async (options) => {
      options.onStage?.('init');
      return CANDIDATE_JSON;
    });
    const envelope = buildEnvelope();

    const result = await fetchClaudeCliCandidates(envelope, 25_000);

    expect(result).toEqual([{ command: 'git status', explanation: 'Show repo status' }]);
    expect(takePrewarmedMock).toHaveBeenCalledWith(expectedSpec(envelope));
    expect(runOptions(0).child).toBe(FAKE_CHILD);
    expect(runOptions(0).argv).toEqual(buildClaudeCliArgv(envelope));
    expect(runOptions(0).cwd).toBe('/repo');
    expect(providerLog('prewarm hit')).not.toBeNull();
    expect(providerLog('cli init')).toEqual(expect.objectContaining({ warm: true }));
    expect(schedulePrewarmMock).toHaveBeenCalledTimes(1);
    expect(schedulePrewarmMock).toHaveBeenCalledWith(expectedSpec(envelope));
    expect(order).toEqual(['take', 'run warm', 'schedule']);
  });

  it('runs a miss cold, logs the miss reason, and prewarms for this query after it settles', async () => {
    takePrewarmedMock.mockImplementation(() => {
      order.push('take');
      return { miss: 'cwd' };
    });
    runTurns(async (options) => {
      options.onStage?.('init');
      return CANDIDATE_JSON;
    });
    const envelope = buildEnvelope('/elsewhere');

    await fetchClaudeCliCandidates(envelope, 25_000);

    expect(runOptions(0).child).toBeUndefined();
    expect(providerLog('prewarm miss')).toEqual({ reason: 'cwd' });
    expect(providerLog('cli init')).toEqual(expect.objectContaining({ warm: false }));
    expect(schedulePrewarmMock).toHaveBeenCalledWith(expectedSpec(envelope));
    expect(order).toEqual(['take', 'run cold', 'schedule']);
  });

  it('rejects an aborted warm turn with the AbortError and still refills the slot', async () => {
    runTurns(async () => {
      throw abortError();
    });

    const error = await fetchClaudeCliCandidates(buildEnvelope(), 25_000).catch(
      (caught: unknown) => caught,
    );

    expect(isAbortError(error)).toBe(true);
    expect(order).toEqual(['take', 'run warm', 'schedule']);
  });

  it('retries a warm exit-without-result once cold within the remaining budget', async () => {
    runTurns(
      async () => {
        throw exitWithoutResult();
      },
      async () => CANDIDATE_JSON,
    );

    const result = await fetchClaudeCliCandidates(buildEnvelope(), 25_000);

    expect(result).toEqual([{ command: 'git status', explanation: 'Show repo status' }]);
    expect(order).toEqual(['take', 'run warm', 'run cold', 'schedule']);
    expect(runOptions(1).child).toBeUndefined();
    expect(runOptions(1).budgetMs).toBeGreaterThan(0);
    expect(runOptions(1).budgetMs).toBeLessThanOrEqual(25_000);
    expect(providerLog('prewarm retry cold')).not.toBeNull();
  });

  it('does not retry an exit-without-result after a candidate was streamed', async () => {
    const onCandidate = vi.fn();
    runTurns(async (options) => {
      options.onTextDelta?.('[{"command":"git status","explanation":"Show repo status"},');
      throw exitWithoutResult();
    });

    const error = (await fetchClaudeCliCandidates(buildEnvelope(), 25_000, { onCandidate }).catch(
      (caught: unknown) => caught,
    )) as { reason?: string };

    expect(onCandidate).toHaveBeenCalledTimes(1);
    expect(error.reason).toBe('exit-without-result');
    expect(order).toEqual(['take', 'run warm', 'schedule']);
    expect(providerLog('prewarm retry cold')).toBeNull();
  });

  it('does not retry an exit-without-result once the signal has aborted', async () => {
    const controller = new AbortController();
    runTurns(async () => {
      controller.abort();
      throw exitWithoutResult();
    });

    await fetchClaudeCliCandidates(buildEnvelope(), 25_000, { signal: controller.signal }).catch(
      () => undefined,
    );

    expect(order).toEqual(['take', 'run warm', 'schedule']);
  });

  it.each([
    ['is-error', isErrorFailure],
    ['timeout', timeoutFailure],
    ['abort', abortError],
  ])('never retries a warm %s failure', async (_name, failure) => {
    runTurns(async () => {
      throw failure();
    });

    await fetchClaudeCliCandidates(buildEnvelope(), 25_000).catch(() => undefined);

    expect(runClaudeTurnMock).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['take', 'run warm', 'schedule']);
  });

  it('logs no prompt, argv, stdout or stderr in prewarm and stage lines', async () => {
    runTurns(
      async (options) => {
        options.onStage?.('init');
        throw exitWithoutResult();
      },
      async (options) => {
        options.onStage?.('spawned', { pid: 99 });
        return CANDIDATE_JSON;
      },
    );

    await fetchClaudeCliCandidates(buildEnvelope(), 25_000);

    const logged = JSON.stringify(appendDebugLogMock.mock.calls);
    expect(logged).toContain('prewarm hit');
    expect(logged).toContain('prewarm retry cold');
    expect(logged).not.toMatch(FORBIDDEN_DEBUG);
    expect(logged).not.toContain('status');
  });
});
