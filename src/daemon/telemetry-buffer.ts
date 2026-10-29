import {
  type ClientTelemetryEvent,
  clientTelemetryEventSchema,
  TELEMETRY_BATCH_MAX,
  TELEMETRY_LIB,
  type TelemetryWireEvent,
  telemetryBatchSchema,
  telemetryWireEventSchema,
} from '../contracts/telemetry.js';
import { appendDebugLog } from '../shared/debug-log.js';
import {
  readTelemetryState,
  type TelemetryState,
  telemetryBlockedBy,
} from '../shared/telemetry-config.js';
import { resolveTelemetryEndpoint, type TelemetryEndpoint } from '../shared/telemetry-endpoint.js';

/**
 * The daemon's anonymous telemetry buffer (phase 10, D-07, D-10, D-12, D-22).
 *
 * - Memory only: no disk queue, no retry, no SDK. A batch whose send fails is dropped.
 * - Gate: no env kill switch in the daemon's env, consent enabled with an install id, and a
 *   usable endpoint (a build without a key resolves to null, so nothing is ever buffered).
 *   The gate is checked at enqueue and again at flush, reading the state fresh each time,
 *   so `qq telemetry off` stops sending without a daemon restart.
 * - Every client event is re-validated with the strict schema, wrapped with the five fixed
 *   properties and a timestamp, and validated again as a wire event; the whole batch is
 *   validated before it leaves the machine.
 * - `snapshot().pending` and `flush()` use the same serializer, so `qq telemetry show`
 *   prints byte for byte what the next flush would send; `lastSent` is the last body sent.
 * - Debug lines carry counts and reasons only, never a payload, the install id or the key.
 */

export const TELEMETRY_FLUSH_INTERVAL_MS = 60_000;
export const TELEMETRY_FLUSH_THRESHOLD = 20;
export const TELEMETRY_BUFFER_CAP = TELEMETRY_BATCH_MAX;
export const TELEMETRY_SEND_TIMEOUT_MS = 3000;
/** Longest a shutdown waits for the final flush before the daemon exits. */
export const TELEMETRY_SHUTDOWN_WAIT_MS = 1000;

export interface TelemetrySnapshot {
  pending: string | null;
  lastSent: string | null;
}

export interface TelemetryBuffer {
  /** Buffers a client event; false when gated off, invalid, a repeated environment or full. */
  enqueue(event: unknown): boolean;
  /** Sends everything buffered as one batch; resolves after the send settled or was dropped. */
  flush(): Promise<void>;
  snapshot(): TelemetrySnapshot;
  /** Drops the buffer and `lastSent` (`qq telemetry off`). */
  reset(): void;
  /** Starts the unref'd flush interval. */
  start(): void;
  stop(): void;
}

export interface TelemetryBufferDeps {
  fetchImpl?: typeof fetch;
  /** Epoch milliseconds for the event timestamp. */
  now?: () => number;
  readState?: () => TelemetryState;
  env?: () => NodeJS.ProcessEnv;
  endpoint?: (env: NodeJS.ProcessEnv) => TelemetryEndpoint | null;
  /** `$lib_version`. */
  version?: string;
}

/**
 * POSTs one serialized batch to `host + /batch/` (D-07). Every failure (network, timeout,
 * a non-2xx status) is swallowed: the batch is dropped, never retried, never persisted.
 */
export async function sendBatch(
  host: string,
  body: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  // Join by string: `new URL('/batch/', base)` would drop a path prefix on the host.
  const url = `${host.replace(/\/+$/, '')}/batch/`;
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(TELEMETRY_SEND_TIMEOUT_MS),
    });
    void appendDebugLog('daemon', 'telemetry sent', { status: response.status });
  } catch (error) {
    const reason = error instanceof Error ? error.name : 'unknown';
    void appendDebugLog('daemon', 'telemetry send failed', { reason });
  }
}

type GateClosedReason = 'DO_NOT_TRACK' | 'QQ_TELEMETRY' | 'CI' | 'disabled' | 'no-endpoint';

type Gate =
  | { open: true; installId: string; endpoint: TelemetryEndpoint }
  | { open: false; reason: GateClosedReason };

/** A key-sorted JSON string, so two equal payloads compare equal whatever their key order. */
function stableJson(value: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = value[key];
  }
  return JSON.stringify(sorted);
}

export function createTelemetryBuffer(deps: TelemetryBufferDeps = {}): TelemetryBuffer {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  const readState = deps.readState ?? (() => readTelemetryState());
  const env = deps.env ?? (() => process.env);
  const endpointFor = deps.endpoint ?? resolveTelemetryEndpoint;
  const version = deps.version ?? __QUEQUE_VERSION__;

  let events: TelemetryWireEvent[] = [];
  let lastSent: string | null = null;
  /** Install id + payload of the last buffered environment event (D-10 dedupe). */
  let lastEnvironment: string | null = null;
  /** The send in flight: one POST at a time, so a slow network cannot pile up requests. */
  let inFlight: Promise<void> | null = null;
  let timer: NodeJS.Timeout | null = null;

  const gate = (): Gate => {
    const currentEnv = env();
    const blocked = telemetryBlockedBy(currentEnv);
    if (blocked) {
      return { open: false, reason: blocked };
    }
    const state = readState();
    if (!state.enabled || !state.installId) {
      return { open: false, reason: 'disabled' };
    }
    const endpoint = endpointFor(currentEnv);
    if (!endpoint) {
      return { open: false, reason: 'no-endpoint' };
    }
    return { open: true, installId: state.installId, endpoint };
  };

  /** The events the current install may send: never one recorded under an earlier id. */
  const sendable = (installId: string): TelemetryWireEvent[] =>
    events.filter((event) => event.properties.distinct_id === installId);

  const serialize = (key: string, batch: TelemetryWireEvent[]): string =>
    JSON.stringify({ api_key: key, batch });

  const wrap = (event: ClientTelemetryEvent, installId: string): unknown => ({
    event: event.event,
    timestamp: new Date(now()).toISOString(),
    properties: {
      distinct_id: installId,
      $process_person_profile: false,
      $geoip_disable: true,
      $lib: TELEMETRY_LIB,
      $lib_version: version,
      ...event.properties,
    },
  });

  const flushNow = async (): Promise<void> => {
    while (inFlight) {
      await inFlight;
    }
    if (events.length === 0) {
      return;
    }
    const current = gate();
    if (!current.open) {
      void appendDebugLog('daemon', 'telemetry dropped', {
        reason: current.reason,
        count: events.length,
      });
      events = [];
      return;
    }
    const batch = sendable(current.installId);
    const stale = events.length - batch.length;
    events = [];
    if (stale > 0) {
      void appendDebugLog('daemon', 'telemetry dropped', {
        reason: 'install-changed',
        count: stale,
      });
    }
    if (batch.length === 0) {
      return;
    }
    const body = serialize(current.endpoint.key, batch);
    if (!telemetryBatchSchema.safeParse(JSON.parse(body)).success) {
      void appendDebugLog('daemon', 'telemetry dropped', {
        reason: 'invalid-batch',
        count: batch.length,
      });
      return;
    }
    lastSent = body;
    void appendDebugLog('daemon', 'telemetry flushed', { count: batch.length });
    const send = sendBatch(current.endpoint.host, body, fetchImpl);
    inFlight = send;
    try {
      await send;
    } finally {
      inFlight = null;
    }
    if (events.length >= TELEMETRY_FLUSH_THRESHOLD) {
      void flushNow();
    }
  };

  const enqueue = (input: unknown): boolean => {
    const current = gate();
    if (!current.open) {
      void appendDebugLog('daemon', 'telemetry dropped', { reason: current.reason, count: 1 });
      return false;
    }
    const parsed = clientTelemetryEventSchema.safeParse(input);
    if (!parsed.success) {
      void appendDebugLog('daemon', 'telemetry dropped', { reason: 'invalid-event', count: 1 });
      return false;
    }
    const event = parsed.data;
    let environmentKey: string | null = null;
    if (event.event === 'qq_environment') {
      environmentKey = `${current.installId}:${stableJson(event.properties)}`;
      if (environmentKey === lastEnvironment) {
        return false;
      }
    }
    const wire = telemetryWireEventSchema.safeParse(wrap(event, current.installId));
    if (!wire.success) {
      void appendDebugLog('daemon', 'telemetry dropped', { reason: 'invalid-wire', count: 1 });
      return false;
    }
    if (events.length >= TELEMETRY_BUFFER_CAP) {
      void appendDebugLog('daemon', 'telemetry dropped', { reason: 'buffer-full', count: 1 });
      return false;
    }
    events.push(wire.data);
    if (environmentKey !== null) {
      lastEnvironment = environmentKey;
    }
    void appendDebugLog('daemon', 'telemetry buffered', { count: events.length });
    if (events.length >= TELEMETRY_FLUSH_THRESHOLD && !inFlight) {
      void flushNow();
    }
    return true;
  };

  const snapshot = (): TelemetrySnapshot => {
    const current = gate();
    if (!current.open) {
      return { pending: null, lastSent };
    }
    const batch = sendable(current.installId);
    return {
      pending: batch.length === 0 ? null : serialize(current.endpoint.key, batch),
      lastSent,
    };
  };

  return {
    enqueue,
    flush: flushNow,
    snapshot,
    reset: () => {
      events = [];
      lastSent = null;
      lastEnvironment = null;
      void appendDebugLog('daemon', 'telemetry reset');
    },
    start: () => {
      if (timer) {
        return;
      }
      timer = setInterval(() => {
        void flushNow();
      }, TELEMETRY_FLUSH_INTERVAL_MS);
      timer.unref();
    },
    stop: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
