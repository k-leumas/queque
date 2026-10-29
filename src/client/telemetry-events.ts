import type {
  ClientTelemetryEvent,
  ErrorKind,
  ProviderKind,
  QueryOutcome,
} from '../contracts/telemetry.js';
import type { EnvironmentShape } from '../shared/environment-shape.js';

export const TELEMETRY_CLIENT_SEND_MS = 250;

export interface QueryOutcomeRecord {
  outcome: QueryOutcome;
  candidateCount: number;
  errorKind?: ErrorKind;
}

export interface ReportClientTelemetryInput {
  socketPath: string;
  record?: QueryOutcomeRecord;
  errors?: readonly ErrorKind[];
  env?: NodeJS.ProcessEnv;
  statePath?: string;
  provider?: () => ProviderKind;
  environment?: () => EnvironmentShape | null;
  send?: (socketPath: string, events: ClientTelemetryEvent[]) => Promise<void>;
}

export function buildQueryOutcomeEvent(
  _record: QueryOutcomeRecord,
  _provider: ProviderKind,
): ClientTelemetryEvent {
  throw new Error('buildQueryOutcomeEvent is not implemented yet');
}

export function buildErrorEvent(_kind: ErrorKind, _provider: ProviderKind): ClientTelemetryEvent {
  throw new Error('buildErrorEvent is not implemented yet');
}

export function buildEnvironmentEvent(_shape: EnvironmentShape): ClientTelemetryEvent {
  throw new Error('buildEnvironmentEvent is not implemented yet');
}

export function sendTelemetryEvents(
  _socketPath: string,
  _events: readonly ClientTelemetryEvent[],
  _timeoutMs: number = TELEMETRY_CLIENT_SEND_MS,
): Promise<void> {
  throw new Error('sendTelemetryEvents is not implemented yet');
}

export async function reportClientTelemetry(_input: ReportClientTelemetryInput): Promise<void> {
  throw new Error('reportClientTelemetry is not implemented yet');
}
