import * as fs from 'node:fs';
import * as net from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextEnvelope } from '../src/contracts/request.js';
import { fetchCandidatesForUi, requestDaemonFetch } from '../src/daemon/fetch-client.js';
import { abortError, type FetchOptions, isAbortError } from '../src/providers/provider.js';

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock('../src/providers/resolver.js', () => ({
  resolveClaudeDefaultAdapter: () => ({
    fetchCandidates: fetchMock,
  }),
  resolveAdapter: vi.fn(),
}));

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
});
