import * as fs from 'node:fs';
import * as net from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted runs before vi.mock, giving us a stable reference to the mock fn
const { spawnFn } = vi.hoisted(() => {
  return {
    spawnFn: vi.fn(() => ({
      unref: vi.fn(),
      on: vi.fn(),
    })),
  };
});

vi.mock('node:child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:child_process')>();
  return {
    ...original,
    spawn: spawnFn,
  };
});

// Stub fs.existsSync so the qqScript existence check passes in tests.
// The real script path does not exist in the test environment (no build required).
vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>();
  return {
    ...original,
    existsSync: vi.fn((p: unknown) => {
      // Allow the qqScript path check to pass; real socket-path checks use
      // the original implementation so mkdtempSync / writeFileSync still work.
      if (typeof p === 'string' && p.endsWith('main.js')) return true;
      return original.existsSync(p as string);
    }),
  };
});

describe('daemon bootstrap', () => {
  let socketPath: string;
  let testServer: net.Server | null = null;

  beforeEach(() => {
    // Use a socket directly in /tmp so assertSafeSocketPath accepts it (WR-003).
    const suffix = Math.random().toString(36).slice(2);
    socketPath = `/tmp/qq-test-${suffix}.sock`;
    spawnFn.mockClear();
    spawnFn.mockReturnValue({ unref: vi.fn(), on: vi.fn() });
  });

  afterEach(async () => {
    if (testServer) {
      await new Promise<void>((resolve) => testServer!.close(() => resolve()));
      testServer = null;
    }
    try {
      fs.rmSync(socketPath, { force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('connects without spawning when a live socket already exists', async () => {
    // Create a real listening socket before calling ensureDaemon
    testServer = net.createServer(() => {});
    await new Promise<void>((resolve, reject) => {
      testServer!.listen(socketPath, () => resolve());
      testServer!.once('error', reject);
    });

    const { ensureDaemon } = await import('../src/daemon/bootstrap.js');

    await expect(ensureDaemon(socketPath)).resolves.toBeUndefined();
    // spawn should NOT have been called — socket was already alive
    expect(spawnFn).not.toHaveBeenCalled();
  });

  it('spawns the daemon when no socket file exists', async () => {
    // Make spawn create the socket so ensureDaemon poll loop can connect
    spawnFn.mockImplementation(() => {
      testServer = net.createServer(() => {});
      testServer.listen(socketPath);
      return { unref: vi.fn(), on: vi.fn() };
    });

    const { ensureDaemon } = await import('../src/daemon/bootstrap.js');

    await expect(ensureDaemon(socketPath)).resolves.toBeUndefined();
    expect(spawnFn).toHaveBeenCalledTimes(1);
  });

  it('unlinks a stale socket and spawns after a failed connect', async () => {
    // Write a fake stale socket file (no server behind it)
    fs.writeFileSync(socketPath, '');

    spawnFn.mockImplementation(() => {
      // After unlink, start a real server so the poll loop can reconnect
      testServer = net.createServer(() => {});
      testServer.listen(socketPath);
      return { unref: vi.fn(), on: vi.fn() };
    });

    const { ensureDaemon } = await import('../src/daemon/bootstrap.js');

    await expect(ensureDaemon(socketPath)).resolves.toBeUndefined();
    // spawn must have been called (stale socket → unlink → spawn)
    expect(spawnFn).toHaveBeenCalledTimes(1);
  });
});

describe('daemon server', () => {
  let socketPath: string;
  let testServer: net.Server | null = null;

  beforeEach(() => {
    // Use a socket directly in /tmp so assertSafeSocketPath accepts it (WR-003).
    const suffix = Math.random().toString(36).slice(2);
    socketPath = `/tmp/qq-server-${suffix}.sock`;
  });

  afterEach(async () => {
    if (testServer) {
      await new Promise<void>((resolve) => testServer!.close(() => resolve()));
      testServer = null;
    }
    try {
      fs.rmSync(socketPath, { force: true });
    } catch {
      // ignore
    }
  });

  it('responds to {kind: "ping"} with {kind: "pong"}', async () => {
    const { startDaemonServer } = await import('../src/daemon/server.js');

    testServer = await startDaemonServer(socketPath);

    const result = await new Promise<string>((resolve, reject) => {
      const client = net.createConnection(socketPath, () => {
        const msg = `${JSON.stringify({ kind: 'ping' })}\n`;
        client.write(msg);
      });

      let buf = '';
      client.on('data', (chunk) => {
        buf += chunk.toString();
        const nl = buf.indexOf('\n');
        if (nl !== -1) {
          client.destroy();
          resolve(buf.slice(0, nl));
        }
      });

      client.on('error', reject);
      setTimeout(() => reject(new Error('timeout waiting for pong')), 2000);
    });

    expect(JSON.parse(result)).toEqual({ kind: 'pong' });
  });
});
