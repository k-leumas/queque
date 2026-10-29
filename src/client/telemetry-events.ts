import * as net from 'node:net';
import {
  type ClientTelemetryEvent,
  clientTelemetryEventSchema,
  type ErrorKind,
  type ProviderKind,
  type QueryOutcome,
} from '../contracts/telemetry.js';
import { resolveProviderKind } from '../providers/provider-kind.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { collectEnvironmentShape, type EnvironmentShape } from '../shared/environment-shape.js';
import { effectiveTelemetry } from '../shared/telemetry-config.js';

/**
 * The client half of anonymous telemetry (phase 10, D-09, D-10, D-11).
 *
 * Only the client knows Enter versus Esc and how many rows were on screen, so it builds
 * every event. Builders take enums and counts only (never a buffer, cwd, command or error
 * message) and each event is validated with the strict client schema. Error kinds come
 * from `errorKindOf` on the error object, never from message text. No timing is measured.
 *
 * `reportClientTelemetry` runs after the shell result is written and Ink has unmounted. It
 * checks `effectiveTelemetry()` in this process's own environment first (the daemon's env
 * was frozen at spawn, so a later `export DO_NOT_TRACK=1` must stop it here), then sends
 * one `telemetry-event` line per event to the daemon without awaiting a reply. It never
 * throws and gives up after TELEMETRY_CLIENT_SEND_MS.
 */

/** Longest the client waits for the daemon socket before it drops the events. */
export const TELEMETRY_CLIENT_SEND_MS = 250;

/** Upper bound of `candidate_count`: the candidate list holds at most 5 rows. */
const CANDIDATE_COUNT_MAX = 5;

export interface QueryOutcomeRecord {
  outcome: QueryOutcome;
  /** Rows on screen when the query ended. */
  candidateCount: number;
  /** Only read for an `error` outcome. */
  errorKind?: ErrorKind;
}

export interface ReportClientTelemetryInput {
  socketPath: string;
  /** Undefined when the query ended without an outcome (for example a signal). */
  record?: QueryOutcomeRecord;
  /** Failures that did not end the query, in the order they happened. */
  errors?: readonly ErrorKind[];
  env?: NodeJS.ProcessEnv;
  /** The config file holding the consent state (default ~/.config/qq/config.json). */
  statePath?: string;
  provider?: () => ProviderKind;
  environment?: () => EnvironmentShape | null;
  send?: (socketPath: string, events: ClientTelemetryEvent[]) => Promise<void>;
}

function clampCount(count: number): number {
  if (!Number.isFinite(count)) {
    return 0;
  }
  return Math.min(CANDIDATE_COUNT_MAX, Math.max(0, Math.trunc(count)));
}

export function buildQueryOutcomeEvent(
  record: QueryOutcomeRecord,
  provider: ProviderKind,
): ClientTelemetryEvent {
  return clientTelemetryEventSchema.parse({
    event: 'qq_query_outcome',
    properties: {
      outcome: record.outcome,
      candidate_count: clampCount(record.candidateCount),
      provider,
      ...(record.outcome === 'error' ? { error_kind: record.errorKind ?? 'unknown' } : {}),
    },
  });
}

export function buildErrorEvent(kind: ErrorKind, provider: ProviderKind): ClientTelemetryEvent {
  return clientTelemetryEventSchema.parse({
    event: 'qq_error',
    properties: { error_kind: kind, provider },
  });
}

export function buildEnvironmentEvent(shape: EnvironmentShape): ClientTelemetryEvent {
  return clientTelemetryEventSchema.parse({ event: 'qq_environment', properties: shape });
}

/**
 * Writes one `{kind:'telemetry-event', event}` line per event and ends the socket. Resolves
 * when the socket closes, on any error, or after `timeoutMs` (the socket is destroyed then).
 * Never rejects: a missing or slow daemon only loses the events.
 */
export function sendTelemetryEvents(
  socketPath: string,
  events: readonly ClientTelemetryEvent[],
  timeoutMs: number = TELEMETRY_CLIENT_SEND_MS,
): Promise<void> {
  return new Promise((resolve) => {
    if (events.length === 0) {
      resolve();
      return;
    }
    let socket: net.Socket | undefined;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket?.destroy();
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    try {
      socket = net.createConnection(socketPath);
    } catch {
      finish();
      return;
    }
    socket.on('error', finish);
    socket.on('close', finish);
    socket.once('connect', () => {
      const lines = events
        .map((event) => `${JSON.stringify({ kind: 'telemetry-event', event })}\n`)
        .join('');
      socket?.end(lines);
    });
  });
}

/**
 * Reports one `??`: the environment shape, any non-terminal error kinds, then the outcome.
 * Returns at once, before any build or socket, unless telemetry is effectively on in this
 * process's environment and config. Never throws.
 */
export async function reportClientTelemetry(input: ReportClientTelemetryInput): Promise<void> {
  try {
    if (!effectiveTelemetry(input.env, input.statePath).on) {
      return;
    }
    const provider = input.provider ? input.provider() : resolveProviderKind();
    const shape = input.environment
      ? input.environment()
      : collectEnvironmentShape({ env: input.env });
    const errors = input.errors ?? [];

    const events: ClientTelemetryEvent[] = [];
    if (shape) {
      events.push(buildEnvironmentEvent(shape));
    }
    for (const kind of errors) {
      events.push(buildErrorEvent(kind, provider));
    }
    if (input.record) {
      events.push(buildQueryOutcomeEvent(input.record, provider));
    }
    if (events.length === 0) {
      return;
    }
    await (input.send ?? sendTelemetryEvents)(input.socketPath, events);
    void appendDebugLog('client', 'telemetry reported', {
      events: events.length,
      errors: errors.length,
      outcome: input.record !== undefined,
    });
  } catch {
    // Telemetry must never change or delay the `??` result beyond its cap.
  }
}
