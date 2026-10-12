import * as net from 'node:net';
import { commandCandidateSchema } from '../contracts/candidates.js';
import { ipcRequestSchema } from '../contracts/ipc.js';
import { resolveClaudeDefaultAdapter } from '../providers/resolver.js';
import { bootstrapBuiltins } from '../registry/bootstrap.js';
import { appendDebugLog } from '../shared/debug-log.js';

/**
 * Starts the daemon Unix-socket server.
 *
 * Handles newline-delimited JSON IPC messages. Supported requests:
 *   {kind: 'ping'}              → {kind: 'pong', fetchCandidates: true, installedTools: true,
 *                                   streamCandidates: true}
 *   {kind: 'ensure-session'}    → {kind: 'session-ready', socketPath}
 *   {kind: 'run-query'}         → {kind: 'query-accepted', requestId}
 *   {kind: 'fetch-candidates'}  → {kind: 'fetch-accepted'}, then {kind: 'candidate'} × N when the
 *                                   request has `stream: true`, then {kind: 'candidates'} (the done
 *                                   signal and authoritative list) | {kind: 'fetch-error'};
 *                                   aborted when the client closes its socket
 *
 * The server is intentionally free of Ink, React, and /dev/tty assumptions —
 * it runs fully in the background without a TTY. LLM fetch lives here so the
 * Anthropic SDK client stays warm across `??` invocations.
 *
 * Each connection owns an AbortController. When the client closes its socket (Esc,
 * Enter, or exit) the provider call is aborted through that signal, and the daemon
 * writes nothing more for the aborted fetch.
 */
export function startDaemonServer(socketPath: string): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const MAX_BUF_BYTES = 256 * 1024;

    // TODO(CR-005): Add session token authentication before Phase 4 LLM integration.
    // Generate a random token in ensureDaemon, write it to a chmod-600 file in
    // /tmp/qq-<uid>/, and require clients to send it as the first IPC frame field.
    const server = net.createServer((socket) => {
      let buf = '';
      const connectionAbort = new AbortController();
      void appendDebugLog('daemon', 'socket connected', { socketPath });

      const writeJson = (payload: unknown) => {
        if (socket.destroyed) {
          return;
        }
        socket.write(`${JSON.stringify(payload)}\n`);
      };

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
            void appendDebugLog('daemon', 'ignored unknown request', { lineLength: line.length });
            continue;
          }

          const req = result.data;
          void appendDebugLog('daemon', 'request received', { kind: req.kind });

          switch (req.kind) {
            case 'ping': {
              writeJson({
                kind: 'pong',
                fetchCandidates: true,
                installedTools: true,
                streamCandidates: true,
              });
              void appendDebugLog('daemon', 'replied pong');
              break;
            }
            case 'ensure-session': {
              writeJson({ kind: 'session-ready', socketPath });
              void appendDebugLog('daemon', 'replied session-ready', { socketPath });
              break;
            }
            case 'run-query': {
              const requestId = Math.random().toString(36).slice(2);
              writeJson({ kind: 'query-accepted', requestId });
              void appendDebugLog('daemon', 'replied query-accepted', { requestId });
              break;
            }
            case 'fetch-candidates': {
              writeJson({ kind: 'fetch-accepted' });
              const envelope = req.envelope;
              // D-05: stream rows only to a client that asked; an older client would fail
              // its zod parse on the unknown `candidate` kind and re-query cold.
              let streamedIndex = 0;
              const onCandidate =
                req.stream === true
                  ? (candidate: unknown) => {
                      const index = streamedIndex++;
                      if (connectionAbort.signal.aborted) {
                        // D-14: the client left; nothing more is written for this fetch.
                        void appendDebugLog('daemon', 'candidate dropped', { index });
                        return;
                      }
                      const row = commandCandidateSchema.safeParse(candidate);
                      if (!row.success) {
                        return;
                      }
                      writeJson({ kind: 'candidate', candidate: row.data });
                      void appendDebugLog('daemon', 'replied candidate', { index });
                    }
                  : undefined;
              // Resolution throws stay inside the chain so they become fetch-error.
              void Promise.resolve()
                .then(() => {
                  bootstrapBuiltins();
                  const adapter = resolveClaudeDefaultAdapter();
                  return adapter.fetchCandidates(envelope, {
                    signal: connectionAbort.signal,
                    onCandidate,
                  });
                })
                .then((candidates) => {
                  if (connectionAbort.signal.aborted) {
                    void appendDebugLog('daemon', 'fetch aborted');
                    return;
                  }
                  writeJson({ kind: 'candidates', candidates });
                  void appendDebugLog('daemon', 'replied candidates', {
                    count: candidates.length,
                  });
                })
                .catch((error: unknown) => {
                  if (connectionAbort.signal.aborted) {
                    void appendDebugLog('daemon', 'fetch aborted');
                    return;
                  }
                  const message = error instanceof Error ? error.message : String(error);
                  writeJson({ kind: 'fetch-error', message });
                  void appendDebugLog('daemon', 'replied fetch-error', { message });
                });
              break;
            }
          }
        }
      });

      socket.on('error', () => {
        // Connection errors are per-socket, not fatal to the server
      });

      // D-13: the client closing its socket (Esc, Enter, exit) aborts the provider call.
      socket.on('close', () => {
        connectionAbort.abort();
      });
    });

    server.on('error', reject);

    server.listen(socketPath, () => {
      void appendDebugLog('daemon', 'listening', { socketPath });
      resolve(server);
    });
  });
}
