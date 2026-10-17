import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextEnvelope } from '../src/contracts/request.js';
import { fetchCandidatesForUi } from '../src/daemon/fetch-client.js';
import { buildPrompt, QUEQUE_SYSTEM } from '../src/providers/claude.js';
import {
  fetchOllamaCandidates,
  OLLAMA_TIMEOUT_MS,
  ollamaAdapter,
} from '../src/providers/ollama.js';
import { isAbortError } from '../src/providers/provider.js';
import { resolveProviderAdapter } from '../src/providers/provider-pin.js';
import { buildSystemPrompt } from '../src/providers/steering.js';
import { bootstrapBuiltins, resetBootstrap } from '../src/registry/bootstrap.js';
import { clearContextProviders } from '../src/registry/context-providers.js';
import { clearProviderBackends, getProviderAdapter } from '../src/registry/provider-backends.js';
import { clearShellAdapters } from '../src/registry/shell-adapters.js';
import { clearStorageHooks } from '../src/registry/storage-hooks.js';
import { resetQqConfigCache } from '../src/shared/qq-config.js';

const { createMock, execFileAsyncMock, runClaudeTurnMock, appendDebugLogMock, AnthropicMock } =
  vi.hoisted(() => {
    const createMock = vi.fn();

    class AnthropicMock {
      messages: {
        create: typeof createMock;
        stream: (params: unknown, requestOptions?: unknown) => unknown;
      };

      constructor() {
        this.messages = {
          create: createMock,
          // Every SDK Messages request (create or stream) is recorded by createMock.
          stream: (params, requestOptions) => createMock(params, requestOptions),
        };
      }
    }

    return {
      createMock,
      execFileAsyncMock: vi.fn(),
      runClaudeTurnMock: vi.fn(),
      appendDebugLogMock: vi.fn().mockResolvedValue(undefined),
      AnthropicMock,
    };
  });

vi.mock('@anthropic-ai/sdk', () => ({
  default: AnthropicMock,
}));

vi.mock('../src/providers/claude-exec.js', () => ({
  execFileAsync: execFileAsyncMock,
}));

vi.mock('../src/providers/claude-process.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/providers/claude-process.js')>();
  return { ...actual, runClaudeTurn: runClaudeTurnMock };
});

vi.mock('../src/shared/debug-log.js', () => ({
  appendDebugLog: appendDebugLogMock,
}));

const QUERY = 'list-every-file-xyz';
const CANDIDATE_JSON = '[{"command":"ls -la","explanation":"List files"}]';

type FetchArgs = [input: URL | string, init?: RequestInit];
type ChatBody = {
  model: string;
  stream: boolean;
  messages: Array<{ role: string; content: string }>;
  [key: string]: unknown;
};

function buildEnvelope(extras: ContextEnvelope['extras'] = []): ContextEnvelope {
  return {
    base: {
      queryText: QUERY,
      cwd: '/repo',
      ttyPath: '/dev/tty',
      shellPid: 1234,
      shellName: 'zsh',
      platform: 'darwin',
      timestamp: '2026-10-07T00:00:00.000Z',
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

function chatResponse(content: unknown, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      model: 'gemma4',
      message: { role: 'assistant', content },
      done: true,
      done_reason: 'stop',
      ...extra,
    }),
    { status: 200 },
  );
}

function connectionError(code: string): TypeError {
  const cause = Object.assign(new Error(`connect ${code} 127.0.0.1:11434`), { code });
  return Object.assign(new TypeError('fetch failed'), { cause });
}

function resetRegistries(): void {
  clearContextProviders();
  clearProviderBackends();
  clearShellAdapters();
  clearStorageHooks();
  resetBootstrap();
}

let pinDir: string;
let pinFile: string;
let fetchStub: ReturnType<typeof vi.fn<(...args: FetchArgs) => Promise<Response>>>;

function pinOllama(extra: Record<string, unknown> = {}): void {
  fs.writeFileSync(
    pinFile,
    JSON.stringify({ version: 1, provider: 'ollama', model: 'gemma4', ...extra }),
  );
}

function sentBody(): ChatBody {
  const init = fetchStub.mock.calls[0]?.[1];
  return JSON.parse(String(init?.body)) as ChatBody;
}

function expectNoClaudeCall(): void {
  expect(createMock).not.toHaveBeenCalled();
  expect(execFileAsyncMock).not.toHaveBeenCalled();
  expect(runClaudeTurnMock).not.toHaveBeenCalled();
}

async function failure(): Promise<Error> {
  const caught = await ollamaAdapter
    .fetchCandidates(buildEnvelope())
    .catch((error: unknown) => error);
  expect(caught).toBeInstanceOf(Error);
  return caught as Error;
}

beforeEach(() => {
  resetRegistries();
  bootstrapBuiltins();
  createMock.mockReset();
  execFileAsyncMock.mockReset();
  runClaudeTurnMock.mockReset();
  appendDebugLogMock.mockClear();
  pinDir = fs.mkdtempSync(join(tmpdir(), 'qq-ollama-'));
  pinFile = join(pinDir, 'provider.json');
  vi.stubEnv('QQ_PROVIDER_FILE', pinFile);
  vi.stubEnv('QQ_CONFIG_FILE', join(pinDir, 'config.json'));
  vi.stubEnv('QQ_FORCE_SELECTOR', '0');
  // A key is present, so any silent fallback to Claude would reach the SDK mock.
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  resetQqConfigCache();
  fetchStub = vi.fn<(...args: FetchArgs) => Promise<Response>>();
  vi.stubGlobal('fetch', fetchStub);
  pinOllama();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fs.rmSync(pinDir, { recursive: true, force: true });
});

describe('Ollama request shape and privacy', () => {
  it('posts model, stream false, and the shared system and user prompts', async () => {
    fetchStub.mockResolvedValue(chatResponse(CANDIDATE_JSON));
    const envelope = buildEnvelope();

    const candidates = await ollamaAdapter.fetchCandidates(envelope);

    expect(candidates).toEqual([{ command: 'ls -la', explanation: 'List files' }]);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [url, init] = fetchStub.mock.calls[0] ?? [];
    expect(String(url)).toBe('http://localhost:11434/api/chat');
    expect(init?.method).toBe('POST');
    const body = sentBody();
    expect(Object.keys(body).sort()).toEqual(['messages', 'model', 'stream']);
    expect(body.model).toBe('gemma4');
    expect(body.stream).toBe(false);
    expect(body.messages).toEqual([
      { role: 'system', content: buildSystemPrompt(envelope) },
      { role: 'user', content: buildPrompt(envelope) },
    ]);
    expect(body.messages[0]?.content).toBe(QUEQUE_SYSTEM);
    expectNoClaudeCall();
  });

  it('sends the installed-tools steering in the system message', async () => {
    fetchStub.mockResolvedValue(chatResponse(CANDIDATE_JSON));
    const envelope = buildEnvelope([{ kind: 'installed-tools', payload: { tools: ['fd'] } }]);

    await ollamaAdapter.fetchCandidates(envelope);

    const system = sentBody().messages[0]?.content;
    expect(system).toBe(buildSystemPrompt(envelope));
    expect(system).toContain('fd');
  });

  it('honors a custom baseUrl from the pin', async () => {
    pinOllama({ baseUrl: 'http://127.0.0.1:9999' });
    fetchStub.mockResolvedValue(chatResponse(CANDIDATE_JSON));

    await ollamaAdapter.fetchCandidates(buildEnvelope());

    expect(String(fetchStub.mock.calls[0]?.[0])).toBe('http://127.0.0.1:9999/api/chat');
  });

  it('sends no authorization header', async () => {
    fetchStub.mockResolvedValue(chatResponse(CANDIDATE_JSON));

    await ollamaAdapter.fetchCandidates(buildEnvelope());

    const headers = new Headers(fetchStub.mock.calls[0]?.[1]?.headers);
    expect(headers.has('authorization')).toBe(false);
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('keeps a .env changed file out of the request body', async () => {
    fetchStub.mockResolvedValue(chatResponse(CANDIDATE_JSON));

    await ollamaAdapter.fetchCandidates(gitEnvelopeWithSecretFile());

    const raw = String(fetchStub.mock.calls[0]?.[1]?.body);
    expect(raw).toContain('src/index.ts');
    expect(raw).not.toContain('.env');
  });

  it('refuses to run when Ollama is not the pinned provider', async () => {
    fs.writeFileSync(pinFile, '{"version":1,"provider":"claude"}');

    const error = await failure();

    expect(error.message).toMatch(/Ollama is not the pinned provider/);
    expect(fetchStub).not.toHaveBeenCalled();
    expectNoClaudeCall();
  });
});

describe('Ollama failure mapping (no Claude fallback)', () => {
  it('maps a refused connection to the ollama serve hint', async () => {
    fetchStub.mockRejectedValue(connectionError('ECONNREFUSED'));

    const error = await failure();

    expect(error.message.startsWith('QueQue:')).toBe(true);
    expect(error.message).toContain('not reachable');
    expect(error.message).toContain('http://localhost:11434');
    expect(error.message).toContain('ollama serve');
    expect(error.message).toContain('qq init provider');
    expectNoClaudeCall();
  });

  it.each(['ENOTFOUND', 'EHOSTUNREACH'])('maps %s to the not reachable hint', async (code) => {
    fetchStub.mockRejectedValue(connectionError(code));

    const error = await failure();

    expect(error.message).toContain('not reachable');
    expectNoClaudeCall();
  });

  it('maps HTTP 404 to the ollama pull hint for the pinned model', async () => {
    fetchStub.mockResolvedValue(
      new Response('{"error":"model \\"gemma4\\" not found, try pulling it first"}', {
        status: 404,
      }),
    );

    const error = await failure();

    expect(error.message.startsWith('QueQue:')).toBe(true);
    expect(error.message).toContain('ollama pull gemma4');
    expect(error.message).toContain('qq init provider');
    expectNoClaudeCall();
  });

  it('maps a timeout to a plain retry message naming 25s', async () => {
    fetchStub.mockRejectedValue(
      new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
    );

    const error = await failure();

    expect(error.message.startsWith('QueQue:')).toBe(true);
    expect(error.message).toContain('25s');
    expect(error.message).toContain('Try ?? again');
    expectNoClaudeCall();
  });

  it('aborts a hung request after the timeout budget', async () => {
    fetchStub.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    );

    const error = await fetchOllamaCandidates(
      buildEnvelope(),
      { baseUrl: 'http://localhost:11434', model: 'gemma4' },
      30,
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('did not answer within');
    expect(OLLAMA_TIMEOUT_MS).toBe(25_000);
    expectNoClaudeCall();
  });

  it('maps HTTP 500 to the status and the Ollama error field', async () => {
    fetchStub.mockResolvedValue(new Response('{"error":"boom"}', { status: 500 }));

    const error = await failure();

    expect(error.message.startsWith('QueQue:')).toBe(true);
    expect(error.message).toContain('HTTP 500');
    expect(error.message).toContain('boom');
    expect(error.message).toContain('qq init provider');
    expectNoClaudeCall();
  });

  it('keeps a long multi-line Ollama error field on one short line', async () => {
    const detail = `line one\nline two ${'x'.repeat(400)}`;
    fetchStub.mockResolvedValue(new Response(JSON.stringify({ error: detail }), { status: 500 }));

    const error = await failure();

    expect(error.message).not.toContain('\n');
    expect(error.message).toContain('line one line two');
    expect(error.message.length).toBeLessThan(320);
  });

  it.each([
    ['no message.content', JSON.stringify({ model: 'gemma4', done: true })],
    ['a non-string content', JSON.stringify({ message: { role: 'assistant', content: 42 } })],
    ['a body that is not JSON', 'not json at all'],
  ])('maps a 2xx with %s to unexpected response', async (_name, raw) => {
    fetchStub.mockResolvedValue(new Response(raw, { status: 200 }));

    const error = await failure();

    expect(error.message.startsWith('QueQue:')).toBe(true);
    expect(error.message).toContain('unexpected response');
    expect(error.message).toContain('qq init provider');
    expectNoClaudeCall();
  });

  it('never turns a cut-off answer into a prose command (done_reason length)', async () => {
    fetchStub.mockResolvedValue(
      chatResponse('Here are some ways to list fil', { done_reason: 'length' }),
    );

    const error = await failure();

    expect(error.message.startsWith('QueQue:')).toBe(true);
    expect(error.message).toContain('cut off');
    expectNoClaudeCall();
  });

  it('keeps the closed candidates of a cut-off answer', async () => {
    fetchStub.mockResolvedValue(
      chatResponse('[{"command":"ls -la","explanation":"List files"},{"command":"ls -', {
        done_reason: 'length',
      }),
    );

    const candidates = await ollamaAdapter.fetchCandidates(buildEnvelope());

    expect(candidates).toEqual([{ command: 'ls -la', explanation: 'List files' }]);
  });

  it('rethrows a user abort unmapped', async () => {
    const controller = new AbortController();
    fetchStub.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
            once: true,
          });
          controller.abort();
        }),
    );

    const error = await ollamaAdapter
      .fetchCandidates(buildEnvelope(), { signal: controller.signal })
      .catch((caught: unknown) => caught);

    expect(isAbortError(error)).toBe(true);
    expectNoClaudeCall();
  });
});

describe('Ollama debug log', () => {
  it('logs model, status and duration only — no prompt, messages, or response', async () => {
    fetchStub.mockResolvedValue(chatResponse(CANDIDATE_JSON));

    await ollamaAdapter.fetchCandidates(buildEnvelope());

    const requestLines = appendDebugLogMock.mock.calls.filter(
      (call) => call[1] === 'ollama request',
    );
    expect(requestLines).toHaveLength(1);
    expect(Object.keys(requestLines[0]?.[2] as object).sort()).toEqual([
      'durationMs',
      'model',
      'status',
    ]);
    expect(requestLines[0]?.[2]).toMatchObject({ model: 'gemma4', status: 200 });
    const serialized = JSON.stringify(appendDebugLogMock.mock.calls);
    expect(serialized).not.toContain(QUERY);
    expect(serialized).not.toContain('messages');
    expect(serialized).not.toContain('ls -la');
    expect(serialized).not.toContain('11434');
  });

  it('logs no prompt or error body on a failure', async () => {
    fetchStub.mockResolvedValue(new Response('{"error":"boom-detail"}', { status: 500 }));

    await failure();

    const serialized = JSON.stringify(appendDebugLogMock.mock.calls);
    expect(serialized).not.toContain(QUERY);
    expect(serialized).not.toContain('boom-detail');
  });
});

describe('pinned Ollama resolution', () => {
  it('resolves the registered ollama backend for an ollama pin', () => {
    expect(resolveProviderAdapter()).toBe(getProviderAdapter('ollama'));
  });

  it('daemon-down fallback calls Ollama, not the Claude default', async () => {
    fetchStub.mockResolvedValue(chatResponse(CANDIDATE_JSON));

    const candidates = await fetchCandidatesForUi('/tmp/qq-missing-ollama.sock', buildEnvelope());

    expect(candidates).toEqual([{ command: 'ls -la', explanation: 'List files' }]);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(String(fetchStub.mock.calls[0]?.[0])).toBe('http://localhost:11434/api/chat');
    expectNoClaudeCall();
  });
});
