import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendDebugLog } from '../shared/debug-log.js';

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
 * Validates that `socketPath` is a safe daemon socket path.
 *
 * Rejects any path that does not resolve to /tmp/qq-*.sock to prevent
 * path-traversal attacks where a caller-controlled path could cause
 * fs.unlinkSync to delete arbitrary files or the daemon to listen on
 * an attacker-chosen location.
 */
function assertSafeSocketPath(socketPath: string): void {
  const resolved = path.resolve(socketPath);
  const base = path.basename(resolved);
  const tmpRoots = ['/tmp', '/private/tmp'];
  if (
    !tmpRoots.some((root) => resolved.startsWith(root + path.sep)) ||
    !base.startsWith('qq-') ||
    !base.endsWith('.sock')
  ) {
    throw new Error(`unsafe socket path rejected: ${socketPath}`);
  }
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
 * Throws if `socketPath` is not a safe /tmp/qq-*.sock path.
 */
export async function ensureDaemon(socketPath: string): Promise<void> {
  assertSafeSocketPath(socketPath);
  void appendDebugLog('daemon', 'ensure start', { socketPath });

  // Fast path: daemon is already running
  if (await tryConnect(socketPath)) {
    void appendDebugLog('daemon', 'already running', { socketPath });
    return;
  }

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

  // Resolve the current bundled CLI entrypoint.
  // In the built runtime, import.meta.url points at dist/cli/main.js, which is
  // the exact script we want the detached daemon process to execute.
  const qqBin = process.execPath; // Node executable
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

  // Detach so the foreground client can exit without killing the daemon
  child.unref();

  const started = await waitForSocket(socketPath);
  if (!started) {
    void appendDebugLog('daemon', 'startup timeout', { socketPath });
    throw new Error(`qq daemon did not start within the expected window (${socketPath})`);
  }

  void appendDebugLog('daemon', 'daemon ready', { socketPath });
}
