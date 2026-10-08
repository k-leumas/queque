import { execFileSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import { fileURLToPath } from 'node:url';
import { ipcResponseSchema } from '../contracts/ipc.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { assertSafeSocketPath } from '../shared/socket-path.js';

const CONNECT_TIMEOUT_MS = 500;
const PING_TIMEOUT_MS = 500;
const POLL_INTERVAL_MS = 50;
const POLL_MAX_ATTEMPTS = 40; // 2 seconds total

/**
 * Attempts to connect to the daemon socket at `socketPath`.
 * Resolves true if the connection succeeds, false on any error.
 */
function tryConnect(socketPath: string): Promise<boolean> {
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
 * Whether the listener on `socketPath` can handle `fetch-candidates`.
 *
 * - `yes`: pong includes `fetchCandidates: true`
 * - `no`: pong without that flag (pre-fetch production daemon — replace it)
 * - `unknown`: no reply (tests' dumb `net.createServer`, or a hung socket — keep)
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
      done(response.data.fetchCandidates === true ? 'yes' : 'no');
    });

    client.on('error', () => {
      done('unknown');
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

function listenerPids(socketPath: string): number[] {
  try {
    const out = execFileSync('lsof', ['-t', socketPath], {
      encoding: 'utf8',
      timeout: 1000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split(/\s+/)
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isInteger(n) && n > 0 && n !== process.pid);
  } catch {
    return [];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Stops other processes holding `socketPath` and unlinks the path so a new
 * daemon can bind. Never signals the current pid (test servers share the vitest process).
 */
async function replaceStaleListener(socketPath: string): Promise<void> {
  void appendDebugLog('daemon', 'replacing stale daemon', { socketPath });
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
  const child = spawn(qqBin, [qqScript, 'daemon', '--socket', socketPath], {
    detached: true,
    stdio: 'ignore',
  });

  child.unref();
}

/**
 * Ensures a qq daemon is running at `socketPath`.
 *
 * Algorithm:
 *   1. Try to connect. If it succeeds, ping. Keep listeners that ack fetch
 *      capability or do not reply (test sockets). Replace a live pong without
 *      `fetchCandidates` — those daemons swallow `fetch-candidates` and stall
 *      the client.
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
