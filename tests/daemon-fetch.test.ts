import * as fs from 'node:fs';
import * as net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shutdownDaemon, trackConnections } from '../src/cli/commands/daemon.js';
import type { CommandCandidate } from '../src/contracts/candidates.js';
import type { ContextEnvelope } from '../src/contracts/request.js';
import {
  fetchCandidatesForUi,
  IpcTransportError,
  requestDaemonFetch,
} from '../src/daemon/fetch-client.js';
import {
  disablePrewarm,
  enablePrewarm,
  type PrewarmSpec,
  prewarmSnapshot,
  schedulePrewarm,
} from '../src/providers/claude-prewarm.js';
import { OPENAI_DEFAULT_MODEL } from '../src/providers/openai.js';
import { abortError, type FetchOptions, isAbortError } from '../src/providers/provider.js';

const FIXTURE = fileURLToPath(new URL('./fixtures/fake-claude-stream.mjs', import.meta.url));

const { fetchMock, appendDebugLogMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  appendDebugLogMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/providers/resolver.js', () => ({
  resolveClaudeDefaultAdapter: () => ({
    fetchCandidates: fetchMock,
  }),
  resolveAdapter: vi.fn(),
}));

vi.mock('../src/shared/debug-log.js', () => ({
  appendDebugLog: appendDebugLogMock,
}));

const ROW_A: CommandCandidate = { command: 'git status', explanation: 'Show status' };
const ROW_B: CommandCandidate = { command: 'git log', explanation: 'Show history' };
const ROW_C: CommandCandidate = { command: 'git diff', explanation: 'Show changes' };

type RawMessage = { kind: string; [key: string]: unknown };

/** Sends one raw request and collects every reply until `candidates` or `fetch-error`. */
function rawFetch(socketPath: string, request: unknown): Promise<RawMessage[]> {
  return new Promise((resolve, reject) => {
    const messages: RawMessage[] = [];
    let buf = '';
    const client = net.createConnection(socketPath, () => {
      client.write(`${JSON.stringify(request)}\n`);
    });
    client.setEncoding('utf8');
    client.on('data', (chunk) => {
      buf += String(chunk);
      let nl = buf.indexOf('\n');
      while (nl !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        nl = buf.indexOf('\n');
        const message = JSON.parse(line) as RawMessage;
        messages.push(message);
        if (message.kind === 'candidates' || message.kind === 'fetch-error') {
          client.destroy();
          resolve(messages);
          return;
        }
      }
    });
    client.on('error', reject);
  });
}

/** A scripted listener: on `fetch-candidates` it runs `script` against the socket. */
function scriptedListener(
  socketPath: string,
  script: (socket: net.Socket) => void,
): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      let started = false;
      socket.on('data', (chunk) => {
        if (!started && chunk.toString().includes('"fetch-candidates"')) {
          started = true;
          script(socket);
        }
      });
      socket.on('error', () => {
        // the client may hang up first
      });
    });
    server.listen(socketPath, () => resolve(server));
    server.once('error', reject);
  });
}

function loggedStages(scope: string): Array<{ message: string; details: unknown }> {
  return appendDebugLogMock.mock.calls
    .filter((call) => call[0] === scope)
    .map((call) => ({ message: call[1] as string, details: call[2] }));
}

function buildEnvelope(): ContextEnvelope {
  return {
    base: {
      queryText: 'status',
      cwd: '/repo',
      ttyPath: '/dev/tty',
      shellPid: 1234,
      shellName: 'zsh',
      platform: 'darwin',
      timestamp: '2026-08-26T00:00:00.000Z',
    },
    extras: [],
  };
}

/** Sends one ping on a fresh connection and resolves with the first reply. */
function ping(socketPath: string): Promise<RawMessage> {
  return new Promise((resolve, reject) => {
    let buf = '';
    const client = net.createConnection(socketPath, () => {
      client.write(`${JSON.stringify({ kind: 'ping' })}\n`);
    });
    client.setEncoding('utf8');
    client.on('data', (chunk) => {
      buf += String(chunk);
      const nl = buf.indexOf('\n');
      if (nl !== -1) {
        client.destroy();
        resolve(JSON.parse(buf.slice(0, nl)) as RawMessage);
      }
    });
    client.on('error', reject);
  });
}

function ollamaChatResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      model: 'gemma4',
      message: { role: 'assistant', content },
      done: true,
    }),
    { status: 200 },
  );
}

function openAiChatResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    }),
    { status: 200 },
  );
}

describe('daemon fetch-candidates IPC', () => {
  let socketPath: string;
  let testServer: net.Server | null = null;
  let pinDir: string;
  let pinFile: string;

  beforeEach(() => {
    const suffix = Math.random().toString(36).slice(2);
    socketPath = `/tmp/qq-fetch-${suffix}.sock`;
    fetchMock.mockReset();
    appendDebugLogMock.mockClear();
    // No provider.json in a fresh dir: absent pin → the mocked Claude default.
    pinDir = fs.mkdtempSync(join(tmpdir(), 'qq-pin-'));
    pinFile = join(pinDir, 'provider.json');
    vi.stubEnv('QQ_PROVIDER_FILE', pinFile);
    vi.stubEnv('QQ_CONFIG_FILE', join(pinDir, 'config.json'));
    vi.stubEnv('QQ_FORCE_SELECTOR', '0');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fs.rmSync(pinDir, { recursive: true, force: true });
    if (testServer) {
      testServer.close();
      testServer.unref();
      testServer = null;
    }
    try {
      fs.rmSync(socketPath, { force: true });
    } catch {
      // ignore
    }
  });

  it('returns candidates from the daemon adapter', async () => {
    fetchMock.mockResolvedValue([{ command: 'git status', explanation: 'Show status' }]);
    const { startDaemonServer } = await import('../src/daemon/server.js');
    testServer = await startDaemonServer(socketPath);

    const candidates = await requestDaemonFetch(socketPath, buildEnvelope());
    expect(candidates).toEqual([{ command: 'git status', explanation: 'Show status' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces adapter failures as errors, not transport failures', async () => {
    fetchMock.mockRejectedValue(
      new Error('QueQue: Claude is not authenticated. Run `claude /login`.'),
    );
    const { startDaemonServer } = await import('../src/daemon/server.js');
    testServer = await startDaemonServer(socketPath);

    await expect(requestDaemonFetch(socketPath, buildEnvelope())).rejects.toThrow(/claude \/login/);
  });

  it('falls back to the in-process adapter when the daemon socket is missing', async () => {
    fetchMock.mockResolvedValue([{ command: 'echo hi', explanation: '' }]);
    const candidates = await fetchCandidatesForUi('/tmp/qq-missing-fallback.sock', buildEnvelope());
    expect(candidates).toEqual([{ command: 'echo hi', explanation: '' }]);
  });

  it('accepts an envelope carrying an installed-tools chunk', async () => {
    fetchMock.mockResolvedValue([{ command: 'fd -e ts', explanation: 'Find TS files' }]);
    const { startDaemonServer } = await import('../src/daemon/server.js');
    testServer = await startDaemonServer(socketPath);

    const envelope: ContextEnvelope = {
      ...buildEnvelope(),
      extras: [{ kind: 'installed-tools', payload: { tools: ['fd', 'rg'] } }],
    };
    const candidates = await requestDaemonFetch(socketPath, envelope);
    expect(candidates).toEqual([{ command: 'fd -e ts', explanation: 'Find TS files' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const received = fetchMock.mock.calls[0]?.[0] as ContextEnvelope;
    expect(received.extras).toEqual([
      { kind: 'installed-tools', payload: { tools: ['fd', 'rg'] } },
    ]);
  });

  it('filters a catalog name the daemon does not know instead of dropping the request', async () => {
    // Catalog drift: a newer client may send a name this daemon's catalog lacks.
    fetchMock.mockResolvedValue([{ command: 'fd -e ts', explanation: 'Find TS files' }]);
    const { startDaemonServer } = await import('../src/daemon/server.js');
    testServer = await startDaemonServer(socketPath);

    const envelope = {
      ...buildEnvelope(),
      extras: [{ kind: 'installed-tools', payload: { tools: ['fd', 'qqfuturetool'] } }],
    } as ContextEnvelope;
    const candidates = await requestDaemonFetch(socketPath, envelope);
    expect(candidates).toEqual([{ command: 'fd -e ts', explanation: 'Find TS files' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const received = fetchMock.mock.calls[0]?.[0] as ContextEnvelope;
    const chunk = received.extras.find((c) => c.kind === 'installed-tools');
    expect(chunk).toBeDefined();
    expect((chunk?.payload as { tools: string[] }).tools).toEqual(['fd']);
  });

  it('ignores a structurally malformed installed-tools chunk', async () => {
    fetchMock.mockResolvedValue([{ command: 'echo hi', explanation: '' }]);
    const { startDaemonServer } = await import('../src/daemon/server.js');
    testServer = await startDaemonServer(socketPath);

    const envelope = {
      ...buildEnvelope(),
      extras: [{ kind: 'installed-tools', payload: { tools: ['rm -rf ~'] } }],
    } as ContextEnvelope;
    const started = Date.now();
    await expect(requestDaemonFetch(socketPath, envelope)).rejects.toThrow(/not accepted/);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborting after fetch-accepted closes the socket and aborts the adapter signal (D-13)', async () => {
    let received: AbortSignal | undefined;
    fetchMock.mockImplementation(
      (_envelope: ContextEnvelope, options?: FetchOptions) =>
        new Promise((_resolve, reject) => {
          received = options?.signal;
          options?.signal?.addEventListener('abort', () => reject(abortError()), { once: true });
        }),
    );
    const { startDaemonServer } = await import('../src/daemon/server.js');
    testServer = await startDaemonServer(socketPath);
    const controller = new AbortController();

    const pending = requestDaemonFetch(socketPath, buildEnvelope(), undefined, {
      signal: controller.signal,
    }).catch((caught: unknown) => caught);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();

    expect(isAbortError(await pending)).toBe(true);
    await vi.waitFor(() => expect(received?.aborted).toBe(true));
  });

  it('does not fall back to the in-process adapter once the fetch is aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const error = await fetchCandidatesForUi('/tmp/qq-missing-abort.sock', buildEnvelope(), {
      signal: controller.signal,
    }).catch((caught: unknown) => caught);

    expect(isAbortError(error)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails fast when the listener never acks fetch-candidates', async () => {
    testServer = await new Promise<net.Server>((resolve, reject) => {
      const server = net.createServer((socket) => {
        socket.resume();
      });
      server.listen(socketPath, () => resolve(server));
      server.once('error', reject);
    });

    const started = Date.now();
    await expect(requestDaemonFetch(socketPath, buildEnvelope())).rejects.toThrow(/not accepted/);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  describe('request decoding (WR-01)', () => {
    /** Writes `bytes` to the daemon in two reads split at `split`, then collects replies. */
    function splitRequest(bytes: Buffer, split: number): Promise<RawMessage[]> {
      return new Promise((resolve) => {
        const messages: RawMessage[] = [];
        let buf = '';
        const client = net.createConnection(socketPath, () => {
          client.write(bytes.subarray(0, split));
          setTimeout(() => client.write(bytes.subarray(split)), 30);
        });
        client.setEncoding('utf8');
        client.on('data', (chunk) => {
          buf += String(chunk);
          let nl = buf.indexOf('\n');
          while (nl !== -1) {
            const message = JSON.parse(buf.slice(0, nl)) as RawMessage;
            buf = buf.slice(nl + 1);
            nl = buf.indexOf('\n');
            messages.push(message);
            if (message.kind === 'candidates' || message.kind === 'fetch-error') {
              client.destroy();
              resolve(messages);
              return;
            }
          }
        });
        client.on('close', () => resolve(messages));
        // The daemon destroys an oversized request mid-write, so EPIPE/ECONNRESET end it.
        client.on('error', () => resolve(messages));
      });
    }

    it('keeps a multi-byte character intact when the request is split across socket reads', async () => {
      fetchMock.mockResolvedValue([ROW_A]);
      const { startDaemonServer } = await import('../src/daemon/server.js');
      testServer = await startDaemonServer(socketPath);
      const envelope = buildEnvelope();
      envelope.base.queryText = 'プロジェクト ⓘ';
      envelope.base.cwd = '/repo/プロジェクト';
      const bytes = Buffer.from(
        `${JSON.stringify({ kind: 'fetch-candidates', envelope, stream: true })}\n`,
      );
      const split = bytes.indexOf(Buffer.from('ジ')) + 1; // inside the 3-byte sequence

      const replies = await splitRequest(bytes, split);

      expect(replies.at(-1)).toEqual({ kind: 'candidates', candidates: [ROW_A] });
      const received = fetchMock.mock.calls[0]?.[0] as ContextEnvelope;
      expect(received.base.queryText).toBe('プロジェクト ⓘ');
      expect(received.base.cwd).toBe('/repo/プロジェクト');
    });

    it('measures the 256 KB request limit in bytes, not UTF-16 code units', async () => {
      fetchMock.mockResolvedValue([ROW_A]);
      const { startDaemonServer } = await import('../src/daemon/server.js');
      testServer = await startDaemonServer(socketPath);
      const envelope = buildEnvelope();
      // 90,000 three-byte characters: ~270 KB on the wire but only 90,000 code units.
      envelope.base.queryText = 'ⓘ'.repeat(90_000);
      const bytes = Buffer.from(`${JSON.stringify({ kind: 'fetch-candidates', envelope })}\n`);

      const replies = await splitRequest(bytes, 1024);

      expect(replies).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('streamed candidates (D-05)', () => {
    it('writes one candidate message per streamed row, then the final candidates list', async () => {
      fetchMock.mockImplementation(async (_envelope: ContextEnvelope, options?: FetchOptions) => {
        options?.onCandidate?.(ROW_A);
        options?.onCandidate?.(ROW_B);
        return [ROW_A, ROW_B];
      });
      const { startDaemonServer } = await import('../src/daemon/server.js');
      testServer = await startDaemonServer(socketPath);

      const messages = await rawFetch(socketPath, {
        kind: 'fetch-candidates',
        envelope: buildEnvelope(),
        stream: true,
      });

      expect(messages.map((m) => m.kind)).toEqual([
        'fetch-accepted',
        'candidate',
        'candidate',
        'candidates',
      ]);
      // Invariant: every streamed row precedes the done signal and matches the head of the list.
      const streamed = messages.filter((m) => m.kind === 'candidate').map((m) => m.candidate);
      expect(streamed).toEqual([ROW_A, ROW_B]);
      const final = messages.at(-1)?.candidates as CommandCandidate[];
      expect(final.slice(0, streamed.length)).toEqual(streamed);
    });

    it('keeps one candidates reply and no onCandidate for a request without stream', async () => {
      let received: FetchOptions | undefined;
      fetchMock.mockImplementation(async (_envelope: ContextEnvelope, options?: FetchOptions) => {
        received = options;
        options?.onCandidate?.(ROW_A);
        return [ROW_A];
      });
      const { startDaemonServer } = await import('../src/daemon/server.js');
      testServer = await startDaemonServer(socketPath);

      const messages = await rawFetch(socketPath, {
        kind: 'fetch-candidates',
        envelope: buildEnvelope(),
      });

      expect(messages.map((m) => m.kind)).toEqual(['fetch-accepted', 'candidates']);
      expect(received?.signal).toBeInstanceOf(AbortSignal);
      expect(received?.onCandidate).toBeUndefined();
    });

    it('requestDaemonFetch forwards each streamed row to onCandidate before it resolves', async () => {
      fetchMock.mockImplementation(async (_envelope: ContextEnvelope, options?: FetchOptions) => {
        options?.onCandidate?.(ROW_A);
        options?.onCandidate?.(ROW_B);
        return [ROW_A, ROW_B];
      });
      const { startDaemonServer } = await import('../src/daemon/server.js');
      testServer = await startDaemonServer(socketPath);
      const recorded: CommandCandidate[] = [];

      const candidates = await requestDaemonFetch(socketPath, buildEnvelope(), undefined, {
        onCandidate: (candidate) => recorded.push(candidate),
      }).then((list) => {
        expect(recorded).toEqual([ROW_A, ROW_B]);
        return list;
      });

      expect(candidates).toEqual([ROW_A, ROW_B]);
    });

    it('writes nothing and logs candidate dropped for a row reported after the client left (D-14)', async () => {
      let received: FetchOptions | undefined;
      let release: ((list: CommandCandidate[]) => void) | undefined;
      fetchMock.mockImplementation(
        (_envelope: ContextEnvelope, options?: FetchOptions) =>
          new Promise<CommandCandidate[]>((resolve) => {
            received = options;
            release = resolve;
          }),
      );
      const { startDaemonServer } = await import('../src/daemon/server.js');
      testServer = await startDaemonServer(socketPath);

      const client = net.createConnection(socketPath, () => {
        client.write(
          `${JSON.stringify({ kind: 'fetch-candidates', envelope: buildEnvelope(), stream: true })}\n`,
        );
      });
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      client.destroy();
      await vi.waitFor(() => expect(received?.signal?.aborted).toBe(true));

      expect(received?.onCandidate).toBeTypeOf('function');
      expect(() => received?.onCandidate?.(ROW_C)).not.toThrow();
      release?.([ROW_C]);

      await vi.waitFor(() =>
        expect(loggedStages('daemon').map((s) => s.message)).toContain('candidate dropped'),
      );
      const dropped = loggedStages('daemon').find((s) => s.message === 'candidate dropped');
      expect(dropped?.details).toEqual({ index: expect.any(Number) });
      expect(JSON.stringify(appendDebugLogMock.mock.calls)).not.toContain('git diff');
      expect(loggedStages('daemon').map((s) => s.message)).not.toContain('replied candidate');
    });

    it('keeps a multi-byte character intact when a candidate is split across socket reads', async () => {
      const row: CommandCandidate = { command: 'z3 -h', explanation: 'ⓘ shows z3 help' };
      const line = Buffer.from(`${JSON.stringify({ kind: 'candidate', candidate: row })}\n`);
      const split = line.indexOf(Buffer.from('ⓘ')) + 1; // inside the 3-byte sequence
      testServer = await scriptedListener(socketPath, (socket) => {
        socket.write(`${JSON.stringify({ kind: 'fetch-accepted' })}\n`);
        socket.write(line.subarray(0, split));
        setTimeout(() => {
          socket.write(line.subarray(split));
          socket.write(`${JSON.stringify({ kind: 'candidates', candidates: [row] })}\n`);
        }, 30);
      });
      const recorded: CommandCandidate[] = [];

      const candidates = await requestDaemonFetch(socketPath, buildEnvelope(), undefined, {
        onCandidate: (candidate) => recorded.push(candidate),
      });

      expect(recorded).toEqual([row]);
      expect(candidates).toEqual([row]);
    });

    it('rejects a candidate message with an empty command as a transport error', async () => {
      testServer = await scriptedListener(socketPath, (socket) => {
        socket.write(`${JSON.stringify({ kind: 'fetch-accepted' })}\n`);
        socket.write(
          `${JSON.stringify({ kind: 'candidate', candidate: { command: '', explanation: 'x' } })}\n`,
        );
      });

      const error = await requestDaemonFetch(socketPath, buildEnvelope()).catch(
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(IpcTransportError);
    });

    it('sends stream: true on the fetch-candidates request', async () => {
      let request: Record<string, unknown> | undefined;
      testServer = await new Promise<net.Server>((resolve, reject) => {
        const server = net.createServer((socket) => {
          socket.on('data', (chunk) => {
            request = JSON.parse(chunk.toString().split('\n')[0] ?? '{}');
            socket.write(`${JSON.stringify({ kind: 'fetch-accepted' })}\n`);
            socket.write(`${JSON.stringify({ kind: 'candidates', candidates: [ROW_A] })}\n`);
          });
        });
        server.listen(socketPath, () => resolve(server));
        server.once('error', reject);
      });

      await requestDaemonFetch(socketPath, buildEnvelope());

      expect(request?.kind).toBe('fetch-candidates');
      expect(request?.stream).toBe(true);
    });
  });

  describe('no in-process re-query after rows (D-16 transport)', () => {
    /** Settles with the fetch outcome, or 'hung' if it is still pending after `ms`. */
    function settleWithin(promise: Promise<unknown>, ms = 2000): Promise<unknown> {
      return Promise.race([
        promise.then(
          (value) => ({ resolved: value }),
          (error: unknown) => error,
        ),
        new Promise((resolve) => setTimeout(() => resolve('hung'), ms)),
      ]);
    }

    it('rejects without calling the in-process adapter when the connection drops after a row', async () => {
      fetchMock.mockResolvedValue([ROW_B]);
      testServer = await scriptedListener(socketPath, (socket) => {
        socket.write(`${JSON.stringify({ kind: 'fetch-accepted' })}\n`);
        socket.write(`${JSON.stringify({ kind: 'candidate', candidate: ROW_A })}\n`, () => {
          socket.destroy();
        });
      });
      const recorded: CommandCandidate[] = [];

      const outcome = await settleWithin(
        fetchCandidatesForUi(socketPath, buildEnvelope(), {
          onCandidate: (candidate) => recorded.push(candidate),
        }),
      );

      expect(outcome).toBeInstanceOf(IpcTransportError);
      expect(recorded).toEqual([ROW_A]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('falls back in-process with the same options when the connection drops before any row', async () => {
      fetchMock.mockResolvedValue([ROW_B]);
      testServer = await scriptedListener(socketPath, (socket) => {
        socket.write(`${JSON.stringify({ kind: 'fetch-accepted' })}\n`, () => {
          socket.destroy();
        });
      });
      const options: FetchOptions = {
        signal: new AbortController().signal,
        onCandidate: () => {},
      };

      const outcome = await settleWithin(
        fetchCandidatesForUi(socketPath, buildEnvelope(), options),
      );

      expect(outcome).toEqual({ resolved: [ROW_B] });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[1]).toBe(options);
    });

    it('falls back in-process with the same options when no daemon listens', async () => {
      fetchMock.mockResolvedValue([ROW_B]);
      const options: FetchOptions = { onCandidate: () => {} };

      const candidates = await fetchCandidatesForUi(socketPath, buildEnvelope(), options);

      expect(candidates).toEqual([ROW_B]);
      expect(fetchMock.mock.calls[0]?.[1]).toBe(options);
    });

    it('rejects with an AbortError and no fallback when the signal aborted before the transport failed', async () => {
      const controller = new AbortController();
      testServer = await scriptedListener(socketPath, (socket) => {
        socket.write(`${JSON.stringify({ kind: 'fetch-accepted' })}\n`);
        socket.write(`${JSON.stringify({ kind: 'candidate', candidate: ROW_A })}\n`);
      });

      const pending = fetchCandidatesForUi(socketPath, buildEnvelope(), {
        signal: controller.signal,
        onCandidate: () => {
          controller.abort();
        },
      }).catch((caught: unknown) => caught);

      expect(isAbortError(await pending)).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('provider pin (08-03)', () => {
    it('pinned ollama answers fetch-candidates through the daemon', async () => {
      fs.writeFileSync(pinFile, '{"version":1,"provider":"ollama","model":"gemma4"}');
      const ollamaFetch = vi.fn(async (_url: URL | string, _init?: RequestInit) =>
        ollamaChatResponse('[{"command":"ls -la","explanation":"List files"}]'),
      );
      vi.stubGlobal('fetch', ollamaFetch);
      const { startDaemonServer } = await import('../src/daemon/server.js');
      testServer = await startDaemonServer(socketPath);

      const candidates = await requestDaemonFetch(socketPath, buildEnvelope());

      expect(candidates).toEqual([{ command: 'ls -la', explanation: 'List files' }]);
      expect(ollamaFetch).toHaveBeenCalledTimes(1);
      const [url, init] = ollamaFetch.mock.calls[0] ?? [];
      expect(String(url)).toBe('http://localhost:11434/api/chat');
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        stream: boolean;
        messages: Array<{ role: string; content: string }>;
      };
      expect(body.model).toBe('gemma4');
      expect(body.stream).toBe(false);
      expect(body.messages[0]?.role).toBe('system');
      expect(body.messages[1]?.role).toBe('user');
      const headers = new Headers(init?.headers);
      expect(headers.has('authorization')).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
      const selected = loggedStages('provider').find((s) => s.message === 'provider selected');
      expect(selected?.details).toEqual({ provider: 'ollama', source: 'pin' });
    });

    it('invalid pin is a fetch-error and the daemon stays up', async () => {
      fs.writeFileSync(pinFile, '{}');
      const ollamaFetch = vi.fn();
      vi.stubGlobal('fetch', ollamaFetch);
      const { startDaemonServer } = await import('../src/daemon/server.js');
      testServer = await startDaemonServer(socketPath);

      const error = await requestDaemonFetch(socketPath, buildEnvelope()).catch(
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(IpcTransportError);
      expect((error as Error).message).toMatch(/provider pin/);
      expect((error as Error).message).toMatch(/qq init provider/);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(ollamaFetch).not.toHaveBeenCalled();
      expect((await ping(socketPath)).kind).toBe('pong');
    });

    it('pin change applies on the next fetch without restart', async () => {
      fs.writeFileSync(pinFile, '{"version":1,"provider":"ollama","model":"gemma4"}');
      const ollamaFetch = vi.fn(async () =>
        ollamaChatResponse('[{"command":"ls -la","explanation":"List files"}]'),
      );
      vi.stubGlobal('fetch', ollamaFetch);
      fetchMock.mockResolvedValue([ROW_A]);
      const { startDaemonServer } = await import('../src/daemon/server.js');
      testServer = await startDaemonServer(socketPath);

      await requestDaemonFetch(socketPath, buildEnvelope());
      expect(ollamaFetch).toHaveBeenCalledTimes(1);
      expect(fetchMock).not.toHaveBeenCalled();

      fs.writeFileSync(pinFile, '{"version":1,"provider":"claude"}');
      const candidates = await requestDaemonFetch(socketPath, buildEnvelope());

      expect(candidates).toEqual([ROW_A]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(ollamaFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('provider pin: openai (08-04)', () => {
    type OpenAiBody = {
      model: string;
      messages: Array<{ role: string; content: string }>;
      [key: string]: unknown;
    };

    function stubOpenAi() {
      const openAiFetch = vi.fn(async (_url: URL | string, _init?: RequestInit) =>
        openAiChatResponse('[{"command":"git status","explanation":"Show status"}]'),
      );
      vi.stubGlobal('fetch', openAiFetch);
      vi.stubEnv('OPENAI_API_KEY', 'sk-test-openai-key');
      return openAiFetch;
    }

    it('pinned openai answers fetch-candidates through the daemon', async () => {
      fs.writeFileSync(pinFile, '{"version":1,"provider":"openai"}');
      const openAiFetch = stubOpenAi();
      const { startDaemonServer } = await import('../src/daemon/server.js');
      testServer = await startDaemonServer(socketPath);

      const candidates = await requestDaemonFetch(socketPath, buildEnvelope());

      expect(candidates).toEqual([{ command: 'git status', explanation: 'Show status' }]);
      expect(openAiFetch).toHaveBeenCalledTimes(1);
      const [url, init] = openAiFetch.mock.calls[0] ?? [];
      expect(String(url)).toBe('https://api.openai.com/v1/chat/completions');
      expect(init?.method).toBe('POST');
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe('Bearer sk-test-openai-key');
      const body = JSON.parse(String(init?.body)) as OpenAiBody;
      expect(body.model).toBe(OPENAI_DEFAULT_MODEL);
      expect(body.messages[0]?.role).toBe('developer');
      expect(body.messages[1]?.role).toBe('user');
      expect(body).not.toHaveProperty('temperature');
      expect(fetchMock).not.toHaveBeenCalled();
      const selected = loggedStages('provider').find((s) => s.message === 'provider selected');
      expect(selected?.details).toEqual({ provider: 'openai', source: 'pin' });
    });

    it('pinned openai model overrides the default', async () => {
      fs.writeFileSync(pinFile, '{"version":1,"provider":"openai","model":"gpt-test-model"}');
      const openAiFetch = stubOpenAi();
      const { startDaemonServer } = await import('../src/daemon/server.js');
      testServer = await startDaemonServer(socketPath);

      await requestDaemonFetch(socketPath, buildEnvelope());

      const body = JSON.parse(String(openAiFetch.mock.calls[0]?.[1]?.body)) as OpenAiBody;
      expect(body.model).toBe('gpt-test-model');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('daemon shutdown (WR-03)', () => {
    const prewarmSpec: PrewarmSpec = {
      command: process.execPath,
      argv: [FIXTURE, 'success'],
      cwd: process.cwd(),
    };

    afterEach(() => {
      disablePrewarm();
    });

    it('aborts an in-flight fetch and keeps the pool off, so its refill spawns nothing', async () => {
      let received: AbortSignal | undefined;
      fetchMock.mockImplementation(
        (_envelope: ContextEnvelope, options?: FetchOptions) =>
          new Promise((_resolve, reject) => {
            received = options?.signal;
            options?.signal?.addEventListener(
              'abort',
              () => {
                // claude-cli refills the slot in `finally` once its turn settles.
                schedulePrewarm(prewarmSpec);
                reject(abortError());
              },
              { once: true },
            );
          }),
      );
      const { startDaemonServer } = await import('../src/daemon/server.js');
      const server = await startDaemonServer(socketPath);
      const connections = trackConnections(server);
      enablePrewarm();
      const pending = requestDaemonFetch(socketPath, buildEnvelope()).catch(
        (caught: unknown) => caught,
      );
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(connections.size).toBe(1);
      const exit = vi.fn();

      shutdownDaemon(server, connections, { exit, graceMs: 50 });

      await vi.waitFor(() => expect(exit).toHaveBeenCalledTimes(1));
      expect(received?.aborted).toBe(true);
      expect(prewarmSnapshot()).toEqual({ enabled: false, state: 'empty' });
      expect(await pending).toBeInstanceOf(Error);
      expect(connections.size).toBe(0);
    });

    it('retires the idle child, turns the pool off and exits at once with no connection', async () => {
      const { startDaemonServer } = await import('../src/daemon/server.js');
      const server = await startDaemonServer(socketPath);
      const connections = trackConnections(server);
      enablePrewarm();
      schedulePrewarm(prewarmSpec);
      expect(prewarmSnapshot().state).toBe('idle');
      const exit = vi.fn();

      shutdownDaemon(server, connections, { exit, graceMs: 60_000 });

      await vi.waitFor(() => expect(exit).toHaveBeenCalledTimes(1));
      expect(prewarmSnapshot()).toEqual({ enabled: false, state: 'empty' });
      schedulePrewarm(prewarmSpec);
      expect(prewarmSnapshot()).toEqual({ enabled: false, state: 'empty' });
    });
  });
});
