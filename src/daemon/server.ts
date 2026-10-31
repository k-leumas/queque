import * as net from 'node:net';
import { commandCandidateSchema } from '../contracts/candidates.js';
import { ipcRequestSchema } from '../contracts/ipc.js';
import type { ErrorKind } from '../contracts/telemetry.js';
import { errorKindOf } from '../providers/error-kind.js';
import { resolveProviderAdapter } from '../providers/provider-pin.js';
import { bootstrapBuiltins } from '../registry/bootstrap.js';
import { appendDebugLog } from '../shared/debug-log.js';
import type { TelemetryBuffer } from './telemetry-buffer.js';

/**
 * Starts the daemon Unix-socket server.
 *
 * Handles newline-delimited JSON IPC messages. Supported requests:
 *   {kind: 'ping'}              → {kind: 'pong', fetchCandidates: true, installedTools: true,
 *                                   streamCandidates: true, providerPin: true} plus the
 *                                   `telemetry` flag (informational) and `build`, this daemon's
 *                                   __QUEQUE_BUILD_ID__ (a client from another build replaces it)
 *   {kind: 'ensure-session'}    → {kind: 'session-ready', socketPath}
 *   {kind: 'run-query'}         → {kind: 'query-accepted', requestId}
 *   {kind: 'fetch-candidates'}  → {kind: 'fetch-accepted'}, then {kind: 'candidate'} × N when the
 *                                   request has `stream: true`, then {kind: 'candidates'} (the done
 *                                   signal and authoritative list) | {kind: 'fetch-error'};
 *                                   aborted when the client closes its socket
 *   {kind: 'shutdown'}          → {kind: 'shutdown-accepted'}, then `onShutdown()` (WR-07); ignored
 *                                   when no `onShutdown` was given. Shutting down ends in-flight
 *                                   fetches of other terminals (their `??` shows the error copy)
 *   {kind: 'telemetry-event'}   → no reply (fire-and-forget); the event goes to the telemetry
 *                                   buffer, which gates and re-validates it (phase 10, D-07)
 *   {kind: 'telemetry-show'}    → {kind: 'telemetry-buffer', pending, lastSent} (D-12); both
 *                                   null when no buffer was given
 *   {kind: 'telemetry-reset'}   → the buffer is cleared, then the same `telemetry-buffer` reply
 *
 * The server is intentionally free of Ink, React, and /dev/tty assumptions —
 * it runs fully in the background without a TTY. LLM fetch lives here so the
 * Anthropic SDK client stays warm across `??` invocations.
 *
 * Each connection owns an AbortController. When the client closes its socket (Esc,
 * Enter, or exit) the provider call is aborted through that signal, and the daemon
 * writes nothing more for the aborted fetch.
 */
export interface DaemonServerOptions {
  /** Runs after a `shutdown` request was acknowledged (the daemon command's shutdown). */
  onShutdown?: () => void;
  /** The daemon's telemetry buffer (phase 10, D-07). */
  telemetry?: TelemetryBuffer;
}

export function startDaemonServer(
  socketPath: string,
  options: DaemonServerOptions = {},
): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const MAX_BUF_BYTES = 256 * 1024;

    // TODO(CR-005): Add session token authentication before Phase 4 LLM integration.
    // Generate a random token in ensureDaemon, write it to a chmod-600 file in
    // /tmp/qq-<uid>/, and require clients to send it as the first IPC frame field.
    const server = net.createServer((socket) => {
      let buf = '';
      const connectionAbort = new AbortController();
      // A UTF-8 StringDecoder keeps a multi-byte character intact when it is split across
      // socket reads. A Unix-socket write over ~8 KB arrives in several chunks on macOS.
      socket.setEncoding('utf8');
      void appendDebugLog('daemon', 'socket connected', { socketPath });

      const writeJson = (payload: unknown) => {
        if (socket.destroyed) {
          return;
        }
        socket.write(`${JSON.stringify(payload)}\n`);
      };

      socket.on('data', (chunk: string) => {
        // Compare bytes with bytes: `buf.length` counts UTF-16 code units, not bytes.
        if (Buffer.byteLength(buf) + Buffer.byteLength(chunk) > MAX_BUF_BYTES) {
          socket.destroy(new Error('IPC message too large'));
          return;
        }
        buf += chunk;
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
                providerPin: true,
                telemetry: true,
                build: __QUEQUE_BUILD_ID__,
              });
              void appendDebugLog('daemon', 'replied pong');
              break;
            }
            case 'telemetry-event': {
              // Fire-and-forget: the client has already ended its socket. The buffer logs
              // counts and reasons only, never the event.
              options.telemetry?.enqueue(req.event);
              break;
            }
            case 'telemetry-show':
            case 'telemetry-reset': {
              const { telemetry } = options;
              if (req.kind === 'telemetry-reset') {
                telemetry?.reset();
              }
              const snapshot = telemetry?.snapshot() ?? { pending: null, lastSent: null };
              writeJson({ kind: 'telemetry-buffer', ...snapshot });
              void appendDebugLog('daemon', 'replied telemetry-buffer', {
                pending: snapshot.pending !== null,
                lastSent: snapshot.lastSent !== null,
              });
              break;
            }
            case 'shutdown': {
              const { onShutdown } = options;
              if (!onShutdown) {
                void appendDebugLog('daemon', 'ignored shutdown request');
                break;
              }
              void appendDebugLog('daemon', 'shutdown requested');
              // Shut down only after the ack is flushed: shutdown destroys this socket too.
              socket.write(`${JSON.stringify({ kind: 'shutdown-accepted' })}\n`, () => {
                onShutdown();
              });
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
              // Resolution throws (an invalid provider pin) stay inside the chain so they
              // become fetch-error. The pin is re-read on every fetch (D-15).
              // `resolved` tells a resolution failure (an invalid pin) from a provider failure,
              // whose kind comes from the error object (D-10), never from its message.
              let resolved = false;
              void Promise.resolve()
                .then(() => {
                  bootstrapBuiltins();
                  const adapter = resolveProviderAdapter();
                  resolved = true;
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
                  const errorKind: ErrorKind = resolved ? errorKindOf(error) : 'pin_invalid';
                  writeJson({ kind: 'fetch-error', message, errorKind });
                  void appendDebugLog('daemon', 'replied fetch-error', { message, errorKind });
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
