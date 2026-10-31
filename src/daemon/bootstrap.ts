import { execFileSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { ipcResponseSchema } from '../contracts/ipc.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { assertSafeSocketPath } from '../shared/socket-path.js';

const CONNECT_TIMEOUT_MS = 500;
const PING_TIMEOUT_MS = 500;
const POLL_INTERVAL_MS = 50;
const POLL_MAX_ATTEMPTS = 40; // 2 seconds total
const SHUTDOWN_ACK_TIMEOUT_MS = 500;

/**
 * Attempts to connect to the daemon socket at `socketPath`.
 * Resolves true if the connection succeeds, false on any error.
 * Exported so `qq doctor` can tell "no listener" from "a listener that does not answer"
 * (10-REVIEW WR-03).
 */
export function tryConnect(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      client.destroy();
      resolve(false);
    }, CONNECT_TIMEOUT_MS);

    const client = net.createConnection(socketPath, () => {
      clearTimeout(timer);
      client.destroy();
      resolve(true);
    });

    client.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

/**
 * Whether the listener on `socketPath` can handle the current `fetch-candidates`
 * envelope.
 *
 * - `yes`: pong includes `fetchCandidates: true`, `installedTools: true`,
 *   `streamCandidates: true` and `providerPin: true`, AND its `build` equals this
 *   client's `__QUEQUE_BUILD_ID__`
 * - `no`: pong missing any flag (older production daemon — replace it). Such a
 *   daemon silently drops `fetch-candidates` envelopes it cannot validate, which
 *   costs the 800 ms ack timeout plus a cold in-process fetch on every `??`, or
 *   (without `streamCandidates`) never streams rows to a `stream: true` client, or
 *   (without `providerPin`, e.g. v0.6.0) ignores provider.json and sends every
 *   prompt to Claude even for a local-only pin. Also `no` when the flags pass but
 *   `build` is absent or differs (quick 261030-tq3, bug-473): a daemon from another
 *   build runs other code, for example one that ignores `telemetry-event`.
 * - `unknown`: no reply, timeout or unparseable reply (tests' dumb
 *   `net.createServer`, or a hung socket — keep)
 *
 * Since 261030-tq3 the build check replaces a daemon from any other build, which covers
 * later IPC shape and routing changes by itself; the capability flags remain as the
 * guard they were. The comparison rides on the single existing ping, so a same-build
 * daemon costs no extra round trip.
 */
export function pingDaemonFetchCap(socketPath: string): Promise<'yes' | 'no' | 'unknown'> {
  return new Promise((resolve) => {
    let settled = false;
    let buf = '';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = (result: 'yes' | 'no' | 'unknown') => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      client.destroy();
      resolve(result);
    };

    const client = net.createConnection(socketPath);
    timer = setTimeout(() => {
      done('unknown');
    }, PING_TIMEOUT_MS);

    client.on('connect', () => {
      client.write(`${JSON.stringify({ kind: 'ping' })}\n`);
    });

    client.on('data', (chunk) => {
      buf += chunk.toString();
      const nl = buf.indexOf('\n');
      if (nl === -1) {
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(buf.slice(0, nl));
      } catch {
        done('unknown');
        return;
      }
      const response = ipcResponseSchema.safeParse(parsed);
      if (!response.success || response.data.kind !== 'pong') {
        done('unknown');
        return;
      }
      const flags =
        response.data.fetchCandidates === true &&
        response.data.installedTools === true &&
        response.data.streamCandidates === true &&
        response.data.providerPin === true;
      if (!flags) {
        done('no');
        return;
      }
      const build = response.data.build;
      if (build === __QUEQUE_BUILD_ID__) {
        done('yes');
        return;
      }
      void appendDebugLog('daemon', 'daemon build differs', {
        daemonBuild: build ?? null,
        clientBuild: __QUEQUE_BUILD_ID__,
      });
      done('no');
    });

    client.on('error', () => {
      done('unknown');
    });
  });
}

/**
 * Asks the daemon on `socketPath` to shut itself down over IPC (WR-07). Resolves true when
 * it replied `shutdown-accepted`; false for no reply, a timeout, an error or another reply
 * (a daemon from before this request ignores it, so the caller falls back to `lsof`).
 */
export function requestDaemonShutdown(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let buf = '';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = (accepted: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      client.destroy();
      resolve(accepted);
    };

    const client = net.createConnection(socketPath);
    timer = setTimeout(() => {
      done(false);
    }, SHUTDOWN_ACK_TIMEOUT_MS);

    client.on('connect', () => {
      client.write(`${JSON.stringify({ kind: 'shutdown' })}\n`);
    });

    client.on('data', (chunk) => {
      buf += chunk.toString();
      const nl = buf.indexOf('\n');
      if (nl === -1) {
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(buf.slice(0, nl));
      } catch {
        done(false);
        return;
      }
      const response = ipcResponseSchema.safeParse(parsed);
      done(response.success && response.data.kind === 'shutdown-accepted');
    });

    client.on('error', () => {
      done(false);
    });
  });
}

/**
 * Polls the socket path until the daemon becomes connectable or
 * the attempt limit is reached.
 */
async function waitForSocket(
  socketPath: string,
  maxAttempts = POLL_MAX_ATTEMPTS,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await tryConnect(socketPath)) return true;
    await new Promise<void>((res) => setTimeout(res, POLL_INTERVAL_MS));
  }

  return false;
}

/**
 * Parses `lsof -t` output into the pids to signal, never `selfPid`.
 *
 * Accepts the output only when every non-empty line is a bare pid. busybox `lsof` (Alpine)
 * ignores `-t <path>` and lists every open file of every process as
 * `PID<TAB>/bin/busybox<TAB>FD<TAB>TARGET`; parsing that as pids made replaceStaleListener
 * signal every process in the container, PID 1 included (Phase 10 Defect 1). Any other
 * shape returns `[]` and writes a debug line saying the output was ignored.
 * Exported for the Defect 1 regression test (tests/lsof-busybox.test.ts).
 */
export function parseLsofPidList(output: string, selfPid: number): number[] {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  if (!lines.every((line) => /^\d+$/.test(line))) {
    void appendDebugLog('daemon', 'lsof output ignored', { lines: lines.length });
    return [];
  }
  return lines.map(Number).filter((n) => n > 0 && n !== selfPid);
}

/**
 * The pids `lsof -t` reports for `socketPath`, or `[]` when lsof is missing or fails.
 * Exported for the Defect 1 regression test (tests/lsof-busybox.test.ts).
 */
export function listenerPids(socketPath: string): number[] {
  try {
    const out = execFileSync('lsof', ['-t', socketPath], {
      encoding: 'utf8',
      timeout: 1000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return parseLsofPidList(out, process.pid);
  } catch {
    return [];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Stops the daemon holding `socketPath` and unlinks the path so a new daemon can bind.
 *
 * First the daemon is asked to shut down over IPC (WR-07), which works without `lsof`
 * (missing on many minimal Linux systems) and lets it retire its `claude` children. Daemons
 * from before the `shutdown` request do not answer it; for them, and as a backstop, the
 * `lsof -t` listeners get SIGTERM then SIGKILL. Never signals the current pid (test servers
 * share the vitest process). Exported for the Defect 1 regression test
 * (tests/lsof-busybox.test.ts).
 */
export async function replaceStaleListener(socketPath: string): Promise<void> {
  void appendDebugLog('daemon', 'replacing stale daemon', { socketPath });
  if (await requestDaemonShutdown(socketPath)) {
    void appendDebugLog('daemon', 'daemon accepted shutdown', { socketPath });
    for (let i = 0; i < 20 && (await tryConnect(socketPath)); i++) {
      await sleep(50);
    }
  }
  for (const pid of listenerPids(socketPath)) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
  await sleep(80);
  for (const pid of listenerPids(socketPath)) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
  try {
    fs.unlinkSync(socketPath);
  } catch {
    // ignore
  }
  for (let i = 0; i < 20; i++) {
    if (!(await tryConnect(socketPath))) {
      return;
    }
    try {
      fs.unlinkSync(socketPath);
    } catch {
      // ignore
    }
    await sleep(50);
  }
}

function spawnDaemon(socketPath: string): void {
  const qqBin = process.execPath;
  const qqScript = fileURLToPath(import.meta.url);

  if (!fs.existsSync(qqScript)) {
    void appendDebugLog('daemon', 'script missing', { qqScript });
    throw new Error(`qq daemon script not found at: ${qqScript}. Run 'pnpm build' first.`);
  }

  void appendDebugLog('daemon', 'spawning daemon', { qqScript, socketPath });
  // WR-08: a fixed cwd, so the daemon never depends on whatever project directory the
  // spawning terminal or `qq init provider` happened to be in. Its `.env.local` key source is
  // ~/.env.local: readEnvValueFromDotEnvLocal starts at the home directory (WR-10).
  const child = spawn(qqBin, [qqScript, 'daemon', '--socket', socketPath], {
    cwd: daemonCwd(),
    detached: true,
    stdio: 'ignore',
  });
  // WR-12: a spawn failure is an asynchronous 'error' event, never a throw. Without a
  // listener it would reach the process-wide uncaughtException handler, which cancels the
  // `??`. Logged here, the failure surfaces as a normal waitForSocket timeout instead.
  child.on('error', (error: NodeJS.ErrnoException) => {
    void appendDebugLog('daemon', 'spawn failed', { code: error.code });
  });

  child.unref();
}

/**
 * The daemon's working directory: the home directory (WR-08), or `/` when that directory
 * does not exist (WR-12: service accounts, containers with `HOME=/nonexistent`, sandboxes).
 * Node reports a missing cwd as a misleading `spawn <node> ENOENT` 'error' event.
 */
export function daemonCwd(): string {
  const home = homedir();
  return home && fs.existsSync(home) ? home : '/';
}

/**
 * Replaces whatever daemon holds `socketPath` (even a fully current one) with a fresh
 * daemon spawned from this process, so it inherits this process's environment. `qq init
 * provider` calls it after saving a pin, so a key exported a moment ago is visible to the
 * warm daemon on the next ??. The old daemon is stopped over IPC first (replaceStaleListener),
 * which also ends `??` fetches in flight in other terminals.
 *
 * Only listeners of the safe qq socket are signalled, never the current pid
 * (replaceStaleListener). Throws for an unsafe path or when the new daemon does not
 * listen within the poll window.
 */
export async function restartDaemon(socketPath: string): Promise<void> {
  assertSafeSocketPath(socketPath);
  void appendDebugLog('daemon', 'restart requested', { socketPath });

  await replaceStaleListener(socketPath);
  spawnDaemon(socketPath);

  if (!(await waitForSocket(socketPath))) {
    void appendDebugLog('daemon', 'restart timeout', { socketPath });
    throw new Error('qq daemon did not restart within the expected window');
  }
  void appendDebugLog('daemon', 'daemon ready', { socketPath, restarted: true });
}

/**
 * Ensures a qq daemon is running at `socketPath`.
 *
 * Algorithm:
 *   1. Try to connect. If it succeeds, ping. Keep listeners that advertise every
 *      capability or do not reply (test sockets). Replace a live pong lacking
 *      any of `fetchCandidates`, `installedTools`, `streamCandidates` or
 *      `providerPin` — such a daemon silently drops `fetch-candidates` envelopes
 *      it cannot validate and stalls the client, never streams rows, or ignores
 *      provider.json and sends the prompt to Claude. Since quick 261030-tq3 a pong
 *      whose `build` is absent or differs from this client's `__QUEQUE_BUILD_ID__` is
 *      replaced too (bug-473: a daemon left running across an upgrade or rebuild),
 *      which covers later IPC shape and routing changes; the flags remain as a guard.
 *      Replacement goes through replaceStaleListener, the graceful `shutdown` path
 *      that restartDaemon also uses.
 *   2. If the socket file exists but the connect failed, unlink it (stale socket).
 *   3. Spawn `qq daemon --socket <path>` as a detached, unreferenced child.
 *   4. Poll until the new daemon starts listening, then return.
 *
 * Throws if the daemon does not start within the poll window.
 * Throws if `socketPath` is not a safe /tmp/qq-*.sock path.
 */
export async function ensureDaemon(socketPath: string): Promise<void> {
  assertSafeSocketPath(socketPath);
  void appendDebugLog('daemon', 'ensure start', { socketPath });

  if (await tryConnect(socketPath)) {
    const cap = await pingDaemonFetchCap(socketPath);
    if (cap !== 'no') {
      void appendDebugLog('daemon', 'already running', { socketPath, cap });
      return;
    }
    await replaceStaleListener(socketPath);
  } else {
    // Unlink stale socket file if present.
    //
    // TOCTOU note: there is a narrow window between the failed tryConnect above
    // and this unlink where a concurrent ensureDaemon call (e.g. from a second
    // terminal tab) may have already started a fresh daemon and be listening on
    // the socket. Unlinking here would destroy that live socket. This is
    // acceptable for the MVP (single active session assumed) but will need a
    // file-based lock (O_EXCL) before multi-window use is supported.
    try {
      fs.unlinkSync(socketPath);
    } catch {
      // File may not exist — that is fine
    }
  }

  spawnDaemon(socketPath);

  const started = await waitForSocket(socketPath);
  if (!started) {
    void appendDebugLog('daemon', 'startup timeout', { socketPath });
    throw new Error(`qq daemon did not start within the expected window (${socketPath})`);
  }

  void appendDebugLog('daemon', 'daemon ready', { socketPath });
}
