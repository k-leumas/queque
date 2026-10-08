import * as net from 'node:net';
import type { CandidateList } from '../contracts/candidates.js';
import { ipcResponseSchema } from '../contracts/ipc.js';
import type { ContextEnvelope } from '../contracts/request.js';
import { resolveClaudeDefaultAdapter } from '../providers/resolver.js';
import { appendDebugLog } from '../shared/debug-log.js';

/** How long to wait for `{kind:'fetch-accepted'}` before treating the daemon as stale. */
export const FETCH_ACK_MS = 800;
const FETCH_TIMEOUT_MS = 26_000;

/**
 * Connection or protocol failure talking to the daemon — not an LLM error.
 *
 * The foreground client falls back to an in-process adapter on this class so
 * tests and a missing daemon still return candidates.
 */
export class IpcTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IpcTransportError';
  }
}

/**
 * Asks the warm daemon to run `fetchCandidates` and return the candidate list.
 *
 * New daemons ack immediately with `{kind:'fetch-accepted'}`. A listener that
 * swallows unknown IPC kinds (pre-fetch daemons) produces no ack; we fail in
 * `FETCH_ACK_MS` instead of waiting the full LLM timeout.
 */
export function requestDaemonFetch(
  socketPath: string,
  envelope: ContextEnvelope,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<CandidateList> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath);
    let buf = '';
    let settled = false;
    let accepted = false;

    const finish = (error?: unknown, candidates?: CandidateList) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(ackTimer);
      clearTimeout(timer);
      client.destroy();
      if (error) {
        reject(error);
        return;
      }
      resolve(candidates as CandidateList);
    };

    const ackTimer = setTimeout(() => {
      if (!accepted) {
        finish(new IpcTransportError('daemon fetch not accepted'));
      }
    }, FETCH_ACK_MS);

    const timer = setTimeout(() => {
      finish(new IpcTransportError('daemon fetch timed out'));
    }, timeoutMs);

    const handleResponse = (parsed: unknown) => {
      const response = ipcResponseSchema.safeParse(parsed);
      if (!response.success) {
        finish(new IpcTransportError('unexpected daemon fetch response'));
        return;
      }
      if (response.data.kind === 'fetch-accepted') {
        accepted = true;
        clearTimeout(ackTimer);
        return;
      }
      if (response.data.kind === 'candidates') {
        accepted = true;
        finish(undefined, response.data.candidates);
        return;
      }
      if (response.data.kind === 'fetch-error') {
        accepted = true;
        finish(new Error(response.data.message));
        return;
      }
      finish(new IpcTransportError('unexpected daemon fetch response'));
    };

    client.on('connect', () => {
      client.write(`${JSON.stringify({ kind: 'fetch-candidates', envelope })}\n`);
    });

    client.on('data', (chunk) => {
      buf += chunk.toString();
      let nl = buf.indexOf('\n');
      while (nl !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        nl = buf.indexOf('\n');
        if (!line) {
          continue;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          finish(new IpcTransportError('malformed daemon fetch response'));
          return;
        }
        handleResponse(parsed);
        if (settled) {
          return;
        }
      }
    });

    client.on('error', (error) => {
      finish(new IpcTransportError(error.message));
    });
  });
}

/**
 * Fetches candidates from the daemon when it is reachable; otherwise uses the
 * in-process Claude adapter (cold SDK in this process).
 */
export async function fetchCandidatesForUi(
  socketPath: string,
  envelope: ContextEnvelope,
): Promise<CandidateList> {
  try {
    const candidates = await requestDaemonFetch(socketPath, envelope);
    void appendDebugLog('client', 'candidates from daemon', { count: candidates.length });
    return candidates;
  } catch (error) {
    if (!(error instanceof IpcTransportError)) {
      throw error;
    }
    void appendDebugLog('client', 'daemon fetch fallback', { message: error.message });
    return resolveClaudeDefaultAdapter().fetchCandidates(envelope);
  }
}
