import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandCandidate } from '../src/contracts/candidates.js';
import type { ContextEnvelope } from '../src/contracts/request.js';
import {
  buildPrompt,
  claudeAdapter,
  DEFAULT_MODEL,
  QUEQUE_SYSTEM,
  resetAnthropicClientCache,
  sdkOutputConfig,
} from '../src/providers/claude.js';
import { isAbortError } from '../src/providers/provider.js';
import { buildSystemPrompt } from '../src/providers/steering.js';
import { resetQqConfigCache } from '../src/shared/qq-config.js';

const FORBIDDEN_DEBUG = /"args"|"env"|"argv"|"stdout"|"stderr"|apiKey|sk-ant-|sk-|token/i;

const {
  streamMock,
  anthropicCtorMock,
  AnthropicMock,
  readEnvValueFromDotEnvLocalMock,
  appendDebugLogMock,
} = vi.hoisted(() => {
  const streamMock = vi.fn();
  const anthropicCtorMock = vi.fn();

  class AnthropicMock {
    messages: { create: () => never; stream: typeof streamMock };

    constructor(options: unknown) {
      anthropicCtorMock(options);
      this.messages = {
        // The SDK path streams (D-05, D-13); a single-shot create would be a regression.
        create: () => {
          throw new Error('messages.create called: the SDK path must use messages.stream');
        },
        stream: streamMock,
      };
    }
  }

  return {
    streamMock,
    anthropicCtorMock,
    AnthropicMock,
    readEnvValueFromDotEnvLocalMock: vi.fn<(key: string, startDir?: string) => string | null>(),
    appendDebugLogMock: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: AnthropicMock,
}));

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

interface FakeStreamScript {
  /** Text pieces emitted as `text` events, in order, before finalMessage settles. */
  pieces: string[];
  /** finalMessage rejects with this error after the pieces. */
  error?: Error;
  /** finalMessage stays pending after the pieces until the request signal aborts. */
  hangUntilAbort?: boolean;
}

interface RequestOptions {
  timeout?: number;
  signal?: AbortSignal | null;
}

interface StreamRequest {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: string; content: string }>;
  [key: string]: unknown;
}

/** The SDK 0.92.0 abort error: MessageStream.finalMessage() rejects with it on abort. */
function apiUserAbortError(): Error {
  const error = new Error('Request was aborted.');
  error.name = 'APIUserAbortError';
  return error;
}

/**
 * A MessageStream stand-in: `.on('text', (delta, snapshot) => …)` listeners and a
 * `finalMessage()` that emits the scripted pieces, then resolves the joined text as one
 * text block (or rejects when scripted, or with APIUserAbortError once the signal aborts).
 */
function createFakeStream(script: FakeStreamScript, requestOptions?: RequestOptions) {
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
      if (script.error) {
        throw script.error;
      }
      return { content: [{ type: 'text', text: snapshot }] };
    },
  };
  return stream;
}

function scriptStream(script: FakeStreamScript): void {
  streamMock.mockImplementation((_params: unknown, requestOptions?: RequestOptions) =>
    createFakeStream(script, requestOptions),
  );
}

function streamText(text: string): void {
  scriptStream({ pieces: [text] });
}

function streamRequest(call = 0): StreamRequest {
  const request = streamMock.mock.calls[call]?.[0] as StreamRequest | undefined;
  if (!request) {
    throw new Error('messages.stream was not called');
  }
  return request;
}

function streamRequestOptions(call = 0): RequestOptions {
  return streamMock.mock.calls[call]?.[1] as RequestOptions;
}

/** Splits `text` at the given character offsets. */
function splitAt(text: string, offsets: number[]): string[] {
  const pieces: string[] = [];
  let start = 0;
  for (const offset of offsets) {
    pieces.push(text.slice(start, offset));
    start = offset;
  }
  pieces.push(text.slice(start));
  return pieces;
}

const TWO_CANDIDATES =
  '[{"command":"git status","explanation":"Show repo status"},{"command":"git log --oneline","explanation":"Show history"}]';

function providerDebugMessages(): string[] {
  return appendDebugLogMock.mock.calls
    .filter((call) => call[0] === 'provider')
    .map((call) => String(call[1]));
}

// Every case reads an empty, per-test config dir so the developer's real
// ~/.config/qq/config.json (effort, privacy patterns) never leaks into these tests.
let configDir: string;
let previousConfigFile: string | undefined;

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), 'qq-sdk-config-'));
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

function writeQqConfig(config: Record<string, unknown>): void {
  writeFileSync(join(configDir, 'config.json'), JSON.stringify(config));
  resetQqConfigCache();
}

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

describe('fetchCandidates', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    delete process.env.QQ_MODEL;
    delete process.env.QQ_FORCE_SELECTOR;
    streamMock.mockReset();
    anthropicCtorMock.mockClear();
    appendDebugLogMock.mockClear();
    readEnvValueFromDotEnvLocalMock.mockReset();
    readEnvValueFromDotEnvLocalMock.mockReturnValue(null);
    resetAnthropicClientCache();
  });

  it('returns candidate JSON from Claude and includes git context in the prompt', async () => {
    streamText('[{"command":"git status","explanation":"Show repo status"}]');

    const { fetchCandidates } = await import('../src/providers/claude.js');
    const result = await fetchCandidates(
      buildEnvelope([
        {
          kind: 'git',
          payload: {
            cwd: '/repo',
            root: '/repo',
            branch: 'main',
            dirty: true,
            changedFiles: ['src/index.ts'],
          },
        },
      ]),
      '',
    );

    expect(result).toEqual([{ command: 'git status', explanation: 'Show repo status' }]);
    expect(anthropicCtorMock).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(streamMock).toHaveBeenCalledTimes(1);

    const request = streamRequest();
    expect(request.model).toBe(DEFAULT_MODEL);
    expect(request.messages[0].content).toContain('versionControl');
    expect(request.messages[0].content).toContain('"branch": "main"');
    expect(request.messages[0].content).toContain('"changedFiles"');
  });

  it('falls back to .env.local when ANTHROPIC_API_KEY is an empty stub', async () => {
    process.env.ANTHROPIC_API_KEY = '';
    readEnvValueFromDotEnvLocalMock.mockReturnValue('sk-ant-from-dotenv');
    streamText('[{"command":"git status","explanation":"Show repo status"}]');

    const { fetchCandidates } = await import('../src/providers/claude.js');
    await fetchCandidates(buildEnvelope(), '');

    expect(anthropicCtorMock).toHaveBeenCalledWith({ apiKey: 'sk-ant-from-dotenv' });
  });

  it('uses QQ_MODEL env var when set', async () => {
    process.env.QQ_MODEL = 'claude-custom';
    streamText('[{"command":"git status","explanation":""}]');

    const { fetchCandidates } = await import('../src/providers/claude.js');
    await fetchCandidates(buildEnvelope(), '');

    const request = streamRequest();
    expect(request.model).toBe('claude-custom');
  });

  it('falls back to a single candidate when Claude returns malformed JSON', async () => {
    streamText('not json');

    const { fetchCandidates } = await import('../src/providers/claude.js');
    await expect(fetchCandidates(buildEnvelope(), '')).resolves.toEqual([
      { command: 'not json', explanation: '' },
    ]);
  });

  it('does not retry on model errors', async () => {
    scriptStream({ pieces: [], error: new Error('404 model not found') });

    const { fetchCandidates } = await import('../src/providers/claude.js');
    await expect(fetchCandidates(buildEnvelope(), '')).rejects.toThrow('404 model not found');
    expect(streamMock).toHaveBeenCalledTimes(1);
  });

  it('includes filesystem apparentFilename in the prompt when present', async () => {
    streamText('[{"command":"cat README.md","explanation":"Show file"}]');

    const { fetchCandidates } = await import('../src/providers/claude.js');
    await fetchCandidates(
      buildEnvelope([
        {
          kind: 'filesystem',
          payload: {
            cwd: '/repo',
            apparentFilename: 'README.md',
          },
        },
      ]),
      '',
    );

    const request = streamRequest();
    expect(request.messages[0].content).toContain('"filesystem"');
    expect(request.messages[0].content).toContain('"apparentFilename": "README.md"');
  });

  it('strips sensitive git paths from the prompt JSON (defense-in-depth)', async () => {
    streamText('[{"command":"git status","explanation":""}]');

    const { fetchCandidates } = await import('../src/providers/claude.js');
    await fetchCandidates(
      buildEnvelope([
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
      ]),
      '',
    );

    const prompt = streamRequest().messages[0].content;
    expect(prompt).toContain('src/index.ts');
    expect(prompt).not.toContain('.env');
  });

  it('pads a single candidate to two when QQ_FORCE_SELECTOR is enabled', async () => {
    process.env.QQ_FORCE_SELECTOR = 'true';
    streamText('[{"command":"git status","explanation":"Show repo status"}]');

    const { fetchCandidates } = await import('../src/providers/claude.js');
    const result = await fetchCandidates(buildEnvelope(), '');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      command: 'git status',
      explanation: 'Show repo status',
    });
    expect(result[1]?.command).toBe('git status');
    expect(result[1]?.explanation).toContain('forced duplicate');
  });

  it('reuses the Anthropic client for a second fetch with the same key', async () => {
    streamText('[{"command":"git status","explanation":"Show repo status"}]');

    const { fetchCandidates } = await import('../src/providers/claude.js');
    await fetchCandidates(buildEnvelope(), '');
    await fetchCandidates(buildEnvelope(), '');
    expect(anthropicCtorMock).toHaveBeenCalledTimes(1);
    expect(streamMock).toHaveBeenCalledTimes(2);
  });

  it('sends installed-tools steering in the system prompt only, never the user prompt', async () => {
    streamText('[{"command":"fd -e ts","explanation":"Find ts"}]');

    const { fetchCandidates } = await import('../src/providers/claude.js');
    await fetchCandidates(
      buildEnvelope([{ kind: 'installed-tools', payload: { tools: ['fd', 'rg'] } }]),
      '',
    );

    const request = streamRequest();
    expect(request.system).toContain('Notable command-line tools installed on this machine');
    expect(request.system).toContain('fd rg');
    expect(request.messages[0].content).not.toContain('installed-tools');
    expect(request.messages[0].content).not.toContain('Notable command-line tools');
    expect(request).not.toHaveProperty('temperature');
    expect(request).not.toHaveProperty('top_p');
    expect(request).not.toHaveProperty('top_k');
  });

  it('sends the unchanged system constant when no installed-tools chunk is present', async () => {
    streamText('[{"command":"git status","explanation":""}]');

    const { fetchCandidates } = await import('../src/providers/claude.js');
    await fetchCandidates(buildEnvelope(), '');

    expect(streamRequest().system).toBe(QUEQUE_SYSTEM);
  });

  it('builds a byte-identical user prompt with or without the installed-tools chunk', () => {
    const without = buildEnvelope();
    const withChunk = buildEnvelope([
      { kind: 'installed-tools', payload: { tools: ['fd', 'rg'] } },
    ]);
    expect(buildPrompt(withChunk)).toBe(buildPrompt(without));
  });
});

describe('SDK streaming request, abort and streamed candidates (D-05, D-13)', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    delete process.env.QQ_MODEL;
    delete process.env.QQ_FORCE_SELECTOR;
    streamMock.mockReset();
    anthropicCtorMock.mockClear();
    appendDebugLogMock.mockClear();
    readEnvValueFromDotEnvLocalMock.mockReset();
    readEnvValueFromDotEnvLocalMock.mockReturnValue(null);
    resetAnthropicClientCache();
  });

  it('streams one request with max_tokens, buildSystemPrompt and { timeout, signal } options', async () => {
    streamText(TWO_CANDIDATES);
    const envelope = buildEnvelope([{ kind: 'installed-tools', payload: { tools: ['fd'] } }]);
    const controller = new AbortController();

    await claudeAdapter.fetchCandidates(envelope, { signal: controller.signal });

    expect(streamMock).toHaveBeenCalledTimes(1);
    const request = streamRequest();
    expect(request.model).toBe(DEFAULT_MODEL);
    expect(request.max_tokens).toBe(1024);
    expect(request.system).toBe(buildSystemPrompt(envelope));
    expect(request.messages).toEqual([{ role: 'user', content: buildPrompt(envelope) }]);
    expect(streamRequestOptions()).toEqual({ timeout: 25_000, signal: controller.signal });
  });

  it('sends no thinking key and no sampling parameters', async () => {
    streamText(TWO_CANDIDATES);

    await claudeAdapter.fetchCandidates(buildEnvelope());

    const request = streamRequest();
    for (const key of ['thinking', 'temperature', 'top_p', 'top_k']) {
      expect(request).not.toHaveProperty(key);
    }
  });

  it('hands each streamed candidate to onCandidate in order before the fetch resolves', async () => {
    scriptStream({ pieces: splitAt(TWO_CANDIDATES, [7, 31, 64, 90]) });
    const events: string[] = [];

    const result = await claudeAdapter.fetchCandidates(buildEnvelope(), {
      onCandidate: (candidate: CommandCandidate) => {
        events.push(`candidate:${candidate.command}`);
      },
    });
    events.push('resolved');

    expect(events).toEqual(['candidate:git status', 'candidate:git log --oneline', 'resolved']);
    expect(result).toEqual([
      { command: 'git status', explanation: 'Show repo status' },
      { command: 'git log --oneline', explanation: 'Show history' },
    ]);
  });

  it('uses the strict parse of the final text as the list', async () => {
    scriptStream({ pieces: ['```json\n', TWO_CANDIDATES, '\n```'] });
    const streamed: CommandCandidate[] = [];

    const result = await claudeAdapter.fetchCandidates(buildEnvelope(), {
      onCandidate: (candidate) => streamed.push(candidate),
    });

    expect(streamed).toHaveLength(2);
    expect(result).toEqual(streamed);
  });

  it('falls back to the streamed rows when the final text fails the strict parse', async () => {
    const truncated = `${TWO_CANDIDATES.slice(0, -1)},{"command":"git di`;
    scriptStream({ pieces: splitAt(truncated, [40, 80]) });
    const streamed: CommandCandidate[] = [];

    const result = await claudeAdapter.fetchCandidates(buildEnvelope(), {
      onCandidate: (candidate) => streamed.push(candidate),
    });

    expect(result).toEqual([
      { command: 'git status', explanation: 'Show repo status' },
      { command: 'git log --oneline', explanation: 'Show history' },
    ]);
    expect(streamed).toEqual(result);
  });

  it('keeps the parseCandidates prose fallback when nothing streamed', async () => {
    scriptStream({ pieces: ['not ', 'json'] });
    const onCandidate = vi.fn();

    const result = await claudeAdapter.fetchCandidates(buildEnvelope(), { onCandidate });

    expect(onCandidate).not.toHaveBeenCalled();
    expect(result).toEqual([{ command: 'not json', explanation: '' }]);
  });

  it('rejects with an AbortError when the signal aborts, logging request aborted, not failed', async () => {
    scriptStream({ pieces: splitAt(TWO_CANDIDATES, [20, 60]), hangUntilAbort: true });
    const controller = new AbortController();
    const onCandidate = vi.fn(() => {
      controller.abort();
    });

    const error = await claudeAdapter
      .fetchCandidates(buildEnvelope(), { signal: controller.signal, onCandidate })
      .catch((caught: unknown) => caught);

    expect(isAbortError(error)).toBe(true);
    expect(onCandidate).toHaveBeenCalledTimes(1);
    const messages = providerDebugMessages();
    expect(messages).toContain('request aborted');
    expect(messages).not.toContain('request failed');
  });

  it('forwards options from claudeAdapter to the stream (onCandidate is called)', async () => {
    streamText(TWO_CANDIDATES);
    const onCandidate = vi.fn();

    await claudeAdapter.fetchCandidates(buildEnvelope(), { onCandidate });

    expect(onCandidate).toHaveBeenCalledTimes(2);
  });
});

describe('SDK effort as output_config (D-03)', () => {
  let previousModel: string | undefined;

  beforeEach(() => {
    previousModel = process.env.QQ_MODEL;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    delete process.env.QQ_MODEL;
    delete process.env.QQ_FORCE_SELECTOR;
    streamMock.mockReset();
    anthropicCtorMock.mockClear();
    appendDebugLogMock.mockClear();
    readEnvValueFromDotEnvLocalMock.mockReset();
    readEnvValueFromDotEnvLocalMock.mockReturnValue(null);
    resetAnthropicClientCache();
    streamText(TWO_CANDIDATES);
  });

  afterEach(() => {
    if (previousModel === undefined) {
      delete process.env.QQ_MODEL;
    } else {
      process.env.QQ_MODEL = previousModel;
    }
  });

  it('sends output_config.effort low on the default model with no config', async () => {
    await claudeAdapter.fetchCandidates(buildEnvelope());

    const request = streamRequest();
    expect(request.model).toBe('claude-sonnet-5');
    expect(request.output_config).toEqual({ effort: 'low' });
    expect(request).not.toHaveProperty('thinking');
  });

  it('sends the config.json effort level', async () => {
    writeQqConfig({ effort: 'high' });

    await claudeAdapter.fetchCandidates(buildEnvelope());

    expect(streamRequest().output_config).toEqual({ effort: 'high' });
  });

  it.each([
    'claude-haiku-4-5',
    'claude-sonnet-4-5',
  ])('omits output_config when QQ_MODEL=%s rejects effort', async (model) => {
    process.env.QQ_MODEL = model;

    await claudeAdapter.fetchCandidates(buildEnvelope());

    const request = streamRequest();
    expect(request.model).toBe(model);
    expect(request).not.toHaveProperty('output_config');
  });

  it('keeps output_config when QQ_MODEL names a model with effort support', async () => {
    process.env.QQ_MODEL = 'claude-opus-5-5';

    await claudeAdapter.fetchCandidates(buildEnvelope());

    expect(streamRequest().output_config).toEqual({ effort: 'low' });
  });

  it.each([
    ['claude-sonnet-5', { effort: 'medium' }],
    ['claude-opus-5-5', { effort: 'medium' }],
    ['claude-haiku-4-5', undefined],
    ['claude-sonnet-4-5', undefined],
    ['claude-3-7-sonnet-latest', undefined],
    ['claude-sonnet-4-20250514', undefined],
  ])('sdkOutputConfig(%s, medium) is %o', (model, expected) => {
    expect(sdkOutputConfig(model, 'medium')).toEqual(expected);
  });

  it('logs the effort on request start without secrets, argv or env', async () => {
    writeQqConfig({ effort: 'max' });

    await claudeAdapter.fetchCandidates(buildEnvelope());

    const start = appendDebugLogMock.mock.calls.find(
      (call) => call[0] === 'provider' && call[1] === 'request start',
    );
    expect((start?.[2] as { effort?: string } | undefined)?.effort).toBe('max');
    expect(JSON.stringify(appendDebugLogMock.mock.calls)).not.toMatch(FORBIDDEN_DEBUG);
  });

  it('logs effort none on request start when the model rejects effort', async () => {
    process.env.QQ_MODEL = 'claude-haiku-4-5';

    await claudeAdapter.fetchCandidates(buildEnvelope());

    const start = appendDebugLogMock.mock.calls.find(
      (call) => call[0] === 'provider' && call[1] === 'request start',
    );
    expect((start?.[2] as { effort?: string } | undefined)?.effort).toBe('none');
  });
});
