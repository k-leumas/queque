import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextEnvelope } from '../src/contracts/request.js';
import { fetchCandidatesForUi } from '../src/daemon/fetch-client.js';
import { buildPrompt } from '../src/providers/claude.js';
import {
  fetchOpenAiCandidates,
  OPENAI_CHAT_COMPLETIONS_URL,
  OPENAI_DEFAULT_MODEL,
  OPENAI_TIMEOUT_MS,
  openaiAdapter,
  resetOpenAiEffortCache,
} from '../src/providers/openai.js';
import { isAbortError } from '../src/providers/provider.js';
import { resolveProviderAdapter } from '../src/providers/provider-pin.js';
import { buildSystemPrompt } from '../src/providers/steering.js';
import { WRAPPED_CANDIDATE_LIST_JSON_SCHEMA } from '../src/providers/structured-output.js';
import { bootstrapBuiltins, resetBootstrap } from '../src/registry/bootstrap.js';
import { clearContextProviders } from '../src/registry/context-providers.js';
import { clearProviderBackends, getProviderAdapter } from '../src/registry/provider-backends.js';
import { clearShellAdapters } from '../src/registry/shell-adapters.js';
import { clearStorageHooks } from '../src/registry/storage-hooks.js';
import { resetQqConfigCache } from '../src/shared/qq-config.js';

const {
  createMock,
  execFileAsyncMock,
  runClaudeTurnMock,
  appendDebugLogMock,
  readEnvMock,
  AnthropicMock,
} = vi.hoisted(() => {
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
    readEnvMock: vi.fn<(key: string, startDir?: string) => string | null>(),
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

// usableSecret stays real; only the .env.local lookup is controllable.
vi.mock('../src/shared/env-file.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/shared/env-file.js')>();
  return { ...actual, readEnvValueFromDotEnvLocal: readEnvMock };
});

const KEY = 'sk-test-openai-key-123';
const QUERY = 'list-every-file-xyz';
const CANDIDATE_JSON = '[{"command":"ls -la","explanation":"List files"}]';

type FetchArgs = [input: URL | string, init?: RequestInit];
type ChatBody = {
  model: string;
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

function chatResponse(
  message: Record<string, unknown>,
  finishReason: string | null = 'stop',
): Response {
  return new Response(
    JSON.stringify({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      choices: [
        { index: 0, message: { role: 'assistant', ...message }, finish_reason: finishReason },
      ],
    }),
    { status: 200 },
  );
}

function contentResponse(content: string, finishReason: string | null = 'stop'): Response {
  return chatResponse({ content, refusal: null }, finishReason);
}

function errorResponse(status: number, error: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ error }), { status });
}

function networkError(code: string): TypeError {
  const cause = Object.assign(new Error(`getaddrinfo ${code} api.openai.com`), { code });
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

function pinOpenAi(extra: Record<string, unknown> = {}): void {
  fs.writeFileSync(pinFile, JSON.stringify({ version: 1, provider: 'openai', ...extra }));
}

function sentBody(index = 0): ChatBody {
  const init = fetchStub.mock.calls[index]?.[1];
  return JSON.parse(String(init?.body)) as ChatBody;
}

/** The `reasoning_effort` of every request, in order (undefined when the key is absent). */
function sentEfforts(): unknown[] {
  return fetchStub.mock.calls.map((_call, index) => sentBody(index).reasoning_effort);
}

function effortRejected(message = 'Unsupported value for reasoning_effort'): Response {
  return errorResponse(400, {
    message,
    type: 'invalid_request_error',
    param: 'reasoning_effort',
    code: 'unsupported_value',
  });
}

/** No Claude entry point and no other host (Ollama's localhost:11434) was touched. */
function expectNoFallback(): void {
  expect(createMock).not.toHaveBeenCalled();
  expect(execFileAsyncMock).not.toHaveBeenCalled();
  expect(runClaudeTurnMock).not.toHaveBeenCalled();
  for (const [input] of fetchStub.mock.calls) {
    expect(String(input)).toBe(OPENAI_CHAT_COMPLETIONS_URL);
    expect(String(input)).not.toContain('11434');
  }
}

async function failure(): Promise<Error> {
  const caught = await openaiAdapter
    .fetchCandidates(buildEnvelope())
    .catch((error: unknown) => error);
  expect(caught).toBeInstanceOf(Error);
  const error = caught as Error;
  expect(error.message.startsWith('QueQue:')).toBe(true);
  expectNoFallback();
  return error;
}

beforeEach(() => {
  resetRegistries();
  bootstrapBuiltins();
  createMock.mockReset();
  execFileAsyncMock.mockReset();
  runClaudeTurnMock.mockReset();
  appendDebugLogMock.mockClear();
  readEnvMock.mockReset();
  readEnvMock.mockReturnValue(null);
  pinDir = fs.mkdtempSync(join(tmpdir(), 'qq-openai-'));
  pinFile = join(pinDir, 'provider.json');
  vi.stubEnv('QQ_PROVIDER_FILE', pinFile);
  vi.stubEnv('QQ_CONFIG_FILE', join(pinDir, 'config.json'));
  vi.stubEnv('QQ_FORCE_SELECTOR', '0');
  vi.stubEnv('OPENAI_API_KEY', KEY);
  // A Claude key is present, so any silent fallback to Claude would reach the SDK mock.
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic-key');
  resetQqConfigCache();
  resetOpenAiEffortCache();
  fetchStub = vi.fn<(...args: FetchArgs) => Promise<Response>>();
  vi.stubGlobal('fetch', fetchStub);
  pinOpenAi();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fs.rmSync(pinDir, { recursive: true, force: true });
});

describe('OpenAI key handling', () => {
  it('uses the .env.local key when the exported key is whitespace-only', async () => {
    vi.stubEnv('OPENAI_API_KEY', '   ');
    readEnvMock.mockImplementation((key) => (key === 'OPENAI_API_KEY' ? 'sk-from-dotenv' : null));
    fetchStub.mockResolvedValue(contentResponse(CANDIDATE_JSON));

    await openaiAdapter.fetchCandidates(buildEnvelope());

    const headers = new Headers(fetchStub.mock.calls[0]?.[1]?.headers);
    expect(headers.get('authorization')).toBe('Bearer sk-from-dotenv');
  });

  it('fails before any network call when no key is set anywhere', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    readEnvMock.mockReturnValue('  ');

    const error = await failure();

    expect(error.message).toMatch(/OPENAI_API_KEY/);
    expect(error.message).toMatch(/qq init provider/);
    expect(error.message).toContain('~/.env.local');
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it.each([
    ['an embedded newline', 'sk-test-abc\ndef'],
    ['an inner space', 'sk-test-abc def'],
    ['a non-Latin-1 character', 'sk-test-abc\u2014def'],
  ])('reports a key with %s as invalid, not as unreachable (IN-05)', async (_name, key) => {
    vi.stubEnv('OPENAI_API_KEY', key);

    const error = await failure();

    expect(error.message).toContain('OPENAI_API_KEY contains invalid characters');
    expect(error.message).not.toContain('api.openai.com');
    expect(error.message).not.toContain('sk-test-abc');
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

describe('key-file copy names ~/.env.local (WR-11)', () => {
  // The daemon and the in-process fallback read only ~/.env.local (WR-08, WR-10). Copy that
  // says a bare `.env.local` sends users to create one in a project directory, where QueQue
  // never looks, so every `??` keeps failing with the same message.
  it.each([
    'src/providers/claude-default.ts',
    'src/providers/claude.ts',
    'src/providers/openai.ts',
  ])('no string literal in %s names .env.local without ~/', (file) => {
    const source = fs.readFileSync(join(process.cwd(), file), 'utf8');
    const literals = source.match(/'(?:[^'\\\n]|\\.)*'/g) ?? [];
    const bare = literals.filter((literal) => /(?<!~\/)\.env\.local/.test(literal));
    expect(bare).toEqual([]);
  });
});

describe('OpenAI request shape and privacy', () => {
  it('posts model, messages, the token cap, low effort and the strict schema', async () => {
    fetchStub.mockResolvedValue(contentResponse(CANDIDATE_JSON));
    const envelope = buildEnvelope();

    const candidates = await openaiAdapter.fetchCandidates(envelope);

    expect(candidates).toEqual([{ command: 'ls -la', explanation: 'List files' }]);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [url, init] = fetchStub.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://api.openai.com/v1/chat/completions');
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${KEY}`);
    expect(headers.get('content-type')).toBe('application/json');
    const body = sentBody();
    expect(Object.keys(body).sort()).toEqual([
      'max_completion_tokens',
      'messages',
      'model',
      'reasoning_effort',
      'response_format',
    ]);
    expect(body.max_completion_tokens).toBe(16000);
    expect(body.reasoning_effort).toBe('low');
    expect(body.response_format).toEqual({
      type: 'json_schema',
      json_schema: {
        name: 'command_candidates',
        strict: true,
        schema: WRAPPED_CANDIDATE_LIST_JSON_SCHEMA,
      },
    });
    for (const key of ['temperature', 'top_p', 'max_tokens']) {
      expect(body).not.toHaveProperty(key);
    }
    expect(body.model).toBe(OPENAI_DEFAULT_MODEL);
    expect(body.messages).toEqual([
      { role: 'developer', content: buildSystemPrompt(envelope) },
      { role: 'user', content: buildPrompt(envelope) },
    ]);
    expectNoFallback();
  });

  it('sends the installed-tools steering in the developer message', async () => {
    fetchStub.mockResolvedValue(contentResponse(CANDIDATE_JSON));
    const envelope = buildEnvelope([{ kind: 'installed-tools', payload: { tools: ['fd'] } }]);

    await openaiAdapter.fetchCandidates(envelope);

    const developer = sentBody().messages[0]?.content;
    expect(developer).toBe(buildSystemPrompt(envelope));
    expect(developer).toContain('fd');
  });

  it('keeps a .env changed file out of the request body', async () => {
    fetchStub.mockResolvedValue(contentResponse(CANDIDATE_JSON));

    await openaiAdapter.fetchCandidates(gitEnvelopeWithSecretFile());

    const raw = String(fetchStub.mock.calls[0]?.[1]?.body);
    expect(raw).toContain('src/index.ts');
    expect(raw).not.toContain('.env');
  });

  it('refuses to run when OpenAI is not the pinned provider', async () => {
    fs.writeFileSync(pinFile, '{"version":1,"provider":"claude"}');

    const error = await failure();

    expect(error.message).toMatch(/OpenAI is not the pinned provider/);
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

describe('OpenAI failure mapping (no Claude or Ollama fallback)', () => {
  it('maps HTTP 401 to a static key message without echoing the upstream text', async () => {
    fetchStub.mockResolvedValue(
      errorResponse(401, {
        message: 'Incorrect API key provided: sk-abc***wxyz',
        type: 'invalid_request_error',
        code: 'invalid_api_key',
      }),
    );

    const error = await failure();

    expect(error.message).toMatch(/HTTP 401/);
    expect(error.message).toMatch(/OPENAI_API_KEY/);
    expect(error.message).toMatch(/qq init provider/);
    expect(error.message).not.toContain('sk-abc');
    expect(error.message).not.toContain('Incorrect API key');
    expect(error.message).not.toContain(KEY);
  });

  it('maps HTTP 403 to the project access message', async () => {
    fetchStub.mockResolvedValue(errorResponse(403, { message: 'project denied', code: null }));

    const error = await failure();

    expect(error.message).toMatch(/HTTP 403/);
    expect(error.message).not.toContain('project denied');
  });

  it('maps HTTP 404 to the model name and the provider.json fix', async () => {
    pinOpenAi({ model: 'gpt-missing-model' });
    fetchStub.mockResolvedValue(
      errorResponse(404, { message: 'The model does not exist', code: 'model_not_found' }),
    );

    const error = await failure();

    expect(error.message).toMatch(/HTTP 404/);
    expect(error.message).toContain('gpt-missing-model');
    expect(error.message).toContain('provider.json');
    expect(error.message).not.toContain('does not exist');
  });

  it('maps HTTP 429 to the rate limit or quota message', async () => {
    fetchStub.mockResolvedValue(
      errorResponse(429, { message: 'You exceeded your quota', code: 'insufficient_quota' }),
    );

    const error = await failure();

    expect(error.message).toMatch(/HTTP 429/);
    expect(error.message).toMatch(/rate limit or quota/);
    expect(error.message).not.toContain('exceeded your quota');
  });

  it('maps other statuses to the status and a safe error code', async () => {
    fetchStub.mockResolvedValue(
      errorResponse(500, { message: 'The server had an error', code: 'server_error' }),
    );

    const error = await failure();

    expect(error.message).toMatch(/HTTP 500/);
    expect(error.message).toContain('server_error');
    expect(error.message).not.toContain('The server had an error');
  });

  it.each([
    ['an unsafe string', 'Bad Code! sk-abc***'],
    ['an overlong string', 'a'.repeat(65)],
    ['a number', 42],
  ])('drops an error code that is %s', async (_label, code) => {
    fetchStub.mockResolvedValue(errorResponse(502, { message: 'upstream', code }));

    const error = await failure();

    expect(error.message).toMatch(/HTTP 502/);
    expect(error.message).not.toContain('code');
    expect(error.message).not.toContain('sk-abc');
  });

  it('maps a non-JSON error body to the status alone', async () => {
    fetchStub.mockResolvedValue(new Response('<html>bad gateway</html>', { status: 503 }));

    const error = await failure();

    expect(error.message).toMatch(/HTTP 503/);
    expect(error.message).not.toContain('html');
  });

  it('maps a timeout to a retry message naming 25s', async () => {
    fetchStub.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));

    const error = await failure();

    expect(error.message).toMatch(/25s/);
    expect(OPENAI_TIMEOUT_MS).toBe(25_000);
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

    const error = await fetchOpenAiCandidates(buildEnvelope(), { model: 'gpt-x' }, 20).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/did not answer within 1s/);
    expectNoFallback();
  });

  it('maps a network failure to the api.openai.com reachability message', async () => {
    fetchStub.mockRejectedValue(networkError('ENOTFOUND'));

    const error = await failure();

    expect(error.message).toMatch(/api\.openai\.com/);
    expect(error.message).toMatch(/qq init provider/);
  });

  it('maps a refusal to the declined message', async () => {
    fetchStub.mockResolvedValue(chatResponse({ content: null, refusal: "I can't help" }));

    const error = await failure();

    expect(error.message).toMatch(/declined/);
    expect(error.message).not.toContain("I can't help");
  });

  it.each([
    ['no choices', new Response('{"id":"x"}', { status: 200 })],
    ['an empty choices array', new Response('{"choices":[]}', { status: 200 })],
    ['a non-JSON body', new Response('not json', { status: 200 })],
    ['content null without a refusal', chatResponse({ content: null, refusal: null })],
  ])('maps a 2xx body with %s to unexpected response', async (_label, response) => {
    fetchStub.mockResolvedValue(response);

    const error = await failure();

    expect(error.message).toMatch(/unexpected response/);
  });

  it('strips terminal control bytes from candidate text (WR-04)', async () => {
    fetchStub.mockResolvedValue(
      contentResponse(
        JSON.stringify([
          { command: 'git\u001b]0;pwned\u0007 status', explanation: 'Show\r status\u009b' },
        ]),
      ),
    );

    const candidates = await openaiAdapter.fetchCandidates(buildEnvelope());

    expect(candidates).toEqual([{ command: 'git]0;pwned status', explanation: 'Show status' }]);
    expectNoFallback();
  });

  it('maps an answer whose commands are only control bytes to unexpected response (IN-13)', async () => {
    fetchStub.mockResolvedValue(
      contentResponse(
        JSON.stringify([
          { command: '\u001b\u0007', explanation: 'only control bytes' },
          { command: ' \u009b ', explanation: 'a C1 byte and spaces' },
        ]),
      ),
    );

    const error = await failure();

    expect(error.message).toMatch(/unexpected response/);
    expectNoFallback();
  });

  it('reads candidates from a prose-wrapped answer, never the whole text (WR-05)', async () => {
    fetchStub.mockResolvedValue(
      contentResponse(
        'Sure! Try these:\n```json\n[{"command":"git status","explanation":"Show status"}]\n```',
      ),
    );

    const candidates = await openaiAdapter.fetchCandidates(buildEnvelope());

    expect(candidates).toEqual([{ command: 'git status', explanation: 'Show status' }]);
  });

  it('maps a normal-stop prose answer to unexpected response, not a command (WR-05)', async () => {
    fetchStub.mockResolvedValue(contentResponse('Run git status to see your changes.'));

    const error = await failure();

    expect(error.message).toContain('unexpected response');
    expect(error.message).not.toContain('git status');
  });

  it('never turns a cut-off answer into a prose command (finish_reason length)', async () => {
    fetchStub.mockImplementation(async () => contentResponse('[{"command":"rm -rf', 'length'));

    const error = await failure();

    expect(error.message).toMatch(/cut off/);
    expect(fetchStub).toHaveBeenCalledTimes(2);
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

    const error = await openaiAdapter
      .fetchCandidates(buildEnvelope(), { signal: controller.signal })
      .catch((caught: unknown) => caught);

    expect(isAbortError(error)).toBe(true);
    expectNoFallback();
  });
});

describe('OpenAI structured output, effort fallback and cut-off retry', () => {
  const LS = [{ command: 'ls -la', explanation: 'List files' }];
  const WRAPPED = JSON.stringify({ candidates: LS });
  const FRAGMENT = '{"candidates":[{"command":"rm -rf';

  it('reads a { candidates } answer', async () => {
    fetchStub.mockResolvedValue(contentResponse(WRAPPED));

    await expect(openaiAdapter.fetchCandidates(buildEnvelope())).resolves.toEqual(LS);
  });

  it('still reads a bare-array answer', async () => {
    fetchStub.mockResolvedValue(contentResponse(CANDIDATE_JSON));

    await expect(openaiAdapter.fetchCandidates(buildEnvelope())).resolves.toEqual(LS);
  });

  it('retries a cut-off answer once at the lowest effort on the same signal', async () => {
    fetchStub
      .mockResolvedValueOnce(contentResponse(FRAGMENT, 'length'))
      .mockResolvedValueOnce(contentResponse(WRAPPED));

    const candidates = await openaiAdapter.fetchCandidates(buildEnvelope());

    expect(candidates).toEqual(LS);
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expect(sentEfforts()).toEqual(['low', 'none']);
    const [first, second] = fetchStub.mock.calls;
    expect(first?.[1]?.signal).toBeDefined();
    expect(second?.[1]?.signal).toBe(first?.[1]?.signal);
    expectNoFallback();
  });

  it('shows cut off when the retry is cut off too, never a fragment', async () => {
    fetchStub.mockImplementation(async () => contentResponse(FRAGMENT, 'length'));

    const error = await failure();

    expect(error.message).toMatch(/cut off/);
    expect(error.message).not.toContain('rm -rf');
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('resends without reasoning_effort when the model rejects it, and remembers', async () => {
    fetchStub
      .mockResolvedValueOnce(effortRejected('Unsupported value: low. sk-proj-SECRET'))
      .mockImplementation(async () => contentResponse(WRAPPED));

    const candidates = await openaiAdapter.fetchCandidates(buildEnvelope());

    expect(candidates).toEqual(LS);
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expect(sentBody(1)).not.toHaveProperty('reasoning_effort');
    expect(JSON.stringify(appendDebugLogMock.mock.calls)).not.toContain('sk-proj-SECRET');

    fetchStub.mockClear();
    await openaiAdapter.fetchCandidates(buildEnvelope());

    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(sentBody(0)).not.toHaveProperty('reasoning_effort');
  });

  it('never leaks the upstream message of a rejected effort into an error', async () => {
    fetchStub
      .mockResolvedValueOnce(effortRejected('Unsupported value: low. sk-proj-SECRET'))
      .mockResolvedValueOnce(
        errorResponse(500, { message: 'sk-proj-SECRET', code: 'server_error' }),
      );

    const error = await failure();

    expect(error.message).toMatch(/HTTP 500/);
    expect(error.message).not.toContain('sk-proj-SECRET');
    expect(JSON.stringify(appendDebugLogMock.mock.calls)).not.toContain('sk-proj-SECRET');
  });

  it('walks none, minimal, then no effort on the retry past rejected values', async () => {
    fetchStub
      .mockResolvedValueOnce(contentResponse(FRAGMENT, 'length'))
      .mockResolvedValueOnce(effortRejected())
      .mockResolvedValueOnce(contentResponse(WRAPPED));

    const candidates = await openaiAdapter.fetchCandidates(buildEnvelope());

    expect(candidates).toEqual(LS);
    expect(sentEfforts()).toEqual(['low', 'none', 'minimal']);
  });

  it('remembers rejected retry efforts, so the next cut-off skips them (IN-18)', async () => {
    fetchStub
      .mockResolvedValueOnce(contentResponse(FRAGMENT, 'length'))
      .mockResolvedValueOnce(effortRejected())
      .mockResolvedValueOnce(effortRejected())
      .mockResolvedValueOnce(contentResponse(WRAPPED));

    await expect(openaiAdapter.fetchCandidates(buildEnvelope())).resolves.toEqual(LS);
    expect(sentEfforts()).toEqual(['low', 'none', 'minimal', 'low']);

    fetchStub.mockReset();
    fetchStub
      .mockResolvedValueOnce(contentResponse(FRAGMENT, 'length'))
      .mockResolvedValueOnce(contentResponse(WRAPPED));

    await expect(openaiAdapter.fetchCandidates(buildEnvelope())).resolves.toEqual(LS);
    expect(sentEfforts()).toEqual(['low', 'low']);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('keeps rejected retry efforts per model (IN-18)', async () => {
    fetchStub
      .mockResolvedValueOnce(contentResponse(FRAGMENT, 'length'))
      .mockResolvedValueOnce(effortRejected())
      .mockResolvedValueOnce(contentResponse(WRAPPED));
    await openaiAdapter.fetchCandidates(buildEnvelope());

    pinOpenAi({ model: 'gpt-other' });
    fetchStub.mockReset();
    fetchStub
      .mockResolvedValueOnce(contentResponse(FRAGMENT, 'length'))
      .mockResolvedValueOnce(contentResponse(WRAPPED));
    await openaiAdapter.fetchCandidates(buildEnvelope());

    expect(sentEfforts()).toEqual(['low', 'none']);
  });

  function schemaRejected(param = 'response_format'): Response {
    return errorResponse(400, {
      message: "Invalid schema for model 'gpt-4-turbo'. sk-proj-SECRET",
      type: 'invalid_request_error',
      param,
      code: 'invalid_value',
    });
  }

  it.each([
    ['response_format', 'response_format'],
    ['a field under response_format', 'response_format.json_schema.schema'],
  ])('resends without response_format after a 400 for %s, and remembers (WR-14)', async (_name, param) => {
    pinOpenAi({ model: 'gpt-4-turbo' });
    fetchStub
      .mockResolvedValueOnce(schemaRejected(param))
      .mockImplementation(async () => contentResponse(CANDIDATE_JSON));

    const candidates = await openaiAdapter.fetchCandidates(buildEnvelope());

    expect(candidates).toEqual(LS);
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expect(sentBody(0)).toHaveProperty('response_format');
    expect(sentBody(1)).not.toHaveProperty('response_format');
    expect(sentBody(1).reasoning_effort).toBe('low');
    expect(fetchStub.mock.calls[1]?.[1]?.signal).toBe(fetchStub.mock.calls[0]?.[1]?.signal);
    expect(JSON.stringify(appendDebugLogMock.mock.calls)).not.toContain('sk-proj-SECRET');
    expect(JSON.stringify(appendDebugLogMock.mock.calls)).not.toContain('Invalid schema');
    expectNoFallback();

    fetchStub.mockClear();
    await openaiAdapter.fetchCandidates(buildEnvelope());

    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(sentBody(0)).not.toHaveProperty('response_format');
  });

  it('resends without response_format, then without reasoning_effort, when both are rejected', async () => {
    fetchStub
      .mockResolvedValueOnce(schemaRejected())
      .mockResolvedValueOnce(effortRejected())
      .mockResolvedValueOnce(contentResponse(CANDIDATE_JSON));

    await expect(openaiAdapter.fetchCandidates(buildEnvelope())).resolves.toEqual(LS);

    expect(fetchStub).toHaveBeenCalledTimes(3);
    expect(sentEfforts()).toEqual(['low', 'low', undefined]);
    expect(sentBody(2)).not.toHaveProperty('response_format');
  });

  it('never leaks the upstream message or key when the schema-less request fails too', async () => {
    fetchStub.mockResolvedValueOnce(schemaRejected()).mockResolvedValueOnce(
      errorResponse(400, {
        message: `Bad request ${KEY} sk-proj-SECRET`,
        param: 'messages',
        code: 'invalid_value',
      }),
    );

    const error = await failure();

    expect(error.message).toMatch(/OpenAI request failed \(HTTP 400, code invalid_value\)/);
    expect(error.message).not.toContain('sk-proj-SECRET');
    expect(error.message).not.toContain(KEY);
    expect(error.message).not.toContain('Invalid schema');
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(appendDebugLogMock.mock.calls)).not.toContain(KEY);
  });

  it('still reads a { candidates } answer from a model without the schema', async () => {
    fetchStub
      .mockResolvedValueOnce(schemaRejected())
      .mockResolvedValueOnce(contentResponse(`\`\`\`json\n${WRAPPED}\n\`\`\``));

    await expect(openaiAdapter.fetchCandidates(buildEnvelope())).resolves.toEqual(LS);
  });

  it.each([
    ['another param', 'messages'],
    ['no param', undefined],
  ])('maps a 400 for %s to the static failure line after 1 call', async (_name, param) => {
    fetchStub.mockResolvedValue(
      errorResponse(400, {
        message: 'Invalid schema',
        type: 'invalid_request_error',
        param,
        code: 'invalid_value',
      }),
    );

    const error = await failure();

    expect(error.message).toMatch(/OpenAI request failed \(HTTP 400, code invalid_value\)/);
    expect(error.message).not.toContain('Invalid schema');
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it('rethrows a user abort fired during the retry', async () => {
    const controller = new AbortController();
    fetchStub.mockResolvedValueOnce(contentResponse(FRAGMENT, 'length')).mockImplementationOnce(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
            once: true,
          });
          controller.abort();
        }),
    );

    const error = await openaiAdapter
      .fetchCandidates(buildEnvelope(), { signal: controller.signal })
      .catch((caught: unknown) => caught);

    expect(isAbortError(error)).toBe(true);
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expectNoFallback();
  });

  it.each([
    ['with partial text', contentResponse(WRAPPED, 'content_filter')],
    ['with null content', chatResponse({ content: null, refusal: null }, 'content_filter')],
  ])('maps a content_filter finish %s to declined, with no retry (IN-17)', async (_name, response) => {
    fetchStub.mockResolvedValueOnce(response);

    const error = await failure();

    expect(error.message).toMatch(/declined this query/);
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it('shows cut off, not a timeout, when the retry runs out of the budget (IN-17)', async () => {
    fetchStub.mockResolvedValueOnce(contentResponse(FRAGMENT, 'length')).mockImplementationOnce(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    );

    const caught: unknown = await fetchOpenAiCandidates(
      buildEnvelope(),
      { model: 'gpt-5.5' },
      200,
    ).catch((rejection: unknown) => rejection);
    expect(caught).toBeInstanceOf(Error);
    const error = caught as Error;

    expect(error.message).toMatch(/OpenAI response was cut off/);
    expect(error.message).not.toMatch(/did not answer/);
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expectNoFallback();
  });

  it('treats null content at finish_reason length as an empty cut-off and retries', async () => {
    fetchStub
      .mockResolvedValueOnce(chatResponse({ content: null, refusal: null }, 'length'))
      .mockResolvedValueOnce(contentResponse(WRAPPED));

    const candidates = await openaiAdapter.fetchCandidates(buildEnvelope());

    expect(candidates).toEqual(LS);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });
});

describe('OpenAI debug log', () => {
  function expectCleanLog(): void {
    const serialized = JSON.stringify(appendDebugLogMock.mock.calls);
    expect(serialized).not.toContain(KEY);
    expect(serialized).not.toContain('Bearer');
    expect(serialized.toLowerCase()).not.toContain('authorization');
    expect(serialized).not.toContain(QUERY);
    expect(serialized).not.toContain('ls -la');
  }

  it('logs model, status and duration only on success', async () => {
    fetchStub.mockResolvedValue(contentResponse(CANDIDATE_JSON));

    await openaiAdapter.fetchCandidates(buildEnvelope());

    const requestLines = appendDebugLogMock.mock.calls.filter(
      (call) => call[1] === 'openai request',
    );
    expect(requestLines).toHaveLength(1);
    expect(Object.keys(requestLines[0]?.[2] as object).sort()).toEqual([
      'durationMs',
      'model',
      'status',
    ]);
    expect(requestLines[0]?.[2]).toMatchObject({ model: OPENAI_DEFAULT_MODEL, status: 200 });
    expectCleanLog();
  });

  it('logs no key, prompt or upstream error text on a failure', async () => {
    fetchStub.mockResolvedValue(
      errorResponse(401, { message: 'Incorrect API key provided: sk-abc***wxyz' }),
    );

    await failure();

    expectCleanLog();
    const serialized = JSON.stringify(appendDebugLogMock.mock.calls);
    expect(serialized).not.toContain('sk-abc');
  });
});

describe('pinned OpenAI resolution', () => {
  it('resolves the registered openai backend for an openai pin', () => {
    expect(resolveProviderAdapter()).toBe(getProviderAdapter('openai'));
  });

  it('daemon-down fallback calls OpenAI, not the Claude default', async () => {
    fetchStub.mockResolvedValue(contentResponse(CANDIDATE_JSON));

    const candidates = await fetchCandidatesForUi('/tmp/qq-missing-openai.sock', buildEnvelope());

    expect(candidates).toEqual([{ command: 'ls -la', explanation: 'List files' }]);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expectNoFallback();
  });
});
