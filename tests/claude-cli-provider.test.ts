import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextEnvelope } from '../src/contracts/request.js';
import { bootstrapBuiltins, resetBootstrap } from '../src/registry/bootstrap.js';
import {
  clearProviderBackends,
  getProviderAdapter,
  listProviderBackends,
} from '../src/registry/provider-backends.js';

const CANDIDATE_JSON = '[{"command":"git status","explanation":"Show repo status"}]';
const D13_LOGIN = /claude \/login/;
const D13_KEY = /ANTHROPIC_API_KEY/;
const FORBIDDEN_DEBUG = /"args"|"env"|"argv"|"stdout"|"stderr"|apiKey|sk-ant-|sk-|token/i;

const {
  createMock,
  anthropicCtorMock,
  AnthropicMock,
  execFileAsyncMock,
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
    execFileAsyncMock: vi.fn(),
    readEnvValueFromDotEnvLocalMock: vi.fn<(key: string, startDir?: string) => string | null>(),
    appendDebugLogMock: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: AnthropicMock,
}));

vi.mock('../src/providers/claude-exec.js', () => ({
  execFileAsync: execFileAsyncMock,
}));

vi.mock('../src/shared/env-file.js', () => ({
  readEnvValueFromDotEnvLocal: readEnvValueFromDotEnvLocalMock,
}));

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
  return err;
}

function loggedOutError(): Error {
  return Object.assign(new Error('Command failed: claude'), {
    code: 1,
    stdout: 'Not logged in · Please run /login',
    stderr: '',
  });
}

function killedError(): Error {
  return Object.assign(new Error('killed'), {
    killed: true,
    signal: 'SIGTERM',
    code: null,
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

function spawnArgs(): string[] {
  return execFileAsyncMock.mock.calls[0]?.[1] as string[];
}

function spawnOptions(): {
  stdio?: unknown[];
  cwd?: string;
  timeout?: number;
  env?: NodeJS.ProcessEnv;
} {
  return (execFileAsyncMock.mock.calls[0]?.[2] ?? {}) as {
    stdio?: unknown[];
    cwd?: string;
    timeout?: number;
    env?: NodeJS.ProcessEnv;
  };
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

describe('claudeDefaultAdapter', () => {
  let previousApiKey: string | undefined;

  beforeEach(() => {
    previousApiKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.QQ_MODEL;
    delete process.env.QQ_FORCE_SELECTOR;
    createMock.mockReset();
    anthropicCtorMock.mockClear();
    execFileAsyncMock.mockReset();
    readEnvValueFromDotEnvLocalMock.mockReset();
    readEnvValueFromDotEnvLocalMock.mockReturnValue(null);
    appendDebugLogMock.mockClear();
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

  it('returns CLI stdout JSON via parseCandidates without calling the SDK', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: CANDIDATE_JSON, stderr: '' });
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    const result = await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    expect(result).toEqual([{ command: 'git status', explanation: 'Show repo status' }]);
    expect(execFileAsyncMock).toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('spawns claude with locked print-mode argv, prompt last, and no --bare', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: CANDIDATE_JSON, stderr: '' });
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');
    const claudeModule = (await import('../src/providers/claude.js')) as {
      buildPrompt?: (envelope: ContextEnvelope) => string;
    };
    const envelope = gitEnvelopeWithSecretFile();
    const prompt = claudeModule.buildPrompt?.(envelope);

    await claudeDefaultAdapter.fetchCandidates(envelope);

    expect(execFileAsyncMock.mock.calls[0]?.[0]).toBe('claude');
    const args = spawnArgs();
    expect(args).toContain('-p');
    expect(args).toContain('--output-format');
    expect(args).toContain('text');
    expect(args).toContain('--safe-mode');
    expect(args).toContain('--tools');
    expect(args).toContain('--no-session-persistence');
    expect(args).toContain('--system-prompt');
    expect(args).not.toContain('--bare');
    expect(args[args.indexOf('--output-format') + 1]).toBe('text');
    expect(args[args.indexOf('--output-format') + 1]).not.toBe('json');
    expect(prompt).toBeTypeOf('string');
    expect(args.at(-1)).toBe(prompt);
    expect(args.at(-1)).toContain('src/index.ts');
    expect(args.at(-1)).not.toContain('.env');
  });

  it('ignores stdin, uses envelope cwd, and times out within the remaining budget', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: CANDIDATE_JSON, stderr: '' });
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    const options = spawnOptions();
    expect(options.stdio?.[0]).toBe('ignore');
    expect(options.stdio?.[0]).not.toBe('inherit');
    expect(options.cwd).toBe('/repo');
    expect(options.timeout).toBeLessThanOrEqual(25_000);
    expect(options.env).toBe(process.env);
  });

  it('prefers CLI when ANTHROPIC_API_KEY is set and CLI succeeds (D-08)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    execFileAsyncMock.mockResolvedValue({ stdout: CANDIDATE_JSON, stderr: '' });
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    expect(execFileAsyncMock).toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rescues with the SDK when CLI is ENOENT and a key is in the environment (D-09)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    execFileAsyncMock.mockRejectedValue(enoentError());
    sdkSuccess();
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    const result = await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    expect(result).toEqual([{ command: 'git status', explanation: 'Show repo status' }]);
    expect(createMock).toHaveBeenCalled();
  });

  it('throws D-13 copy and skips SDK when CLI is ENOENT and no key exists (D-09, D-13)', async () => {
    execFileAsyncMock.mockRejectedValue(enoentError());
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

  it('rescues from a logged-out CLI using a .env.local key without injecting it into child env (D-09)', async () => {
    readEnvValueFromDotEnvLocalMock.mockImplementation((key: string) =>
      key === 'ANTHROPIC_API_KEY' ? 'sk-ant-from-dotenv' : null,
    );
    execFileAsyncMock.mockRejectedValue(loggedOutError());
    sdkSuccess();
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    const result = await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    expect(result).toEqual([{ command: 'git status', explanation: 'Show repo status' }]);
    expect(createMock).toHaveBeenCalled();
    expect(spawnOptions().env).toBe(process.env);
    expect(spawnOptions().env?.ANTHROPIC_API_KEY).toBeUndefined();
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
    execFileAsyncMock.mockRejectedValue(enoentError());
    sdkSuccess();
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    expect(execFileAsyncMock.mock.calls.every((call) => call[0] === 'claude')).toBe(true);
    expect(execFileAsyncMock.mock.calls.some((call) => String(call[0]).includes('openai'))).toBe(
      false,
    );
    expect(fetchSpy.mock.calls.some((call) => String(call[0]).includes('localhost:11434'))).toBe(
      false,
    );
    vi.unstubAllGlobals();
  });

  it('throws D-13 copy when CLI fails and no key can rescue', async () => {
    execFileAsyncMock.mockRejectedValue(loggedOutError());
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

  it('skips SDK rescue when remaining budget is just below MIN_SDK_RESCUE_MS', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const { claudeDefaultAdapter, MIN_SDK_RESCUE_MS } = await import(
      '../src/providers/claude-default.js'
    );
    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    execFileAsyncMock.mockImplementation(async () => {
      now += 25_000 - (MIN_SDK_RESCUE_MS - 1);
      throw enoentError();
    });

    await expect(claudeDefaultAdapter.fetchCandidates(buildEnvelope())).rejects.toThrow();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rescues with remaining timeout when budget is just above MIN_SDK_RESCUE_MS', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    sdkSuccess();
    const { claudeDefaultAdapter, MIN_SDK_RESCUE_MS } = await import(
      '../src/providers/claude-default.js'
    );
    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    execFileAsyncMock.mockImplementation(async () => {
      now += 25_000 - (MIN_SDK_RESCUE_MS + 1);
      throw enoentError();
    });

    await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    expect(createMock).toHaveBeenCalled();
    const requestOptions = createMock.mock.calls[0]?.[1] as { timeout?: number };
    expect(requestOptions.timeout).toBe(MIN_SDK_RESCUE_MS + 1);
    expect(requestOptions.timeout).toBeLessThan(25_000);
  });

  it('throws a timeout-style error when CLI is SIGTERM-killed and no key exists', async () => {
    execFileAsyncMock.mockRejectedValue(killedError());
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await expect(claudeDefaultAdapter.fetchCandidates(buildEnvelope())).rejects.toThrow(
      /timeout|timed out|SIGTERM/i,
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it('logs path claude-cli then sdk-rescue without argv, env, streams, or tokens', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    execFileAsyncMock.mockRejectedValue(enoentError());
    sdkSuccess();
    const { claudeDefaultAdapter } = await import('../src/providers/claude-default.js');

    await claudeDefaultAdapter.fetchCandidates(buildEnvelope());

    const paths = debugPaths();
    expect(paths.indexOf('claude-cli')).toBeGreaterThanOrEqual(0);
    expect(paths.indexOf('sdk-rescue')).toBeGreaterThan(paths.indexOf('claude-cli'));
    expect(JSON.stringify(appendDebugLogMock.mock.calls)).not.toMatch(FORBIDDEN_DEBUG);
  });

  it('registers the composite as claude-cli so CLI failure plus env key rescues via SDK', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    execFileAsyncMock.mockRejectedValue(enoentError());
    sdkSuccess();
    bootstrapBuiltins();

    const adapter = getProviderAdapter('claude-cli');
    expect(listProviderBackends().map((backend) => backend.id)).toContain('claude-cli');
    expect(adapter?.fetchCandidates).toBeTypeOf('function');

    await adapter!.fetchCandidates(buildEnvelope());

    expect(createMock).toHaveBeenCalled();
  });
});
