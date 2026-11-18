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

  it('replies with the checker hint', async () => {
    server = await startDaemonServer(socketPath, { updates: { hint: async () => HINT } });
    await expect(requestDaemonOnce(socketPath, { kind: 'update-hint' }, 2000)).resolves.toEqual({
      kind: 'update-hint',
      hint: HINT,
    });
    // The debug log records whether a hint was shown, never its text.
    const logged = JSON.stringify(appendDebugLogMock.mock.calls);
    expect(logged).toContain('replied update-hint');
    expect(logged).not.toContain('brew upgrade');
  });

  it('replies null without an update checker', async () => {
    server = await startDaemonServer(socketPath, {});
    await expect(requestDaemonOnce(socketPath, { kind: 'update-hint' }, 2000)).resolves.toEqual({
      kind: 'update-hint',
      hint: null,
    });
  });

  it('replies null when the checker rejects and keeps serving', async () => {
    server = await startDaemonServer(socketPath, {
      updates: {
        hint: async () => {
          throw new Error('boom');
        },
      },
    });
    await expect(requestDaemonOnce(socketPath, { kind: 'update-hint' }, 2000)).resolves.toEqual({
      kind: 'update-hint',
      hint: null,
    });
    await expect(requestDaemonOnce(socketPath, { kind: 'ping' }, 2000)).resolves.toMatchObject({
      kind: 'pong',
    });
  });

  it('replies null when the checker throws synchronously', async () => {
    server = await startDaemonServer(socketPath, {
      updates: {
        hint: () => {
          throw new Error('sync boom');
        },
      },
    });
    await expect(requestDaemonOnce(socketPath, { kind: 'update-hint' }, 2000)).resolves.toEqual({
      kind: 'update-hint',
      hint: null,
    });
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
