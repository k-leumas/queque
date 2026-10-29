import * as fs from 'node:fs';
import * as net from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { appendDebugLogMock } = vi.hoisted(() => ({
  appendDebugLogMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/shared/debug-log.js', () => ({
  appendDebugLog: appendDebugLogMock,
}));

import { shutdownDaemon, trackConnections } from '../src/cli/commands/daemon.js';
import { ipcResponseSchema } from '../src/contracts/ipc.js';
import { startDaemonServer } from '../src/daemon/server.js';
import {
  createTelemetryBuffer,
  TELEMETRY_SHUTDOWN_WAIT_MS,
  type TelemetryBuffer,
} from '../src/daemon/telemetry-buffer.js';

const INSTALL_ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const OUTCOME = {
  event: 'qq_query_outcome',
  properties: { outcome: 'accepted', candidate_count: 2, provider: 'claude-cli' },
};

type RawMessage = { kind: string; [key: string]: unknown };

function makeBuffer(): { buffer: TelemetryBuffer; fetchImpl: ReturnType<typeof vi.fn> } {
  const fetchImpl = vi.fn<typeof fetch>(async () => new Response('{"status":"ok"}'));
  const buffer = createTelemetryBuffer({
    fetchImpl,
    readState: () => ({ enabled: true, asked: true, installId: INSTALL_ID }),
    env: () => ({}),
    endpoint: () => ({ host: 'http://127.0.0.1:9', key: 'phc_test' }),
    now: () => Date.parse('2026-10-29T12:00:00.000Z'),
    version: '0.8.0',
  });
  return { buffer, fetchImpl };
}

/** Writes one request, ends the socket and resolves with whatever came back before close. */
function writeAndEnd(socketPath: string, request: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    let received = '';
    const client = net.createConnection(socketPath, () => {
      client.end(`${JSON.stringify(request)}\n`);
    });
    client.setEncoding('utf8');
    client.on('data', (chunk) => {
      received += String(chunk);
    });
    client.on('close', () => resolve(received));
    client.on('error', reject);
  });
}

/** Writes one request and resolves with the first reply line. */
function requestOnce(socketPath: string, request: unknown): Promise<RawMessage> {
  return new Promise((resolve, reject) => {
    let buf = '';
    const client = net.createConnection(socketPath, () => {
      client.write(`${JSON.stringify(request)}\n`);
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
    setTimeout(() => reject(new Error('timeout waiting for a reply')), 2000).unref();
  });
}

describe('telemetry IPC kinds', () => {
  let socketPath: string;
  let server: net.Server | null = null;

  beforeEach(() => {
    socketPath = `/tmp/qq-telemetry-${process.pid}-${Math.random().toString(36).slice(2)}.sock`;
    appendDebugLogMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (server) {
      server.close();
      server.unref();
      server = null;
    }
    fs.rmSync(socketPath, { force: true });
  });

  it('buffers a telemetry-event without replying', async () => {
    const { buffer } = makeBuffer();
    server = await startDaemonServer(socketPath, { telemetry: buffer });

    const reply = await writeAndEnd(socketPath, { kind: 'telemetry-event', event: OUTCOME });

    expect(reply).toBe('');
    await vi.waitFor(() => expect(buffer.snapshot().pending).not.toBeNull());
    expect(JSON.parse(buffer.snapshot().pending as string).batch).toHaveLength(1);
  });

  it('telemetry-show replies with the buffer snapshot', async () => {
    const { buffer } = makeBuffer();
    buffer.enqueue(OUTCOME);
    server = await startDaemonServer(socketPath, { telemetry: buffer });

    const reply = await requestOnce(socketPath, { kind: 'telemetry-show' });

    expect(reply).toEqual({
      kind: 'telemetry-buffer',
      pending: buffer.snapshot().pending,
      lastSent: null,
    });
    expect(ipcResponseSchema.safeParse(reply).success).toBe(true);
  });

  it('telemetry-reset clears the buffer and replies with both null', async () => {
    const { buffer } = makeBuffer();
    buffer.enqueue(OUTCOME);
    await buffer.flush();
    buffer.enqueue(OUTCOME);
    server = await startDaemonServer(socketPath, { telemetry: buffer });

    const reply = await requestOnce(socketPath, { kind: 'telemetry-reset' });

    expect(reply).toEqual({ kind: 'telemetry-buffer', pending: null, lastSent: null });
    expect(buffer.snapshot()).toEqual({ pending: null, lastSent: null });
  });

  it('ignores a telemetry-event with an extra property and keeps serving', async () => {
    const { buffer } = makeBuffer();
    server = await startDaemonServer(socketPath, { telemetry: buffer });

    const bad = { kind: 'telemetry-event', event: { ...OUTCOME, cwd: '/home/me' } };
    expect(await writeAndEnd(socketPath, bad)).toBe('');
    await vi.waitFor(() =>
      expect(
        appendDebugLogMock.mock.calls.some(([, message]) => message === 'ignored unknown request'),
      ).toBe(true),
    );
    expect(buffer.snapshot().pending).toBeNull();

    const pong = await requestOnce(socketPath, { kind: 'ping' });
    expect(pong.kind).toBe('pong');
  });

  it('a server without a buffer answers telemetry-show and telemetry-reset with both null', async () => {
    server = await startDaemonServer(socketPath);

    expect(await writeAndEnd(socketPath, { kind: 'telemetry-event', event: OUTCOME })).toBe('');
    expect(await requestOnce(socketPath, { kind: 'telemetry-show' })).toEqual({
      kind: 'telemetry-buffer',
      pending: null,
      lastSent: null,
    });
    expect(await requestOnce(socketPath, { kind: 'telemetry-reset' })).toEqual({
      kind: 'telemetry-buffer',
      pending: null,
      lastSent: null,
    });
  });

  it('the pong advertises telemetry with the four existing flags', async () => {
    server = await startDaemonServer(socketPath);

    expect(await requestOnce(socketPath, { kind: 'ping' })).toEqual({
      kind: 'pong',
      fetchCandidates: true,
      installedTools: true,
      streamCandidates: true,
      providerPin: true,
      telemetry: true,
    });
  });
});

describe('fetch-error errorKind', () => {
  it('parses with an errorKind from ERROR_KINDS', () => {
    const parsed = ipcResponseSchema.safeParse({
      kind: 'fetch-error',
      message: 'x',
      errorKind: 'provider_timeout',
    });
    expect(
      parsed.success ? (parsed.data as Record<string, unknown>).errorKind : 'parse-failed',
    ).toBe('provider_timeout');
  });

  it('still parses without errorKind (old daemons)', () => {
    expect(ipcResponseSchema.safeParse({ kind: 'fetch-error', message: 'x' }).success).toBe(true);
  });

  it('filters an unknown errorKind value instead of rejecting the reply', () => {
    const parsed = ipcResponseSchema.safeParse({
      kind: 'fetch-error',
      message: 'x',
      errorKind: 'from_a_newer_daemon',
    });
    expect(parsed.success).toBe(true);
    expect(
      parsed.success ? (parsed.data as Record<string, unknown>).errorKind : 'parse-failed',
    ).toBe(undefined);
  });
});

describe('shutdownDaemon telemetry flush', () => {
  let socketPath: string;

  beforeEach(() => {
    socketPath = `/tmp/qq-telemetry-sd-${process.pid}-${Math.random().toString(36).slice(2)}.sock`;
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(socketPath, { force: true });
  });

  async function serverWithOrder(order: string[]) {
    const server = await startDaemonServer(socketPath);
    const connections = trackConnections(server);
    const close = server.close.bind(server);
    vi.spyOn(server, 'close').mockImplementation((callback) => {
      order.push('close');
      return close(callback);
    });
    const closed = new Promise<void>((resolve) => server.once('close', () => resolve()));
    return { server, connections, closed };
  }

  it('stops the timer and starts the flush before the server closes', async () => {
    const order: string[] = [];
    const { server, connections, closed } = await serverWithOrder(order);
    const telemetry = {
      stop: vi.fn(() => {
        order.push('stop');
      }),
      flush: vi.fn(async () => {
        order.push('flush');
      }),
    };
    const exit = vi.fn();

    shutdownDaemon(server, connections, { exit, graceMs: 0, telemetry });

    await closed;
    await vi.waitFor(() => expect(exit).toHaveBeenCalledTimes(1));
    expect(order).toEqual(['stop', 'flush', 'close']);
  });

  it('a flush that never settles delays exit by at most TELEMETRY_SHUTDOWN_WAIT_MS', async () => {
    const { server, connections, closed } = await serverWithOrder([]);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const telemetry = { stop: vi.fn(), flush: vi.fn(() => new Promise<void>(() => undefined)) };
    const exit = vi.fn();

    shutdownDaemon(server, connections, { exit, graceMs: 0, telemetry });
    await closed;

    await vi.advanceTimersByTimeAsync(TELEMETRY_SHUTDOWN_WAIT_MS - 1);
    expect(exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('a resolving flush lets exit run right after it', async () => {
    const { server, connections, closed } = await serverWithOrder([]);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let finish: (() => void) | undefined;
    const telemetry = {
      stop: vi.fn(),
      flush: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    };
    const exit = vi.fn();

    shutdownDaemon(server, connections, { exit, graceMs: 0, telemetry });
    await closed;
    await Promise.resolve();
    expect(exit).not.toHaveBeenCalled();

    finish?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('a rejecting flush does not block exit', async () => {
    const { server, connections, closed } = await serverWithOrder([]);
    const telemetry = { stop: vi.fn(), flush: vi.fn(async () => Promise.reject(new Error('x'))) };
    const exit = vi.fn();

    shutdownDaemon(server, connections, { exit, graceMs: 0, telemetry });
    await closed;
    await vi.waitFor(() => expect(exit).toHaveBeenCalledTimes(1));
  });
});
