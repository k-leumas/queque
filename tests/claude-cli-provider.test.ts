import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextEnvelope } from '../src/contracts/request.js';
import { resetAnthropicClientCache, TRUNCATED_RESPONSE_MESSAGE } from '../src/providers/claude.js';
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
const PICKER_HINT = /qq init provider/;
const FORBIDDEN_DEBUG = /"args"|"env"|"argv"|"stdout"|"stderr"|apiKey|sk-ant-|sk-|token/i;

const {
  createMock,
  streamMock,
  anthropicCtorMock,
  AnthropicMock,
  runClaudeTurnMock,
  readEnvValueFromDotEnvLocalMock,
  appendDebugLogMock,
} = vi.hoisted(() => {
  const createMock = vi.fn();
  const streamMock = vi.fn();
  const anthropicCtorMock = vi.fn();

  class AnthropicMock {
    messages: {
      create: typeof createMock;
      stream: (params: unknown, requestOptions?: unknown) => unknown;
    };

    constructor(options: unknown) {
      anthropicCtorMock(options);
      this.messages = {
        create: createMock,
        // createMock records every SDK Messages request (create or stream), so the
        // CLI-path cases' `expect(createMock).not.toHaveBeenCalled()` still proves the SDK
        // stayed idle; streamMock scripts the streamed response.
        stream: (params, requestOptions) => {
          createMock(params, requestOptions);
          return streamMock(params, requestOptions);
        },
      };
    }
  }

  return {
    createMock,
    streamMock,
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

/** The runner's truncated shape: a result whose stop_reason is not normal (WR-01-r2). */
function truncatedFailure(stdout: string, stopReason: string | null = 'refusal'): Error {
  return Object.assign(new Error('Command failed: claude'), {
    code: null,
    killed: false,
    signal: null,
    stdout,
    stderr: '',
    reason: 'truncated',
    sawInit: true,
    stopReason,
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

interface SdkStreamScript {
  /** Text pieces emitted as `text` events, in order, before finalMessage settles. */
  pieces: string[];
  /** finalMessage stays pending after the pieces until the request signal aborts. */
  hangUntilAbort?: boolean;
}

interface SdkRequestOptions {
  timeout?: number;
  signal?: AbortSignal | null;
}

/** The SDK 0.92.0 abort error: MessageStream.finalMessage() rejects with it on abort. */
function apiUserAbortError(): Error {
  const error = new Error('Request was aborted.');
  error.name = 'APIUserAbortError';
  return error;
}

/** MessageStream stand-in: `text` listeners plus a finalMessage() that plays the pieces. */
function fakeSdkStream(script: SdkStreamScript, requestOptions?: SdkRequestOptions) {
  const textListeners: Array<(delta: string, snapshot: string) => void> = [];
  const signal = requestOptions?.signal ?? undefined;
  const stream = {
    on(event: string, listener: (delta: string, snapshot: string) => void) {
      if (event === 'text') {
        textListeners.push(listener);
      }
      return stream;
    },
    async finalMessage() {
      let snapshot = '';
      for (const piece of script.pieces) {
        await Promise.resolve();
        if (signal?.aborted) {
          throw apiUserAbortError();
        }
        snapshot += piece;
        for (const listener of textListeners) {
          listener(piece, snapshot);
        }
      }
      if (script.hangUntilAbort) {
        await new Promise<never>((_resolve, reject) => {
          if (signal?.aborted) {
            reject(apiUserAbortError());
            return;
          }
          signal?.addEventListener('abort', () => reject(apiUserAbortError()), { once: true });
        });
      }
      return { content: [{ type: 'text', text: snapshot }] };
    },
  };
  return stream;
}

function sdkStream(script: SdkStreamScript): void {
  streamMock.mockImplementation((_params: unknown, requestOptions?: SdkRequestOptions) =>
    fakeSdkStream(script, requestOptions),
  );
}

function sdkSuccess(): void {
  sdkStream({ pieces: [CANDIDATE_JSON] });
}

function sdkRequestOptions(): SdkRequestOptions {
  const requestOptions = streamMock.mock.calls[0]?.[1] as SdkRequestOptions | undefined;
  if (!requestOptions) {
    throw new Error('messages.stream was not called');
  }
  return requestOptions;
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
  streamMock.mockReset();
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

    expect(streamMock).toHaveBeenCalled();
    expect(runClaudeTurnMock).not.toHaveBeenCalled();
    const requestOptions = sdkRequestOptions();
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
    expect(streamMock).toHaveBeenCalled();
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
    await expect(claudeDefaultAdapter.fetchCandidates(buildEnvelope())).rejects.toThrow(
      PICKER_HINT,
    );
    await expect(claudeDefaultAdapter.fetchCandidates(buildEnvelope())).rejects.toThrow(
      /No AI provider is ready/,
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
    expect(streamMock).toHaveBeenCalled();
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
    expect(streamMock).toHaveBeenCalled();
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
    expect((error as Error).message).toMatch(PICKER_HINT);
    expect((error as Error).message.indexOf('claude /login')).toBeLessThan(
      (error as Error).message.indexOf('qq init provider'),
    );
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

  it('timeout copy stays a retry message', async () => {
    runClaudeTurnMock.mockRejectedValue(killedError());
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    const error = await claudeDefaultAdapter
      .fetchCandidates(buildEnvelope())
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/Claude timed out/);
    expect((error as Error).message).not.toMatch(PICKER_HINT);
  });

  it('Claude default source never references the picker', () => {
    const defaultSrc = readFileSync(sourcePath('../src/providers/claude-default.ts'), 'utf8');

    expect(defaultSrc).not.toMatch(/init-provider|runProviderPicker/);
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

    expect(streamMock).toHaveBeenCalled();
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
      [enoentError(), /Install Claude Code and run `claude \/login`/, null],
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

  const STREAMED_ANSWER =
    '[{"command":"tldr z3","explanation":"Show concise usage examples"},' +
    '{"command":"z3 -h","explanation":"Print z3 options ⓘ"}]';
  const STREAMED_CANDIDATES = [
    { command: 'tldr z3', explanation: 'Show concise usage examples' },
    { command: 'z3 -h', explanation: 'Print z3 options ⓘ' },
  ];

  /** Splits `text` into small text_delta-sized pieces. */
  function deltaPieces(text: string, size = 7): string[] {
    const pieces: string[] = [];
    for (let index = 0; index < text.length; index += size) {
      pieces.push(text.slice(index, index + size));
    }
    return pieces;
  }

  /** Runner mock that feeds `deltas` through onTextDelta, then resolves with `resultText`. */
  function playDeltas(
    deltas: string[],
    resultText: string,
    hooks: { afterDelta?: (index: number) => void; beforeResolve?: () => void } = {},
  ): void {
    runClaudeTurnMock.mockImplementation(async (options) => {
      deltas.forEach((delta, index) => {
        options.onTextDelta?.(delta);
        hooks.afterDelta?.(index);
      });
      hooks.beforeResolve?.();
      return resultText;
    });
  }

  it('hands each streamed candidate to onCandidate in order before the fetch resolves', async () => {
    const onCandidate = vi.fn();
    let callsBeforeResolve = -1;
    playDeltas(deltaPieces(STREAMED_ANSWER), STREAMED_ANSWER, {
      beforeResolve: () => {
        callsBeforeResolve = onCandidate.mock.calls.length;
      },
    });
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    const result = await claudeDefaultAdapter.fetchCandidates(buildEnvelope(), { onCandidate });

    expect(callsBeforeResolve).toBe(2);
    expect(onCandidate.mock.calls.map((call) => call[0])).toEqual(STREAMED_CANDIDATES);
    expect(result).toEqual(STREAMED_CANDIDATES);
  });

  it('stops calling onCandidate once the signal is aborted', async () => {
    const onCandidate = vi.fn();
    const controller = new AbortController();
    const firstClose = STREAMED_ANSWER.indexOf('}') + 1;
    playDeltas(
      [STREAMED_ANSWER.slice(0, firstClose), STREAMED_ANSWER.slice(firstClose)],
      STREAMED_ANSWER,
      {
        afterDelta: (index) => {
          if (index === 0) {
            controller.abort();
          }
        },
      },
    );
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await claudeDefaultAdapter
      .fetchCandidates(buildEnvelope(), { signal: controller.signal, onCandidate })
      .catch(() => undefined);

    expect(onCandidate).toHaveBeenCalledTimes(1);
    expect(onCandidate).toHaveBeenCalledWith(STREAMED_CANDIDATES[0]);
  });

  it('creates no scanner without onCandidate', async () => {
    runClaudeTurnMock.mockResolvedValue(CANDIDATE_JSON);
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    expect(turnOptions().onTextDelta).toBeUndefined();
  });

  it('uses the strict parse of a valid result text as the final list', async () => {
    playDeltas(deltaPieces(STREAMED_ANSWER), CANDIDATE_JSON);
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    const result = await claudeDefaultAdapter.fetchCandidates(buildEnvelope(), {
      onCandidate: vi.fn(),
    });

    expect(result).toEqual([{ command: 'git status', explanation: 'Show repo status' }]);
  });

  it('falls back to the streamed rows when the result text fails the strict parse', async () => {
    playDeltas(deltaPieces(STREAMED_ANSWER), `${STREAMED_ANSWER}\nHope that helps!`);
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    const result = await claudeDefaultAdapter.fetchCandidates(buildEnvelope(), {
      onCandidate: vi.fn(),
    });

    expect(result).toEqual(STREAMED_CANDIDATES);
  });

  it('keeps the parseCandidates prose fallback when nothing streamed', async () => {
    const prose = 'git status --short';
    playDeltas([prose], prose);
    const onCandidate = vi.fn();
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    const result = await claudeDefaultAdapter.fetchCandidates(buildEnvelope(), { onCandidate });

    expect(onCandidate).not.toHaveBeenCalled();
    expect(result).toEqual([{ command: 'git status --short', explanation: '' }]);
  });

  it('shows the truncation copy for a truncated refusal fragment, not D13 (WR-01-r2)', async () => {
    runClaudeTurnMock.mockRejectedValue(truncatedFailure('[{"command": "find . -name'));
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    const error = await claudeDefaultAdapter
      .fetchCandidates(buildEnvelope())
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(TRUNCATED_RESPONSE_MESSAGE);
    expect((error as Error).message).not.toMatch(/not authenticated/);
    expect((error as Error).message).not.toMatch(/timed out/);
    expect(createMock).not.toHaveBeenCalled();
    const truncatedLog = appendDebugLogMock.mock.calls.find(
      (call) => call[0] === 'provider' && call[1] === 'response truncated',
    );
    expect(truncatedLog?.[2]).toMatchObject({ stopReason: 'refusal' });
  });

  it.each([
    'refusal',
    null,
  ])('closes the prose fallback on a truncated %s turn (WR-01-r2)', async (stopReason) => {
    runClaudeTurnMock.mockRejectedValue(truncatedFailure('git status --short', stopReason));
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await expect(
      claudeDefaultAdapter.fetchCandidates(buildEnvelope(), { onCandidate: vi.fn() }),
    ).rejects.toThrow(TRUNCATED_RESPONSE_MESSAGE);
  });

  it('keeps the rows that closed in a truncated result text (WR-01-r2)', async () => {
    const cut = `${STREAMED_ANSWER.slice(0, -1)},{"command":"git di`;
    runClaudeTurnMock.mockRejectedValue(truncatedFailure(cut));
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    const result = await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    expect(result).toEqual(STREAMED_CANDIDATES);
  });

  it('keeps the streamed rows when the turn ends truncated (WR-01-r2)', async () => {
    runClaudeTurnMock.mockImplementation(async (options) => {
      for (const delta of deltaPieces(STREAMED_ANSWER)) {
        options.onTextDelta?.(delta);
      }
      throw truncatedFailure('[{"command": "find . -name');
    });
    const onCandidate = vi.fn();
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    const result = await claudeDefaultAdapter.fetchCandidates(buildEnvelope(), { onCandidate });

    expect(result).toEqual(STREAMED_CANDIDATES);
    expect(onCandidate).toHaveBeenCalledTimes(2);
  });

  it('logs cli first candidate once per turn with elapsed ms', async () => {
    playDeltas(deltaPieces(STREAMED_ANSWER), STREAMED_ANSWER);
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await claudeDefaultAdapter.fetchCandidates(buildEnvelope(), { onCandidate: vi.fn() });

    const firstCandidateLogs = cliStageLogs().filter(
      (log) => log.message === 'cli first candidate',
    );
    expect(firstCandidateLogs).toHaveLength(1);
    expect(firstCandidateLogs[0]?.detail).toEqual({ ms: expect.any(Number) });
  });
});

describe('SDK path streaming and abort', () => {
  let previousApiKey: string | undefined;

  beforeEach(() => {
    previousApiKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    delete process.env.QQ_MODEL;
    delete process.env.QQ_FORCE_SELECTOR;
    createMock.mockReset();
    anthropicCtorMock.mockClear();
    runClaudeTurnMock.mockReset();
    readEnvValueFromDotEnvLocalMock.mockReset();
    readEnvValueFromDotEnvLocalMock.mockReturnValue(null);
    appendDebugLogMock.mockClear();
    resetAnthropicClientCache();
  });

  afterEach(() => {
    if (previousApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = previousApiKey;
    }
  });

  it('passes the abort signal and the remaining budget to the SDK stream request', async () => {
    sdkSuccess();
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');
    const controller = new AbortController();

    await claudeDefaultAdapter.fetchCandidates(buildEnvelope(), { signal: controller.signal });

    const requestOptions = sdkRequestOptions();
    expect(requestOptions.signal).toBe(controller.signal);
    expect(requestOptions.timeout).toBeLessThanOrEqual(25_000);
    expect(requestOptions.timeout).toBeGreaterThan(24_000);
    expect(runClaudeTurnMock).not.toHaveBeenCalled();
  });

  it('hands streamed SDK candidates to onCandidate through claudeDefaultAdapter', async () => {
    const answer =
      '[{"command":"git status","explanation":"Show repo status"},{"command":"git diff","explanation":"Show changes"}]';
    sdkStream({ pieces: [answer.slice(0, 30), answer.slice(30, 70), answer.slice(70)] });
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');
    const onCandidate = vi.fn();

    const result = await claudeDefaultAdapter.fetchCandidates(buildEnvelope(), { onCandidate });

    expect(onCandidate.mock.calls.map((call) => call[0])).toEqual([
      { command: 'git status', explanation: 'Show repo status' },
      { command: 'git diff', explanation: 'Show changes' },
    ]);
    expect(result).toEqual(onCandidate.mock.calls.map((call) => call[0]));
  });

  it('re-throws an aborted SDK request unmapped, never as the timeout or D13 copy', async () => {
    sdkStream({ pieces: [CANDIDATE_JSON.slice(0, 20)], hangUntilAbort: true });
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');
    const controller = new AbortController();

    const pending = claudeDefaultAdapter
      .fetchCandidates(buildEnvelope(), { signal: controller.signal })
      .catch((caught: unknown) => caught);
    await vi.waitFor(() => {
      expect(streamMock).toHaveBeenCalled();
    });
    controller.abort();
    const error = await pending;

    expect(isAbortError(error)).toBe(true);
    expect((error as Error).message).not.toMatch(/timed out/i);
    expect((error as Error).message).not.toMatch(D13_LOGIN);
    expect((error as Error).message).not.toMatch(D13_KEY);
    expect(runClaudeTurnMock).not.toHaveBeenCalled();
    const providerMessages = appendDebugLogMock.mock.calls
      .filter((call) => call[0] === 'provider')
      .map((call) => String(call[1]));
    expect(providerMessages).toContain('request aborted');
    expect(providerMessages).not.toContain('request failed');
    expect(JSON.stringify(appendDebugLogMock.mock.calls)).not.toMatch(FORBIDDEN_DEBUG);
  });
});
