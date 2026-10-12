import * as fs from 'node:fs';
import * as net from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandCandidate } from '../src/contracts/candidates.js';
import type { ContextEnvelope } from '../src/contracts/request.js';
import {
  fetchCandidatesForUi,
  IpcTransportError,
  requestDaemonFetch,
} from '../src/daemon/fetch-client.js';
import { abortError, type FetchOptions, isAbortError } from '../src/providers/provider.js';

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

describe('daemon fetch-candidates IPC', () => {
  let socketPath: string;
  let testServer: net.Server | null = null;

  beforeEach(() => {
    const suffix = Math.random().toString(36).slice(2);
    socketPath = `/tmp/qq-fetch-${suffix}.sock`;
    fetchMock.mockReset();
    appendDebugLogMock.mockClear();
  });

  afterEach(() => {
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
});
