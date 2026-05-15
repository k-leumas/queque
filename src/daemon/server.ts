import * as net from 'node:net';
import { ipcRequestSchema } from '../contracts/ipc.js';
import { appendDebugLog } from '../shared/debug-log.js';

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
    const MAX_BUF_BYTES = 64 * 1024; // 64 KB — generous for any realistic IPC message

    const server = net.createServer((socket) => {
      let buf = '';
      void appendDebugLog('daemon', 'socket connected', { socketPath });

      socket.on('data', (chunk) => {
        if (buf.length + chunk.length > MAX_BUF_BYTES) {
          socket.destroy(new Error('IPC message too large'));
          return;
        }
        buf += chunk.toString();
        let nl = buf.indexOf('\n');

        while (nl !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          nl = buf.indexOf('\n');

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
            void appendDebugLog('daemon', 'ignored unknown request', { line });
            continue;
          }

          const req = result.data;
          void appendDebugLog('daemon', 'request received', req);

          switch (req.kind) {
            case 'ping': {
              socket.write(`${JSON.stringify({ kind: 'pong' })}\n`);
              void appendDebugLog('daemon', 'replied pong');
              break;
            }
            case 'ensure-session': {
              socket.write(`${JSON.stringify({ kind: 'session-ready', socketPath })}\n`);
              void appendDebugLog('daemon', 'replied session-ready', { socketPath });
              break;
            }
            case 'run-query': {
              const requestId = Math.random().toString(36).slice(2);
              socket.write(`${JSON.stringify({ kind: 'query-accepted', requestId })}\n`);
              void appendDebugLog('daemon', 'replied query-accepted', { requestId });
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

    server.listen(socketPath, () => {
      void appendDebugLog('daemon', 'listening', { socketPath });
      resolve(server);
    });
  });
}
