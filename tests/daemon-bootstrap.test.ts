import * as fs from 'node:fs';
import * as net from 'node:net';
import { homedir } from 'node:os';
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
      testServer.close();
      testServer.unref();
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
    testServer = net.createServer((socket) => {
      socket.resume();
    });
    await new Promise<void>((resolve, reject) => {
      testServer?.listen(socketPath, () => resolve());
      testServer?.once('error', reject);
    });

    const { ensureDaemon } = await import('../src/daemon/bootstrap.js');

    await expect(ensureDaemon(socketPath)).resolves.toBeUndefined();
    // Unanswered ping is `unknown` — keep the socket (test dummy servers).
    expect(spawnFn).not.toHaveBeenCalled();
  });

  it('replaces a live daemon whose pong lacks fetchCandidates', async () => {
    const legacyServer = net.createServer((socket) => {
      socket.on('data', (chunk) => {
        const line = chunk.toString();
        if (line.includes('"ping"')) {
          socket.write(`${JSON.stringify({ kind: 'pong' })}\n`);
        }
      });
    });
    await new Promise<void>((resolve, reject) => {
      legacyServer.listen(socketPath, () => resolve());
      legacyServer.once('error', reject);
    });

    spawnFn.mockImplementation(() => {
      testServer = net.createServer(() => {});
      testServer.listen(socketPath);
      return { unref: vi.fn(), on: vi.fn() };
    });

    const { ensureDaemon } = await import('../src/daemon/bootstrap.js');

    try {
      await expect(ensureDaemon(socketPath)).resolves.toBeUndefined();
      expect(spawnFn).toHaveBeenCalledTimes(1);
    } finally {
      legacyServer.close();
      legacyServer.unref();
    }
  });

  it('replaces a live daemon whose pong lacks installedTools', async () => {
    // Pre-Phase-9 daemon: fetch-capable, but drops envelopes carrying the
    // installed-tools chunk because its schema cannot validate them.
    const legacyServer = net.createServer((socket) => {
      socket.on('data', (chunk) => {
        const line = chunk.toString();
        if (line.includes('"ping"')) {
          socket.write(`${JSON.stringify({ kind: 'pong', fetchCandidates: true })}\n`);
        }
      });
    });
    await new Promise<void>((resolve, reject) => {
      legacyServer.listen(socketPath, () => resolve());
      legacyServer.once('error', reject);
    });

    spawnFn.mockImplementation(() => {
      testServer = net.createServer(() => {});
      testServer.listen(socketPath);
      return { unref: vi.fn(), on: vi.fn() };
    });

    const { ensureDaemon } = await import('../src/daemon/bootstrap.js');

    try {
      await expect(ensureDaemon(socketPath)).resolves.toBeUndefined();
      expect(spawnFn).toHaveBeenCalledTimes(1);
    } finally {
      legacyServer.close();
      legacyServer.unref();
    }
  });

  it('replaces a live daemon whose pong lacks streamCandidates', async () => {
    // Pre-09.1 daemon: accepts installed-tools envelopes but never streams
    // `candidate` messages to a `stream: true` client.
    const legacyServer = net.createServer((socket) => {
      socket.on('data', (chunk) => {
        const line = chunk.toString();
        if (line.includes('"ping"')) {
          socket.write(
            `${JSON.stringify({ kind: 'pong', fetchCandidates: true, installedTools: true })}\n`,
          );
        }
      });
    });
    await new Promise<void>((resolve, reject) => {
      legacyServer.listen(socketPath, () => resolve());
      legacyServer.once('error', reject);
    });

    spawnFn.mockImplementation(() => {
      testServer = net.createServer(() => {});
      testServer.listen(socketPath);
      return { unref: vi.fn(), on: vi.fn() };
    });

    const { ensureDaemon } = await import('../src/daemon/bootstrap.js');

    try {
      await expect(ensureDaemon(socketPath)).resolves.toBeUndefined();
      expect(spawnFn).toHaveBeenCalledTimes(1);
    } finally {
      legacyServer.close();
      legacyServer.unref();
    }
  });

  it('replaces a live daemon whose pong lacks providerPin (v0.6.0 flags only)', async () => {
    // A v0.6.0 daemon advertises the three earlier flags but resolves the Claude default
    // unconditionally and never reads provider.json, so an Ollama pin would still send
    // the prompt to Anthropic (CR-01).
    const legacyServer = net.createServer((socket) => {
      socket.on('data', (chunk) => {
        const line = chunk.toString();
        if (line.includes('"ping"')) {
          socket.write(
            `${JSON.stringify({
              kind: 'pong',
              fetchCandidates: true,
              installedTools: true,
              streamCandidates: true,
            })}\n`,
          );
        }
      });
    });
    await new Promise<void>((resolve, reject) => {
      legacyServer.listen(socketPath, () => resolve());
      legacyServer.once('error', reject);
    });

    spawnFn.mockImplementation(() => {
      testServer = net.createServer(() => {});
      testServer.listen(socketPath);
      return { unref: vi.fn(), on: vi.fn() };
    });

    const { ensureDaemon, pingDaemonFetchCap } = await import('../src/daemon/bootstrap.js');

    try {
      await expect(pingDaemonFetchCap(socketPath)).resolves.toBe('no');
      await expect(ensureDaemon(socketPath)).resolves.toBeUndefined();
      expect(spawnFn).toHaveBeenCalledTimes(1);
    } finally {
      legacyServer.close();
      legacyServer.unref();
    }
  });

  it('keeps a live daemon whose pong has all four capabilities and this build', async () => {
    // Updated deliberately in quick 261030-tq3: the pong now also carries this client's build.
    // Still no `telemetry` flag, which pins that a missing telemetry flag alone never triggers
    // a replacement. The fake counts ping lines: the same-build path costs exactly one ping.
    let pings = 0;
    testServer = net.createServer((socket) => {
      socket.on('data', (chunk) => {
        const line = chunk.toString();
        if (line.includes('"ping"')) {
          pings += 1;
          socket.write(
            `${JSON.stringify({
              kind: 'pong',
              fetchCandidates: true,
              installedTools: true,
              streamCandidates: true,
              providerPin: true,
              build: __QUEQUE_BUILD_ID__,
            })}\n`,
          );
        }
      });
    });
    await new Promise<void>((resolve, reject) => {
      testServer?.listen(socketPath, () => resolve());
      testServer?.once('error', reject);
    });

    const { ensureDaemon } = await import('../src/daemon/bootstrap.js');

    await expect(ensureDaemon(socketPath)).resolves.toBeUndefined();
    expect(spawnFn).not.toHaveBeenCalled();
    expect(pings).toBe(1);
  });

  describe('a daemon from another qq build (quick 261030-tq3, bug-473)', () => {
    const FOUR_FLAGS = {
      kind: 'pong',
      fetchCandidates: true,
      installedTools: true,
      streamCandidates: true,
      providerPin: true,
    } as const;

    /**
     * A fake daemon that answers `ping` with `pong` and `shutdown` with shutdown-accepted,
     * then closes its server. Every other line (telemetry-show included) is ignored, as the
     * bug-473 daemon did.
     */
    async function fakeDaemon(pong: Record<string, unknown>): Promise<net.Server> {
      const server: net.Server = net.createServer((socket) => {
        socket.on('data', (chunk) => {
          const line = chunk.toString();
          if (line.includes('"ping"')) {
            socket.write(`${JSON.stringify(pong)}\n`);
          } else if (line.includes('"shutdown"')) {
            socket.end(`${JSON.stringify({ kind: 'shutdown-accepted' })}\n`);
            server.close();
          }
        });
      });
      await new Promise<void>((resolve, reject) => {
        server.listen(socketPath, () => resolve());
        server.once('error', reject);
      });
      return server;
    }

    function spawnListens(): void {
      spawnFn.mockImplementation(() => {
        testServer = net.createServer(() => {});
        testServer.listen(socketPath);
        return { unref: vi.fn(), on: vi.fn() };
      });
    }

    it('replaces a bug-473 daemon (four flags, no telemetry, no build) over IPC', async () => {
      const oldServer = await fakeDaemon(FOUR_FLAGS);
      spawnListens();

      const { ensureDaemon } = await import('../src/daemon/bootstrap.js');

      try {
        await expect(ensureDaemon(socketPath)).resolves.toBeUndefined();
        expect(spawnFn).toHaveBeenCalledTimes(1);
        // Stopped by the IPC shutdown: lsof never signals the vitest pid.
        expect(oldServer.listening).toBe(false);
      } finally {
        oldServer.close();
        oldServer.unref();
      }
    });

    it('pingDaemonFetchCap is no for the bug-473 pong', async () => {
      const oldServer = await fakeDaemon(FOUR_FLAGS);

      const { pingDaemonFetchCap } = await import('../src/daemon/bootstrap.js');

      try {
        await expect(pingDaemonFetchCap(socketPath)).resolves.toBe('no');
      } finally {
        oldServer.close();
        oldServer.unref();
      }
    });

    it('replaces a daemon whose pong carries another build', async () => {
      const oldServer = await fakeDaemon({
        ...FOUR_FLAGS,
        telemetry: true,
        build: '9.9.9+other.0',
      });
      spawnListens();

      const { ensureDaemon } = await import('../src/daemon/bootstrap.js');

      try {
        await expect(ensureDaemon(socketPath)).resolves.toBeUndefined();
        expect(spawnFn).toHaveBeenCalledTimes(1);
        expect(oldServer.listening).toBe(false);
      } finally {
        oldServer.close();
        oldServer.unref();
      }
    });

    it('replaces a daemon with this build that lacks a capability flag', async () => {
      const { providerPin: _omitted, ...threeFlags } = FOUR_FLAGS;
      const oldServer = await fakeDaemon({ ...threeFlags, build: __QUEQUE_BUILD_ID__ });
      spawnListens();

      const { ensureDaemon } = await import('../src/daemon/bootstrap.js');

      try {
        await expect(ensureDaemon(socketPath)).resolves.toBeUndefined();
        expect(spawnFn).toHaveBeenCalledTimes(1);
      } finally {
        oldServer.close();
        oldServer.unref();
      }
    });

    it('keeps a real daemon server from this build', async () => {
      const { startDaemonServer } = await import('../src/daemon/server.js');
      testServer = await startDaemonServer(socketPath);

      const { ensureDaemon } = await import('../src/daemon/bootstrap.js');

      await expect(ensureDaemon(socketPath)).resolves.toBeUndefined();
      expect(spawnFn).not.toHaveBeenCalled();
      expect(testServer.listening).toBe(true);
    });
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

  it('spawns the daemon in the home directory, whatever the caller cwd (WR-08)', async () => {
    spawnFn.mockImplementation(() => {
      testServer = net.createServer(() => {});
      testServer.listen(socketPath);
      return { unref: vi.fn(), on: vi.fn() };
    });

    const { ensureDaemon } = await import('../src/daemon/bootstrap.js');

    await expect(ensureDaemon(socketPath)).resolves.toBeUndefined();
    const options = (spawnFn.mock.calls[0] as unknown[] | undefined)?.[2] as
      | { cwd?: string }
      | undefined;
    expect(options?.cwd).toBe(homedir());
  });

  describe('a home directory that does not exist (WR-12)', () => {
    const MISSING_HOME = '/nonexistent-qq-home-wr12';

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    /** Runs the real spawn with the options spawnDaemon chose, but a harmless child. */
    async function realSpawnWith(override: { cwd?: string } = {}): Promise<void> {
      const { spawn: realSpawn } =
        await vi.importActual<typeof import('node:child_process')>('node:child_process');
      (spawnFn as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_command: string, _args: string[], options: Record<string, unknown>) =>
          realSpawn(process.execPath, ['-e', ''], { ...options, ...override }),
      );
    }

    it('spawns the daemon in / instead and listens for spawn errors', async () => {
      vi.stubEnv('HOME', MISSING_HOME);
      const on = vi.fn();
      spawnFn.mockImplementation(() => {
        testServer = net.createServer(() => {});
        testServer.listen(socketPath);
        return { unref: vi.fn(), on };
      });

      const { daemonCwd, ensureDaemon } = await import('../src/daemon/bootstrap.js');

      expect(daemonCwd()).toBe('/');
      await expect(ensureDaemon(socketPath)).resolves.toBeUndefined();
      const options = (spawnFn.mock.calls[0] as unknown[] | undefined)?.[2] as
        | { cwd?: string }
        | undefined;
      expect(options?.cwd).toBe('/');
      expect(on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('a real spawn with the missing HOME does not emit an unhandled error', async () => {
      vi.stubEnv('HOME', MISSING_HOME);
      await realSpawnWith();

      const { ensureDaemon } = await import('../src/daemon/bootstrap.js');

      // The harmless child never listens, so ensureDaemon fails the normal way.
      await expect(ensureDaemon(socketPath)).rejects.toThrow('did not start');
    });

    it('a real spawn error event becomes a normal startup timeout, not a crash', async () => {
      await realSpawnWith({ cwd: MISSING_HOME });

      const { ensureDaemon } = await import('../src/daemon/bootstrap.js');

      await expect(ensureDaemon(socketPath)).rejects.toThrow('did not start');
    });
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

  it('restartDaemon stops a current daemon over IPC, without lsof (WR-07)', async () => {
    // The daemon server lives in the vitest pid, which the lsof fallback never signals, so
    // only the `shutdown` IPC request can stop it: that proves the restart needs no lsof.
    const { startDaemonServer } = await import('../src/daemon/server.js');
    const { shutdownDaemon, trackConnections } = await import('../src/cli/commands/daemon.js');
    const exit = vi.fn();
    let requestShutdown = (): void => undefined;
    const currentServer = await startDaemonServer(socketPath, {
      onShutdown: () => requestShutdown(),
    });
    const connections = trackConnections(currentServer);
    requestShutdown = () => shutdownDaemon(currentServer, connections, { exit, graceMs: 0 });

    spawnFn.mockImplementation(() => {
      testServer = net.createServer(() => {});
      testServer.listen(socketPath);
      return { unref: vi.fn(), on: vi.fn() };
    });

    const { restartDaemon } = await import('../src/daemon/bootstrap.js');

    try {
      await expect(restartDaemon(socketPath)).resolves.toBeUndefined();
      expect(currentServer.listening).toBe(false);
      await vi.waitFor(() => expect(exit).toHaveBeenCalledTimes(1));
      expect(spawnFn).toHaveBeenCalledTimes(1);
    } finally {
      currentServer.close();
      currentServer.unref();
    }
  });

  it('requestDaemonShutdown is false for a daemon that ignores the request', async () => {
    // A pre-WR-07 daemon (or a server without onShutdown) never acknowledges; the caller
    // then falls back to signalling lsof listeners.
    const { startDaemonServer } = await import('../src/daemon/server.js');
    testServer = await startDaemonServer(socketPath);

    const { requestDaemonShutdown } = await import('../src/daemon/bootstrap.js');

    await expect(requestDaemonShutdown(socketPath)).resolves.toBe(false);
    expect(testServer.listening).toBe(true);
  });

  it('restartDaemon unlinks a daemon that ignores shutdown and spawns once', async () => {
    // A fully current daemon (ensureDaemon would keep it) is still replaced, so the new
    // daemon inherits the caller's environment (`qq init provider` after an export). This
    // fake ignores `shutdown` and shares the vitest pid (never signalled), so the test proves
    // the socket path is unlinked and a new daemon spawned, not that the old one stopped.
    const currentServer = net.createServer((socket) => {
      socket.on('data', (chunk) => {
        if (chunk.toString().includes('"ping"')) {
          socket.write(
            `${JSON.stringify({
              kind: 'pong',
              fetchCandidates: true,
              installedTools: true,
              streamCandidates: true,
              providerPin: true,
            })}\n`,
          );
        }
      });
    });
    await new Promise<void>((resolve, reject) => {
      currentServer.listen(socketPath, () => resolve());
      currentServer.once('error', reject);
    });

    spawnFn.mockImplementation(() => {
      testServer = net.createServer(() => {});
      testServer.listen(socketPath);
      return { unref: vi.fn(), on: vi.fn() };
    });

    const { restartDaemon } = await import('../src/daemon/bootstrap.js');

    try {
      await expect(restartDaemon(socketPath)).resolves.toBeUndefined();
      expect(spawnFn).toHaveBeenCalledTimes(1);
    } finally {
      currentServer.close();
      currentServer.unref();
    }
  });

  it('restartDaemon starts a daemon when none is running', async () => {
    spawnFn.mockImplementation(() => {
      testServer = net.createServer(() => {});
      testServer.listen(socketPath);
      return { unref: vi.fn(), on: vi.fn() };
    });

    const { restartDaemon } = await import('../src/daemon/bootstrap.js');

    await expect(restartDaemon(socketPath)).resolves.toBeUndefined();
    expect(spawnFn).toHaveBeenCalledTimes(1);
  });

  it('restartDaemon rejects when the new daemon never listens', async () => {
    const { restartDaemon } = await import('../src/daemon/bootstrap.js');

    await expect(restartDaemon(socketPath)).rejects.toThrow(/did not restart/);
    expect(spawnFn).toHaveBeenCalledTimes(1);
  });

  it('restartDaemon rejects an unsafe socket path', async () => {
    const { restartDaemon } = await import('../src/daemon/bootstrap.js');

    await expect(restartDaemon('/etc/qq.sock')).rejects.toThrow(/unsafe socket path/);
    expect(spawnFn).not.toHaveBeenCalled();
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

    expect(JSON.parse(result)).toEqual({
      kind: 'pong',
      fetchCandidates: true,
      installedTools: true,
      streamCandidates: true,
      providerPin: true,
      telemetry: true,
      build: __QUEQUE_BUILD_ID__,
    });
  });
});
