// RED stub (10-04 Task 3): public exports only, so the failing endpoint test typechecks.

export interface TelemetryEndpoint {
  host: string;
  key: string;
}

export function resolveTelemetryEndpoint(_env?: NodeJS.ProcessEnv): TelemetryEndpoint | null {
  throw new Error('telemetry-endpoint: not implemented (RED stub)');
}
