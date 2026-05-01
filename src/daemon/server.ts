import * as net from 'node:net';
import { ipcRequestSchema } from '../contracts/ipc.js';

/**
 * Starts the daemon Unix-socket server.
 *
 * Handles newline-delimited JSON IPC messages. Supported requests:
 *   {kind: 'ping'}           → {kind: 'pong'}
 *   {kind: 'ensure-session'} → {kind: 'session-ready', socketPath}
 *   {kind: 'run-query'}      → {kind: 'query-accepted', requestId}
 *
 * The server is intentionally free of Ink, React, and /dev/tty assumptions —
 * it runs fully in the background without a TTY.
 */
export function startDaemonServer(socketPath: string): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      let buf = '';

      socket.on('data', (chunk) => {
        buf += chunk.toString();
        let nl: number;

        while ((nl = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);

          if (!line) continue;

          let parsed: unknown;
          try {
            parsed = JSON.parse(line);
          } catch {
            // Ignore malformed messages — keep connection alive
            continue;
          }

          const result = ipcRequestSchema.safeParse(parsed);
          if (!result.success) {
            // Unknown message kind — ignore silently
            continue;
          }

          const req = result.data;

          switch (req.kind) {
            case 'ping': {
              socket.write(JSON.stringify({ kind: 'pong' }) + '\n');
              break;
            }
            case 'ensure-session': {
              socket.write(
                JSON.stringify({ kind: 'session-ready', socketPath }) + '\n',
              );
              break;
            }
            case 'run-query': {
              const requestId = Math.random().toString(36).slice(2);
              socket.write(
                JSON.stringify({ kind: 'query-accepted', requestId }) + '\n',
              );
              break;
            }
          }
        }
      });

      socket.on('error', () => {
        // Connection errors are per-socket, not fatal to the server
      });
    });

    server.on('error', reject);

    server.listen(socketPath, () => resolve(server));
  });
}
