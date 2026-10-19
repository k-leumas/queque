import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextEnvelope } from '../src/contracts/request.js';
import { fetchCandidatesForUi } from '../src/daemon/fetch-client.js';
import {
  buildPrompt,
  finalCandidateListWithoutProse,
  QUEQUE_SYSTEM,
  strictCandidateListWithoutProse,
  stripThinking,
  TRUNCATED_RESPONSE_MESSAGE,
  UNPARSEABLE_RESPONSE_MESSAGE,
} from '../src/providers/claude.js';
import {
  fetchOllamaCandidates,
  OLLAMA_NUM_CTX,
  OLLAMA_NUM_PREDICT,
  OLLAMA_TIMEOUT_MS,
  ollamaAdapter,
  ollamaApiUrl,
} from '../src/providers/ollama.js';
import { isAbortError } from '../src/providers/provider.js';
import { resolveProviderAdapter } from '../src/providers/provider-pin.js';
import { buildSystemPrompt } from '../src/providers/steering.js';
import { CANDIDATE_LIST_JSON_SCHEMA } from '../src/providers/structured-output.js';
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
  it('posts model, stream false, think false, the schema, options and the prompts', async () => {
    fetchStub.mockResolvedValue(chatResponse(CANDIDATE_JSON));
    const envelope = buildEnvelope();

    const candidates = await ollamaAdapter.fetchCandidates(envelope);

    expect(candidates).toEqual([{ command: 'ls -la', explanation: 'List files' }]);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [url, init] = fetchStub.mock.calls[0] ?? [];
    expect(String(url)).toBe('http://localhost:11434/api/chat');
    expect(init?.method).toBe('POST');
    const body = sentBody();
    expect(Object.keys(body).sort()).toEqual([
      'format',
      'messages',
      'model',
      'options',
      'stream',
      'think',
    ]);
    expect(body.model).toBe('gemma4');
    expect(body.stream).toBe(false);
    expect(body.think).toBe(false);
    expect(body.format).toEqual(CANDIDATE_LIST_JSON_SCHEMA);
    expect(body.options).toEqual({ num_predict: 2048, num_ctx: 8192 });
    expect(body.messages).toEqual([
      { role: 'system', content: buildSystemPrompt(envelope) },
      { role: 'user', content: buildPrompt(envelope) },
    ]);
    expect(body.messages[0]?.content).toBe(QUEQUE_SYSTEM);
    expectNoClaudeCall();
  });

  it('sizes num_predict and num_ctx to the 25 s budget, not the 16k SDK cap (WR-15)', () => {
    expect(OLLAMA_NUM_PREDICT).toBe(2048);
    expect(OLLAMA_NUM_CTX).toBe(8192);
    // The prompt (about 3 chars per token, a conservative estimate) plus the output cap
    // must fit the window, or Ollama would truncate the prompt.
    const envelope = buildEnvelope([
      { kind: 'installed-tools', payload: { tools: ['fd', 'rg', 'jq', 'bat'] } },
    ]);
    const promptChars = buildSystemPrompt(envelope).length + buildPrompt(envelope).length;
    expect(Math.ceil(promptChars / 3) + OLLAMA_NUM_PREDICT).toBeLessThanOrEqual(OLLAMA_NUM_CTX);
  });

  it('sends the same options on the cut-off retry, so the model is never reloaded', async () => {
    fetchStub
      .mockResolvedValueOnce(chatResponse('[{"command":"ls -', { done_reason: 'length' }))
      .mockResolvedValueOnce(chatResponse(CANDIDATE_JSON));

    await ollamaAdapter.fetchCandidates(buildEnvelope());

    expect(fetchStub).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(String(fetchStub.mock.calls[1]?.[1]?.body)) as ChatBody;
    expect(retryBody.options).toEqual({ num_predict: 2048, num_ctx: 8192 });
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

  it.each([
    ['https://gpu.lan/ollama', 'https://gpu.lan/ollama/api/chat'],
    ['https://gpu.lan/ollama/', 'https://gpu.lan/ollama/api/chat'],
    ['http://127.0.0.1:9999/', 'http://127.0.0.1:9999/api/chat'],
  ])('keeps the path prefix of baseUrl %s (WR-06)', async (baseUrl, expected) => {
    pinOllama({ baseUrl });
    fetchStub.mockResolvedValue(chatResponse(CANDIDATE_JSON));

    await ollamaAdapter.fetchCandidates(buildEnvelope());

    expect(String(fetchStub.mock.calls[0]?.[0])).toBe(expected);
  });

  it.each([
    ['http://h/ollama?x=1', 'http://h/ollama/api/chat'],
    ['http://h/ollama#f', 'http://h/ollama/api/chat'],
    ['http://h/ollama/?x=1#f', 'http://h/ollama/api/chat'],
    ['http://h', 'http://h/api/chat'],
  ])('keeps the path prefix of baseUrl %s with a query or fragment (IN-11)', async (baseUrl, expected) => {
    pinOllama({ baseUrl });
    fetchStub.mockResolvedValue(chatResponse(CANDIDATE_JSON));

    await ollamaAdapter.fetchCandidates(buildEnvelope());

    expect(String(fetchStub.mock.calls[0]?.[0])).toBe(expected);
  });

  it('builds the tags URL the same way (IN-11)', () => {
    expect(String(ollamaApiUrl('https://gpu.lan/ollama?x=1', 'api/tags'))).toBe(
      'https://gpu.lan/ollama/api/tags',
    );
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

  it.each([
    ['an HTML proxy page', '<html><body>404 Not Found</body></html>'],
    ['an unrelated JSON error', '{"error":"no route"}'],
  ])('maps a 404 with %s to the URL, not to ollama pull (WR-06)', async (_name, body) => {
    pinOllama({ baseUrl: 'https://gpu.lan/ollama' });
    fetchStub.mockResolvedValue(new Response(body, { status: 404 }));

    const error = await failure();

    expect(error.message.startsWith('QueQue:')).toBe(true);
    expect(error.message).toContain('HTTP 404 from https://gpu.lan');
    expect(error.message).toContain('baseUrl');
    expect(error.message).not.toContain('ollama pull');
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

  it('strips terminal control bytes from a remote error field (WR-04)', async () => {
    const detail = 'bad\u001b]52;c;cm0gLXJmIH4=\u0007 thing\u009b2J\r';
    fetchStub.mockResolvedValue(new Response(JSON.stringify({ error: detail }), { status: 500 }));

    const error = await failure();

    expect(error.message).toContain('HTTP 500');
    expect(error.message).toContain('bad');
    expect(error.message).not.toMatch(/[\p{Cc}]/u);
  });

  it('replaces bidi and format characters in a remote error field (IN-15)', async () => {
    const detail = 'model ‮gnp.exe‬ is ⁦busy⁩​ now﻿';
    fetchStub.mockResolvedValue(new Response(JSON.stringify({ error: detail }), { status: 500 }));

    const error = await failure();

    expect(error.message).toContain('HTTP 500');
    expect(error.message).toContain('gnp.exe');
    expect(error.message).not.toMatch(/[\p{Cc}\p{Cf}]/u);
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
    fetchStub.mockImplementation(async () =>
      chatResponse('Here are some ways to list fil', { done_reason: 'length' }),
    );

    const error = await failure();

    expect(error.message.startsWith('QueQue:')).toBe(true);
    expect(error.message).toContain('cut off');
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expectNoClaudeCall();
  });

  it('strips terminal control bytes from candidate text, keeping newlines (WR-04)', async () => {
    fetchStub.mockResolvedValue(
      chatResponse(
        JSON.stringify([
          { command: 'ls\u001b[2J -la', explanation: 'List\u001b]52;c;eA==\u0007 files\u009b' },
          { command: '\u001b\u0007', explanation: 'only control bytes' },
          { command: 'printf "a\\n"\nprintf "b"', explanation: 'Two lines' },
        ]),
      ),
    );

    const candidates = await ollamaAdapter.fetchCandidates(buildEnvelope());

    expect(candidates).toEqual([
      { command: 'ls[2J -la', explanation: 'List]52;c;eA== files' },
      { command: 'printf "a\\n"\nprintf "b"', explanation: 'Two lines' },
    ]);
  });

  it('strips bidi and zero-width format characters from candidate text (IN-12)', async () => {
    fetchStub.mockResolvedValue(
      chatResponse(
        JSON.stringify([
          { command: 'rm -rf \u202e/tmp/x', explanation: 'Remove\u2066 it\u2069' },
          { command: 'ls\u200b\u200d -la\ufeff', explanation: 'List\u00ad files' },
        ]),
      ),
    );

    const candidates = await ollamaAdapter.fetchCandidates(buildEnvelope());

    expect(candidates).toEqual([
      { command: 'rm -rf /tmp/x', explanation: 'Remove it' },
      { command: 'ls -la', explanation: 'List files' },
    ]);
  });

  it('maps an answer whose commands are only control bytes to unexpected response (IN-13)', async () => {
    fetchStub.mockResolvedValue(
      chatResponse(
        JSON.stringify([{ command: '\u001b\u0007', explanation: 'only control bytes' }]),
      ),
    );

    const error = await failure();

    expect(error.message.startsWith('QueQue:')).toBe(true);
    expect(error.message).toContain('unexpected response');
    expectNoClaudeCall();
  });

  it.each([
    [
      'a prose-wrapped json fence',
      'Here are some commands:\n```json\n[{"command":"ls -la","explanation":"List files"}]\n```\nHope it helps!',
    ],
    [
      'a think block first',
      '<think>The user wants [files] listed, maybe {ls}.</think>\n[{"command":"ls -la","explanation":"List files"}]',
    ],
    [
      'a trailing comment',
      '[{"command":"ls -la","explanation":"List files"}]\n(These work on macOS.)',
    ],
    [
      'brackets in the prose before the array',
      'Options [pick one]:\n[{"command":"ls -la","explanation":"List files"}]',
    ],
  ])('reads candidates from %s, never the whole text (WR-05)', async (_name, content) => {
    fetchStub.mockResolvedValue(chatResponse(content));

    const candidates = await ollamaAdapter.fetchCandidates(buildEnvelope());

    expect(candidates).toEqual([{ command: 'ls -la', explanation: 'List files' }]);
  });

  it('reads the answer after an orphan </think>, never the draft before it (WR-09)', async () => {
    fetchStub.mockResolvedValue(
      chatResponse(
        'Draft: [{"command":"rm -rf ~/build","explanation":"draft"}] no wait, safer.\n' +
          '</think>\n[{"command":"ls build","explanation":"List build"}]',
      ),
    );

    const candidates = await ollamaAdapter.fetchCandidates(buildEnvelope());

    expect(candidates).toEqual([{ command: 'ls build', explanation: 'List build' }]);
  });

  it('never returns a draft from unclosed thinking in a cut-off answer (WR-09)', async () => {
    fetchStub.mockImplementation(async () =>
      chatResponse(
        '<think>Maybe [{"command":"git reset --hard","explanation":"draft"}] hmm, but that loses',
        { done_reason: 'length' },
      ),
    );

    const error = await failure();

    expect(error.message.startsWith('QueQue:')).toBe(true);
    expect(error.message).toContain('cut off');
    expect(error.message).not.toContain('git reset');
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expectNoClaudeCall();
  });

  it('maps a normal-stop answer with no candidates to unexpected response (WR-05)', async () => {
    fetchStub.mockResolvedValue(
      chatResponse('You can list files with ls.\nUse ls -la for hidden files too.'),
    );

    const error = await failure();

    expect(error.message.startsWith('QueQue:')).toBe(true);
    expect(error.message).toContain('unexpected response');
    expect(error.message).not.toContain('ls -la');
    expectNoClaudeCall();
  });

  it('keeps the closed candidates of a cut-off answer when the retry closes none', async () => {
    fetchStub
      .mockResolvedValueOnce(
        chatResponse('[{"command":"ls -la","explanation":"List files"},{"command":"ls -', {
          done_reason: 'length',
        }),
      )
      .mockResolvedValueOnce(chatResponse('[{"command":"rm -', { done_reason: 'length' }));

    const candidates = await ollamaAdapter.fetchCandidates(buildEnvelope());

    expect(candidates).toEqual([{ command: 'ls -la', explanation: 'List files' }]);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('retries a cut-off answer once with the same body, then shows cut off', async () => {
    fetchStub.mockImplementation(async () =>
      chatResponse('[{"command":"rm -rf', { done_reason: 'length' }),
    );

    const error = await failure();

    expect(error.message).toMatch(/cut off/);
    expect(error.message).not.toContain('rm -rf');
    expect(fetchStub).toHaveBeenCalledTimes(2);
    const [first, second] = fetchStub.mock.calls;
    expect(String(second?.[1]?.body)).toBe(String(first?.[1]?.body));
    expectNoClaudeCall();
  });

  it('returns the retry candidates after a cut-off first answer', async () => {
    fetchStub
      .mockResolvedValueOnce(chatResponse('[{"command":"rm -', { done_reason: 'length' }))
      .mockResolvedValueOnce(chatResponse(CANDIDATE_JSON));

    const candidates = await ollamaAdapter.fetchCandidates(buildEnvelope());

    expect(candidates).toEqual([{ command: 'ls -la', explanation: 'List files' }]);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('sends the retry on the same signal (one shared budget)', async () => {
    fetchStub
      .mockResolvedValueOnce(chatResponse('[{"command":"rm -', { done_reason: 'length' }))
      .mockResolvedValueOnce(chatResponse(CANDIDATE_JSON));

    await ollamaAdapter.fetchCandidates(buildEnvelope());

    const [first, second] = fetchStub.mock.calls;
    expect(first?.[1]?.signal).toBeDefined();
    expect(second?.[1]?.signal).toBe(first?.[1]?.signal);
  });

  it('rethrows a user abort fired during the retry', async () => {
    const controller = new AbortController();
    fetchStub
      .mockResolvedValueOnce(chatResponse('[{"command":"rm -', { done_reason: 'length' }))
      .mockImplementationOnce(
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
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expectNoClaudeCall();
  });

  it('returns a complete array from a done_reason length reply without retrying', async () => {
    fetchStub.mockResolvedValueOnce(chatResponse(CANDIDATE_JSON, { done_reason: 'length' }));

    const candidates = await ollamaAdapter.fetchCandidates(buildEnvelope());

    expect(candidates).toEqual([{ command: 'ls -la', explanation: 'List files' }]);
    expect(fetchStub).toHaveBeenCalledTimes(1);
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

describe('stripThinking and finalCandidateListWithoutProse (WR-09)', () => {
  const DRAFT = '[{"command":"rm -rf ~/build","explanation":"draft"}]';
  const FINAL = '[{"command":"ls build","explanation":"List build"}]';

  it('keeps only the text after the last </think>', () => {
    expect(stripThinking(`Draft: ${DRAFT} no wait.\n</think>\n${FINAL}`).trim()).toBe(FINAL);
    expect(stripThinking(`<think>a</think>${DRAFT}<THINK>b</THINK>${FINAL}`).trim()).toBe(FINAL);
  });

  it('drops an unclosed <think> through to the end of the text', () => {
    expect(stripThinking(`${FINAL}\n<think>${DRAFT} hmm`).trim()).toBe(FINAL);
    expect(stripThinking(`<think>${DRAFT} hmm`).trim()).toBe('');
  });

  it('returns the final answer after an orphan </think>, not the draft', () => {
    expect(
      finalCandidateListWithoutProse(`Draft: ${DRAFT} no wait.\n</think>\n${FINAL}`, true),
    ).toEqual([{ command: 'ls build', explanation: 'List build' }]);
  });

  it('throws TRUNCATED_RESPONSE_MESSAGE for a draft inside cut-off thinking', () => {
    expect(() => finalCandidateListWithoutProse(`<think>Maybe ${DRAFT} hmm, but`, false)).toThrow(
      TRUNCATED_RESPONSE_MESSAGE,
    );
  });

  it('throws UNPARSEABLE_RESPONSE_MESSAGE for a draft inside unclosed thinking at a normal stop', () => {
    expect(() => finalCandidateListWithoutProse(`<think>Maybe ${DRAFT} hmm`, true)).toThrow(
      UNPARSEABLE_RESPONSE_MESSAGE,
    );
  });

  const WRAPPED = '{"candidates":[{"command":"ls -la","explanation":"List files"}]}';
  const LS = [{ command: 'ls -la', explanation: 'List files' }];

  it.each([
    ['a candidates object', WRAPPED],
    ['a candidates object in a json fence', `\`\`\`json\n${WRAPPED}\n\`\`\``],
    ['a candidates object after </think>', `<think>hmm</think>\n${WRAPPED}`],
    ['a bare array', CANDIDATE_JSON],
  ])('parses %s at a normal stop', (_name, text) => {
    expect(finalCandidateListWithoutProse(text, true)).toEqual(LS);
  });

  it('throws UNPARSEABLE_RESPONSE_MESSAGE for an empty candidates object at a normal stop', () => {
    expect(() => finalCandidateListWithoutProse('{"candidates":[]}', true)).toThrow(
      UNPARSEABLE_RESPONSE_MESSAGE,
    );
  });

  it('strictCandidateListWithoutProse rejects a cut-off wrapper and prose', () => {
    expect(strictCandidateListWithoutProse(WRAPPED)).toEqual(LS);
    expect(strictCandidateListWithoutProse('{"candidates":[{"command":"ls -')).toBeUndefined();
    expect(strictCandidateListWithoutProse('You can use ls -la.')).toBeUndefined();
  });
});

describe('think tags inside candidate strings (WR-13)', () => {
  const SED = { command: "sed -i 's/<think>//g' out.txt", explanation: 'Remove think tags' };
  const GREP = { command: "grep -c '</think>' run.log", explanation: 'count' };
  const LS_ROW = { command: 'ls', explanation: 'x' };
  const MENTION = { command: 'ls', explanation: 'no <think> here' };
  const PWD = { command: 'pwd', explanation: 'ok' };

  it.each([
    ['a <think> in a wrapped command', JSON.stringify({ candidates: [SED] }), [SED]],
    ['a </think> in a bare-array command', JSON.stringify([GREP, LS_ROW]), [GREP, LS_ROW]],
    ['a <think> in an explanation', JSON.stringify({ candidates: [MENTION, PWD] }), [MENTION, PWD]],
    ['a tag in a fenced answer', `\`\`\`json\n${JSON.stringify([GREP])}\n\`\`\``, [GREP]],
  ])('parses %s at a normal stop', (_name, text, expected) => {
    expect(finalCandidateListWithoutProse(text, true)).toEqual(expected);
    expect(strictCandidateListWithoutProse(text)).toEqual(expected);
  });

  it('keeps the closed row before a cut-off when a command holds <think>', () => {
    const cutOff = '{"candidates":[{"command":"echo <think>","explanation":"a"},{"comm';
    expect(finalCandidateListWithoutProse(cutOff, false)).toEqual([
      { command: 'echo <think>', explanation: 'a' },
    ]);
  });

  it('keeps the closed row before a cut-off when a command holds </think>', () => {
    const cutOff = '[{"command":"grep </think> a.log","explanation":"a"},{"command":"ls';
    expect(finalCandidateListWithoutProse(cutOff, false)).toEqual([
      { command: 'grep </think> a.log', explanation: 'a' },
    ]);
  });

  it('still drops a draft array before an orphan </think> outside any string (WR-09)', () => {
    const draft = '[{"command":"rm -rf ~/build","explanation":"draft"}] no wait </think>\n';
    expect(() =>
      finalCandidateListWithoutProse(`${draft}[{"command":"ls build","expl`, false),
    ).toThrow(TRUNCATED_RESPONSE_MESSAGE);
  });
});
