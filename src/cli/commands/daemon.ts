import { ensureDaemon } from '../../daemon/bootstrap.js';
import { startDaemonServer } from '../../daemon/server.js';
import { appendDebugLog } from '../../shared/debug-log.js';
import { socketPath as defaultSocketPath } from '../../shared/socket-path.js';

export interface DaemonCommandOptions {
  socket?: string;
  ensure?: boolean;
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

  // Start the server and block indefinitely
  const server = await startDaemonServer(sock);
  void appendDebugLog('daemon', 'server started', { socket: sock });

  // Graceful shutdown on SIGTERM / SIGINT
  const shutdown = () => {
    void appendDebugLog('daemon', 'shutdown', { socket: sock });
    server.close(() => {
      process.exit(0);
    });
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  // Keep the process alive
  await new Promise<void>(() => {
    // Never resolves — daemon runs until signal
  });
}
