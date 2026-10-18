import type * as net from 'node:net';
import { ensureDaemon } from '../../daemon/bootstrap.js';
import { startDaemonServer } from '../../daemon/server.js';
import { disablePrewarm, enablePrewarm } from '../../providers/claude-prewarm.js';
import { SIGKILL_GRACE_MS } from '../../providers/claude-process.js';
import { appendDebugLog } from '../../shared/debug-log.js';
import { socketPath as defaultSocketPath } from '../../shared/socket-path.js';

export interface DaemonCommandOptions {
  socket?: string;
  ensure?: boolean;
}

/** Records every open connection of `server`, so shutdown can end the in-flight ones. */
export function trackConnections(server: net.Server): Set<net.Socket> {
  const connections = new Set<net.Socket>();
  server.on('connection', (socket: net.Socket) => {
    connections.add(socket);
    socket.once('close', () => {
      connections.delete(socket);
    });
  });
  return connections;
}

export interface DaemonShutdownOptions {
  /** Called once the server has closed and in-flight children had their kill grace. */
  exit?: () => void;
  /** How long to stay alive after ending in-flight connections (SIGTERM → SIGKILL grace). */
  graceMs?: number;
}

/**
 * Stops the daemon without leaving `claude` children behind (review WR-03).
 *
 * 1. disablePrewarm() retires the idle child (stdin EOF, SIGKILL backstop) AND turns the
 *    pool off, so an in-flight query's `finally { schedulePrewarm() }` cannot spawn a new
 *    idle child after this point.
 * 2. Every open connection is destroyed. Its `close` aborts the per-connection signal, so
 *    runClaudeTurn SIGTERMs its child (and the SDK request is aborted) while the daemon is
 *    still alive. server.close() alone would wait for those connections instead.
 * 3. After the server closed, the process stays up for `graceMs` when connections were
 *    ended, so terminateChild's unref'd SIGKILL backstop can still fire, then exits.
 */
export function shutdownDaemon(
  server: net.Server,
  connections: Set<net.Socket>,
  options: DaemonShutdownOptions = {},
): void {
  const exit = options.exit ?? (() => process.exit(0));
  const graceMs = options.graceMs ?? SIGKILL_GRACE_MS + 100;
  disablePrewarm();
  const inFlight = connections.size;
  server.close(() => {
    if (inFlight === 0) {
      exit();
      return;
    }
    setTimeout(exit, graceMs);
  });
  for (const socket of connections) {
    socket.destroy();
  }
}

/**
 * Real daemon command handler.
 *
 * `qq daemon --socket <path>` — starts the daemon server and blocks.
 * `qq daemon --socket <path> --ensure` — ensures a daemon is running, then exits.
 *
 * Free of Ink, React, and /dev/tty assumptions.
 */
export async function daemonCommand(options: DaemonCommandOptions): Promise<void> {
  const sock = options.socket ?? defaultSocketPath();
  void appendDebugLog('daemon', 'command start', { socket: sock, ensure: options.ensure });

  if (options.ensure) {
    await ensureDaemon(sock);
    void appendDebugLog('daemon', 'ensure command complete', { socket: sock });
    return;
  }

  // Start the server and block indefinitely. A `shutdown` IPC request (restartDaemon,
  // WR-07) runs the same shutdown as SIGTERM; it is wired once `shutdown` exists below.
  let onShutdownRequest = (): void => undefined;
  const server = await startDaemonServer(sock, { onShutdown: () => onShutdownRequest() });
  const connections = trackConnections(server);
  void appendDebugLog('daemon', 'server started', { socket: sock });

  // Prewarm pool (D-11): daemon only, so the client's in-process fallback never leaves an
  // idle `claude` behind. Nothing is spawned now (the daemon knows no cwd or steered
  // prompt yet); the first `claude -p` query runs cold and refills the slot.
  enablePrewarm();

  // Graceful shutdown on SIGTERM / SIGINT
  const shutdown = () => {
    void appendDebugLog('daemon', 'shutdown', { socket: sock, inFlight: connections.size });
    // If the daemon dies outright instead, an idle child gets stdin EOF and exits by itself.
    shutdownDaemon(server, connections);
  };

  onShutdownRequest = shutdown;
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  // Keep the process alive
  await new Promise<void>(() => {
    // Never resolves — daemon runs until signal
  });
}
