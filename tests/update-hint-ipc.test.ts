import * as fs from 'node:fs';
import type * as net from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { appendDebugLogMock } = vi.hoisted(() => ({
  appendDebugLogMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/shared/debug-log.js', () => ({
  appendDebugLog: appendDebugLogMock,
}));

import { requestDaemonOnce } from '../src/cli/commands/telemetry.js';
import { ipcRequestSchema, ipcResponseSchema } from '../src/contracts/ipc.js';
import { startDaemonServer } from '../src/daemon/server.js';

const HINT = 'qq update available · brew upgrade queque';

describe('update-hint IPC kind', () => {
  let socketPath: string;
  let server: net.Server | null = null;

  beforeEach(() => {
    socketPath = `/tmp/qq-update-${process.pid}-${Math.random().toString(36).slice(2)}.sock`;
    appendDebugLogMock.mockClear();
  });

  afterEach(() => {
    if (server) {
      server.close();
      server.unref();
      server = null;
    }
    fs.rmSync(socketPath, { force: true });
  });

  it('replies null at once and then wakes the checker', async () => {
    const prepare = vi.fn(async () => undefined);
    server = await startDaemonServer(socketPath, { updates: { prepare } });
    await expect(requestDaemonOnce(socketPath, { kind: 'update-hint' }, 2000)).resolves.toEqual({
      kind: 'update-hint',
      hint: null,
    });
    await vi.waitFor(() => expect(prepare).toHaveBeenCalledTimes(1));
  });

  it('does not wait for a slow checker before replying', async () => {
    server = await startDaemonServer(socketPath, {
      updates: { prepare: () => new Promise<void>(() => undefined) },
    });
    await expect(requestDaemonOnce(socketPath, { kind: 'update-hint' }, 2000)).resolves.toEqual({
      kind: 'update-hint',
      hint: null,
    });
  });

  it('replies null without an update checker', async () => {
    server = await startDaemonServer(socketPath, {});
    await expect(requestDaemonOnce(socketPath, { kind: 'update-hint' }, 2000)).resolves.toEqual({
      kind: 'update-hint',
      hint: null,
    });
  });

  it('keeps serving when the checker rejects or throws synchronously', async () => {
    for (const prepare of [
      async () => {
        throw new Error('boom');
      },
      () => {
        throw new Error('sync boom');
      },
    ]) {
      server?.close();
      fs.rmSync(socketPath, { force: true });
      server = await startDaemonServer(socketPath, { updates: { prepare } });
      await expect(requestDaemonOnce(socketPath, { kind: 'update-hint' }, 2000)).resolves.toEqual({
        kind: 'update-hint',
        hint: null,
      });
      await expect(requestDaemonOnce(socketPath, { kind: 'ping' }, 2000)).resolves.toMatchObject({
        kind: 'pong',
      });
    }
  });
});

describe('update-hint schemas', () => {
  it('accepts the request', () => {
    expect(ipcRequestSchema.safeParse({ kind: 'update-hint' }).success).toBe(true);
  });

  it('maps a non-string or over-long hint to null', () => {
    expect(ipcResponseSchema.parse({ kind: 'update-hint', hint: 42 })).toEqual({
      kind: 'update-hint',
      hint: null,
    });
    expect(ipcResponseSchema.parse({ kind: 'update-hint', hint: 'a'.repeat(201) })).toEqual({
      kind: 'update-hint',
      hint: null,
    });
    expect(ipcResponseSchema.parse({ kind: 'update-hint', hint: HINT })).toEqual({
      kind: 'update-hint',
      hint: HINT,
    });
  });
});
