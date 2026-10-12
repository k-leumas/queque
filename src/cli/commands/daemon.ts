import { ensureDaemon } from '../../daemon/bootstrap.js';
import { startDaemonServer } from '../../daemon/server.js';
import { enablePrewarm, retirePrewarmed } from '../../providers/claude-prewarm.js';
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

  // Prewarm pool (D-11): daemon only, so the client's in-process fallback never leaves an
  // idle `claude` behind. Nothing is spawned now (the daemon knows no cwd or steered
  // prompt yet); the first `claude -p` query runs cold and refills the slot.
  enablePrewarm();

  // Graceful shutdown on SIGTERM / SIGINT
  const shutdown = () => {
    void appendDebugLog('daemon', 'shutdown', { socket: sock });
    // stdin EOF retires the idle child (SIGKILL backstop); if the daemon dies outright the
    // child gets the same EOF and exits by itself.
    retirePrewarmed();
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
