import type { TelemetryState } from '../shared/telemetry-config.js';
import type { TelemetryEndpoint } from '../shared/telemetry-endpoint.js';

// RED stub (plan 10-06 Task 1): public names only, so typecheck passes before GREEN.

export const TELEMETRY_FLUSH_INTERVAL_MS = 60_000;
export const TELEMETRY_FLUSH_THRESHOLD = 20;
export const TELEMETRY_BUFFER_CAP = 100;
export const TELEMETRY_SEND_TIMEOUT_MS = 3000;
export const TELEMETRY_SHUTDOWN_WAIT_MS = 1000;

export interface TelemetrySnapshot {
  pending: string | null;
  lastSent: string | null;
}

export interface TelemetryBuffer {
  enqueue(event: unknown): boolean;
  flush(): Promise<void>;
  snapshot(): TelemetrySnapshot;
  reset(): void;
  start(): void;
  stop(): void;
}

export interface TelemetryBufferDeps {
  fetchImpl?: typeof fetch;
  now?: () => number;
  readState?: () => TelemetryState;
  env?: () => NodeJS.ProcessEnv;
  endpoint?: (env: NodeJS.ProcessEnv) => TelemetryEndpoint | null;
  version?: string;
}

export async function sendBatch(
  _host: string,
  _body: string,
  _fetchImpl: typeof fetch = fetch,
): Promise<void> {
  throw new Error('not implemented');
}

export function createTelemetryBuffer(_deps: TelemetryBufferDeps = {}): TelemetryBuffer {
  throw new Error('not implemented');
}
