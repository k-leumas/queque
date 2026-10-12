import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextEnvelope } from '../src/contracts/request.js';
import { resetAnthropicClientCache } from '../src/providers/claude.js';
import type {
  ClaudeTurnOptions,
  ClaudeTurnStage,
  ClaudeTurnStageDetail,
} from '../src/providers/claude-process.js';
import { abortError, isAbortError } from '../src/providers/provider.js';
import { bootstrapBuiltins, resetBootstrap } from '../src/registry/bootstrap.js';
import {
  clearProviderBackends,
  getProviderAdapter,
  listProviderBackends,
} from '../src/registry/provider-backends.js';
import { resetQqConfigCache } from '../src/shared/qq-config.js';

const CANDIDATE_JSON = '[{"command":"git status","explanation":"Show repo status"}]';
const D13_LOGIN = /claude \/login/;
const D13_KEY = /ANTHROPIC_API_KEY/;
const FORBIDDEN_DEBUG = /"args"|"env"|"argv"|"stdout"|"stderr"|apiKey|sk-ant-|sk-|token/i;

const {
  createMock,
  anthropicCtorMock,
  AnthropicMock,
  runClaudeTurnMock,
  readEnvValueFromDotEnvLocalMock,
  appendDebugLogMock,
} = vi.hoisted(() => {
  const createMock = vi.fn();
  const anthropicCtorMock = vi.fn();

  class AnthropicMock {
    messages: { create: typeof createMock };

    constructor(options: unknown) {
      anthropicCtorMock(options);
      this.messages = {
        create: createMock,
      };
    }
  }

  return {
    createMock,
    anthropicCtorMock,
    AnthropicMock,
    runClaudeTurnMock: vi.fn<(options: ClaudeTurnOptions) => Promise<string>>(),
    readEnvValueFromDotEnvLocalMock: vi.fn<(key: string, startDir?: string) => string | null>(),
    appendDebugLogMock: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: AnthropicMock,
}));

// Only runClaudeTurn is replaced; exports added by later plans stay real.
vi.mock('../src/providers/claude-process.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/providers/claude-process.js')>();
  return {
    ...actual,
    runClaudeTurn: runClaudeTurnMock,
  };
});

vi.mock('../src/shared/env-file.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/shared/env-file.js')>();
  return {
    ...actual,
    readEnvValueFromDotEnvLocal: readEnvValueFromDotEnvLocalMock,
  };
});

vi.mock('../src/shared/debug-log.js', () => ({
  appendDebugLog: appendDebugLogMock,
}));

function buildEnvelope(extras: ContextEnvelope['extras'] = []): ContextEnvelope {
  return {
    base: {
      queryText: 'status',
      cwd: '/repo',
      ttyPath: '/dev/tty',
      shellPid: 1234,
      shellName: 'zsh',
      platform: 'darwin',
      timestamp: '2026-05-02T00:00:00.000Z',
    },
    extras,
  };
}

function gitEnvelopeWithSecretFile(): ContextEnvelope {
  return buildEnvelope([
    {
      kind: 'git',
      payload: {
        cwd: '/repo',
        root: '/repo',
        branch: 'main',
        dirty: true,
        changedFiles: ['.env', 'src/index.ts'],
      },
    },
  ]);
}

function enoentError(): NodeJS.ErrnoException {
  const err = new Error('spawn claude ENOENT') as NodeJS.ErrnoException;
  err.code = 'ENOENT';
  return Object.assign(err, { reason: 'spawn-error', sawInit: false });
}

/** The runner's is-error shape for the recorded auth failure (Probe 3). */
function loggedOutError(): Error {
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

/** The runner's budget-timeout shape: QueQue's own flags, not claude's exit 143. */
function killedError(): Error {
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

function sdkSuccess(): void {
  createMock.mockResolvedValue({
    content: [
      {
        type: 'text',
        text: CANDIDATE_JSON,
      },
    ],
  });
}

function turnOptions(): ClaudeTurnOptions {
  const options = runClaudeTurnMock.mock.calls[0]?.[0];
  if (!options) {
    throw new Error('runClaudeTurn was not called');
  }
  return options;
}

function turnArgv(): string[] {
  return [...turnOptions().argv];
}

function debugPaths(): string[] {
  return appendDebugLogMock.mock.calls
    .map((call) => {
      const details = call[2] as { path?: string } | undefined;
      return details?.path;
    })
    .filter((path): path is string => typeof path === 'string');
}

function sourcePath(relative: string): string {
  return join(dirname(fileURLToPath(import.meta.url)), relative);
}

// Every case reads an empty, per-test config dir so the developer's real
// ~/.config/qq/config.json (effort, privacy patterns) never leaks into these tests.
let configDir: string;
let previousConfigFile: string | undefined;

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), 'qq-cli-config-'));
  previousConfigFile = process.env.QQ_CONFIG_FILE;
  process.env.QQ_CONFIG_FILE = join(configDir, 'config.json');
  resetQqConfigCache();
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

describe('claudeDefaultAdapter', () => {
  let previousApiKey: string | undefined;

  beforeEach(() => {
    previousApiKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.QQ_MODEL;
    delete process.env.QQ_FORCE_SELECTOR;
    createMock.mockReset();
    anthropicCtorMock.mockClear();
    runClaudeTurnMock.mockReset();
    readEnvValueFromDotEnvLocalMock.mockReset();
    readEnvValueFromDotEnvLocalMock.mockReturnValue(null);
    appendDebugLogMock.mockClear();
    resetAnthropicClientCache();
    clearProviderBackends();
    resetBootstrap();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (previousApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = previousApiKey;
    }
  });

  it('returns the result text via parseCandidates without calling the SDK', async () => {
    runClaudeTurnMock.mockResolvedValue(CANDIDATE_JSON);
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    const result = await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    expect(result).toEqual([{ command: 'git status', explanation: 'Show repo status' }]);
    expect(runClaudeTurnMock).toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('runs claude with stream-json argv, the prompt on stdin, and no bare flag', async () => {
    runClaudeTurnMock.mockResolvedValue(CANDIDATE_JSON);
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');
    const { buildPrompt } = await import('../src/providers/claude.js');
    const { buildSystemPrompt } = await import('../src/providers/steering.js');
    const envelope = gitEnvelopeWithSecretFile();
    const prompt = buildPrompt(envelope);

    await claudeDefaultAdapter.fetchCandidates(envelope);

    expect(turnOptions().command).toBe('claude');
    const args = turnArgv();
    expect(args).toContain('-p');
    expect(args[args.indexOf('--input-format') + 1]).toBe('stream-json');
    expect(args[args.indexOf('--output-format') + 1]).toBe('stream-json');
    expect(args).toContain('--verbose');
    expect(args).toContain('--include-partial-messages');
    expect(args).toContain('--safe-mode');
    expect(args.indexOf('--tools')).toBeGreaterThan(-1);
    expect(args[args.indexOf('--tools') + 1]).toBe('');
    expect(args).toContain('--no-session-persistence');
    expect(args[args.indexOf('--system-prompt') + 1]).toBe(buildSystemPrompt(envelope));
    expect(args).not.toContain('--bare');
    expect(args).not.toContain('--model');
    expect(args).not.toContain(prompt);
    expect(turnOptions().prompt).toBe(prompt);
    expect(turnOptions().prompt).toContain('src/index.ts');
    expect(turnOptions().prompt).not.toContain('.env');
  });

  it('passes buildSystemPrompt(envelope) with installed-tools steering as --system-prompt', async () => {
    runClaudeTurnMock.mockResolvedValue(CANDIDATE_JSON);
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');
    const { buildSystemPrompt } = await import('../src/providers/steering.js');
    const envelope = buildEnvelope([{ kind: 'installed-tools', payload: { tools: ['fd', 'rg'] } }]);

    await claudeDefaultAdapter.fetchCandidates(envelope);

    const args = turnArgv();
    const systemPrompt = args[args.indexOf('--system-prompt') + 1];
    expect(systemPrompt).toBe(buildSystemPrompt(envelope));
    expect(systemPrompt).toContain('Never include install steps');
    expect(systemPrompt).toContain('fd rg');
    expect(turnOptions().prompt).not.toContain('Notable command-line tools');
  });

  it('uses the envelope cwd and the remaining budget', async () => {
    runClaudeTurnMock.mockResolvedValue(CANDIDATE_JSON);
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    const options = turnOptions();
    expect(options.cwd).toBe('/repo');
    expect(options.budgetMs).toBeLessThanOrEqual(25_000);
    expect(options.budgetMs).toBeGreaterThan(24_000);
    expect(options.env).toBe(process.env);
  });

  it('forwards the abort signal to the runner', async () => {
    runClaudeTurnMock.mockResolvedValue(CANDIDATE_JSON);
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');
    const controller = new AbortController();

    await claudeDefaultAdapter.fetchCandidates(buildEnvelope(), { signal: controller.signal });

    expect(turnOptions().signal).toBe(controller.signal);
  });

  it('re-throws an aborted turn unmapped, never as the D13 or timeout copy', async () => {
    runClaudeTurnMock.mockRejectedValue(abortError());
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    const error = await claudeDefaultAdapter
      .fetchCandidates(buildEnvelope(), { signal: new AbortController().signal })
      .catch((caught: unknown) => caught);

    expect(isAbortError(error)).toBe(true);
    expect((error as Error).message).not.toMatch(D13_LOGIN);
    expect((error as Error).message).not.toMatch(/timed out/i);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('uses the SDK and does not spawn when ANTHROPIC_API_KEY is set (D-08)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    sdkSuccess();
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    expect(createMock).toHaveBeenCalled();
    expect(runClaudeTurnMock).not.toHaveBeenCalled();
    const requestOptions = createMock.mock.calls[0]?.[1] as { timeout?: number };
    expect(requestOptions.timeout).toBeLessThanOrEqual(25_000);
    expect(requestOptions.timeout).toBeGreaterThan(24_000);
  });

  it('uses the SDK and does not spawn when a key is in the environment (D-09)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    runClaudeTurnMock.mockRejectedValue(enoentError());
    sdkSuccess();
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    const result = await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    expect(result).toEqual([{ command: 'git status', explanation: 'Show repo status' }]);
    expect(createMock).toHaveBeenCalled();
    expect(runClaudeTurnMock).not.toHaveBeenCalled();
  });

  it('throws D-13 copy and skips SDK when CLI is ENOENT and no key exists (D-09, D-13)', async () => {
    runClaudeTurnMock.mockRejectedValue(enoentError());
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await expect(claudeDefaultAdapter.fetchCandidates(buildEnvelope())).rejects.toThrow(D13_LOGIN);
    await expect(claudeDefaultAdapter.fetchCandidates(buildEnvelope())).rejects.toThrow(D13_KEY);
    await expect(claudeDefaultAdapter.fetchCandidates(buildEnvelope())).rejects.toThrow(
      /Claude Code|install/i,
    );
    await expect(claudeDefaultAdapter.fetchCandidates(buildEnvelope())).rejects.not.toThrow(
      /not wired yet/i,
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it('uses .env.local when ANTHROPIC_API_KEY is an empty stub and does not spawn (D-09)', async () => {
    process.env.ANTHROPIC_API_KEY = '';
    readEnvValueFromDotEnvLocalMock.mockImplementation((key: string) =>
      key === 'ANTHROPIC_API_KEY' ? 'sk-ant-from-dotenv' : null,
    );
    sdkSuccess();
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    const result = await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    expect(result).toEqual([{ command: 'git status', explanation: 'Show repo status' }]);
    expect(createMock).toHaveBeenCalled();
    expect(runClaudeTurnMock).not.toHaveBeenCalled();
  });

  it('uses a .env.local key without spawning claude (D-09)', async () => {
    readEnvValueFromDotEnvLocalMock.mockImplementation((key: string) =>
      key === 'ANTHROPIC_API_KEY' ? 'sk-ant-from-dotenv' : null,
    );
    sdkSuccess();
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    const result = await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    expect(result).toEqual([{ command: 'git status', explanation: 'Show repo status' }]);
    expect(createMock).toHaveBeenCalled();
    expect(runClaudeTurnMock).not.toHaveBeenCalled();
  });

  it('does not import detect.ts, detectProvider, or claudeAuthPresent (D-10)', () => {
    const cliSrc = readFileSync(sourcePath('../src/providers/claude-cli.ts'), 'utf8');
    const defaultSrc = readFileSync(sourcePath('../src/providers/claude-default.ts'), 'utf8');

    for (const src of [cliSrc, defaultSrc]) {
      expect(src).not.toMatch(/detect\.ts|detectProvider|claudeAuthPresent/);
    }
  });

  it('never spawns openai or fetches localhost:11434 (D-12)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    process.env.ANTHROPIC_API_KEY = 'test-key';
    sdkSuccess();
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    expect(runClaudeTurnMock).not.toHaveBeenCalled();
    expect(fetchSpy.mock.calls.some((call) => String(call[0]).includes('localhost:11434'))).toBe(
      false,
    );
    vi.unstubAllGlobals();
  });

  it('throws D-13 copy when the result is_error auth text comes back and no key can rescue', async () => {
    runClaudeTurnMock.mockRejectedValue(loggedOutError());
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    const error = await claudeDefaultAdapter
      .fetchCandidates(buildEnvelope())
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(D13_LOGIN);
    expect((error as Error).message).toMatch(D13_KEY);
    expect((error as Error).message).not.toMatch(/not wired yet/i);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('throws a timeout-style error when the turn runs past its budget and no key exists', async () => {
    runClaudeTurnMock.mockRejectedValue(killedError());
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await expect(claudeDefaultAdapter.fetchCandidates(buildEnvelope())).rejects.toThrow(
      /timeout|timed out|SIGTERM/i,
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it('logs path sdk without argv, env, streams, or tokens when a key exists', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    sdkSuccess();
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    const paths = debugPaths();
    expect(paths).toContain('sdk');
    expect(paths).not.toContain('claude-cli');
    expect(JSON.stringify(appendDebugLogMock.mock.calls)).not.toMatch(FORBIDDEN_DEBUG);
  });

  it('registers the composite as claude-cli so an env key uses the SDK without spawning', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    sdkSuccess();
    bootstrapBuiltins();

    const adapter = getProviderAdapter('claude-cli');
    expect(listProviderBackends().map((backend) => backend.id)).toContain('claude-cli');
    expect(adapter?.fetchCandidates).toBeTypeOf('function');
    if (!adapter) {
      throw new Error('claude-cli adapter not registered');
    }

    await adapter.fetchCandidates(buildEnvelope());

    expect(createMock).toHaveBeenCalled();
    expect(runClaudeTurnMock).not.toHaveBeenCalled();
  });
});

type StageScript = Array<[ClaudeTurnStage, ClaudeTurnStageDetail?]>;

/** Runner mock that plays `stages` through onStage, then settles with `outcome`. */
function playStages(stages: StageScript, outcome: { text: string } | { error: Error }): void {
  runClaudeTurnMock.mockImplementation(async (options) => {
    for (const [stage, detail] of stages) {
      options.onStage?.(stage, detail);
    }
    if ('error' in outcome) {
      throw outcome.error;
    }
    return outcome.text;
  });
}

interface CliStageLog {
  message: string;
  detail: Record<string, unknown> | undefined;
}

/** Provider debug lines whose message starts with `cli ` (other provider lines ignored). */
function cliStageLogs(): CliStageLog[] {
  return appendDebugLogMock.mock.calls
    .filter((call) => call[0] === 'provider' && String(call[1]).startsWith('cli '))
    .map((call) => ({
      message: String(call[1]),
      detail: call[2] as Record<string, unknown> | undefined,
    }));
}

describe('claude -p turn stage logs and error copy (D-04)', () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    runClaudeTurnMock.mockReset();
    readEnvValueFromDotEnvLocalMock.mockReset();
    readEnvValueFromDotEnvLocalMock.mockReturnValue(null);
    appendDebugLogMock.mockClear();
    createMock.mockReset();
  });

  it('logs cli spawned, init, first delta, result and exit in order with elapsed ms', async () => {
    playStages(
      [
        ['spawned', { pid: 4242 }],
        ['init'],
        ['first-delta'],
        ['result'],
        ['exit', { code: 0, signal: null }],
      ],
      { text: CANDIDATE_JSON },
    );
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    const logs = cliStageLogs();
    expect(logs.map((log) => log.message)).toEqual([
      'cli spawned',
      'cli init',
      'cli first delta',
      'cli result',
      'cli exit',
    ]);
    for (const log of logs) {
      expect(log.detail).toEqual(expect.objectContaining({ ms: expect.any(Number) }));
    }
    expect(logs.at(-1)?.detail).toEqual(expect.objectContaining({ code: 0, signal: null }));
  });

  it('logs cli aborted for an aborted turn', async () => {
    playStages([['spawned', { pid: 4242 }], ['init'], ['aborted']], { error: abortError() });
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await claudeDefaultAdapter.fetchCandidates(buildEnvelope()).catch(() => undefined);

    expect(cliStageLogs().map((log) => log.message)).toEqual([
      'cli spawned',
      'cli init',
      'cli aborted',
    ]);
  });

  it('logs cli timed out for a turn past its budget', async () => {
    playStages([['spawned', { pid: 4242 }], ['timed-out']], { error: killedError() });
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await claudeDefaultAdapter.fetchCandidates(buildEnvelope()).catch(() => undefined);

    expect(cliStageLogs().map((log) => log.message)).toEqual(['cli spawned', 'cli timed out']);
  });

  it('never logs the prompt, argv, env, streams or tokens in stage lines', async () => {
    playStages(
      [
        ['spawned', { pid: 4242 }],
        ['init'],
        ['first-delta'],
        ['result'],
        ['exit', { code: 0, signal: null }],
      ],
      { text: CANDIDATE_JSON },
    );
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');
    const { buildPrompt } = await import('../src/providers/claude.js');
    const envelope = gitEnvelopeWithSecretFile();

    await claudeDefaultAdapter.fetchCandidates(envelope);

    const logged = JSON.stringify(appendDebugLogMock.mock.calls);
    expect(cliStageLogs().length).toBeGreaterThan(0);
    expect(logged).not.toMatch(FORBIDDEN_DEBUG);
    expect(logged).not.toContain(buildPrompt(envelope));
  });

  it('maps timeout, is_error auth and ENOENT failures to the existing copy, never a candidate', async () => {
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');
    const cases: Array<[Error, RegExp, RegExp | null]> = [
      [killedError(), /Claude timed out/, null],
      [loggedOutError(), /Claude is not authenticated\. Run `claude \/login`/, /Install/],
      [enoentError(), /Install Claude Code, run `claude \/login`/, null],
    ];

    for (const [failure, copy, notCopy] of cases) {
      runClaudeTurnMock.mockReset();
      runClaudeTurnMock.mockRejectedValue(failure);

      const outcome = await claudeDefaultAdapter
        .fetchCandidates(buildEnvelope())
        .then((candidates) => ({ candidates }))
        .catch((error: unknown) => ({ error }));

      expect('candidates' in outcome).toBe(false);
      const message = 'error' in outcome ? (outcome.error as Error).message : '';
      expect(message).toMatch(copy);
      if (notCopy) {
        expect(message).not.toMatch(notCopy);
      }
    }
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe('claude -p effort and streamed candidates', () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.QQ_FORCE_SELECTOR;
    runClaudeTurnMock.mockReset();
    readEnvValueFromDotEnvLocalMock.mockReset();
    readEnvValueFromDotEnvLocalMock.mockReturnValue(null);
    appendDebugLogMock.mockClear();
    createMock.mockReset();
  });

  it('passes --effort low by default and never a model flag (D-01, D-02)', async () => {
    runClaudeTurnMock.mockResolvedValue(CANDIDATE_JSON);
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    const args = turnArgv();
    expect(args.indexOf('--effort')).toBeGreaterThan(-1);
    expect(args[args.indexOf('--effort') + 1]).toBe('low');
    expect(args).not.toContain('--model');
  });

  it('passes the config.json effort level (D-01)', async () => {
    writeFileSync(join(configDir, 'config.json'), JSON.stringify({ effort: 'high' }));
    resetQqConfigCache();
    runClaudeTurnMock.mockResolvedValue(CANDIDATE_JSON);
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    const args = turnArgv();
    expect(args[args.indexOf('--effort') + 1]).toBe('high');
    expect(args).not.toContain('--model');
  });
});
