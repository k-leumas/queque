import * as net from 'node:net';
import * as fs from 'node:fs';
import { spawn } from 'node:child_process';

const CONNECT_TIMEOUT_MS = 500;
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
 * Ensures a qq daemon is running at `socketPath`.
 *
 * Algorithm:
 *   1. Try to connect. If it succeeds, return immediately.
 *   2. If the socket file exists but the connect failed, unlink it (stale socket).
 *   3. Spawn `qq daemon --socket <path>` as a detached, unreferenced child.
 *   4. Poll until the new daemon starts listening, then return.
 *
 * Throws if the daemon does not start within the poll window.
 */
export async function ensureDaemon(socketPath: string): Promise<void> {
  // Fast path: daemon is already running
  if (await tryConnect(socketPath)) return;

  // Unlink stale socket file if present
  try {
    fs.unlinkSync(socketPath);
  } catch {
    // File may not exist — that is fine
  }

  // Resolve the qq binary: prefer the built dist, fall back to ts-node for dev
  const qqBin = process.execPath; // Node executable
  const qqScript = new URL('../../cli/main.js', import.meta.url).pathname;

  const child = spawn(qqBin, [qqScript, 'daemon', '--socket', socketPath], {
    detached: true,
    stdio: 'ignore',
  });

  // Detach so the foreground client can exit without killing the daemon
  child.unref();

  const started = await waitForSocket(socketPath);
  if (!started) {
    throw new Error(
      `qq daemon did not start within the expected window (${socketPath})`,
    );
  }
}
