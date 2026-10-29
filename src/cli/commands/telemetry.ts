import type { IpcRequest, IpcResponse } from '../../contracts/ipc.js';
import type { TelemetryEndpoint } from '../../shared/telemetry-endpoint.js';

// RED stub (plan 10-09 Task 1): public names only, behaviour lands in GREEN.

export interface TelemetryCliDeps {
  env: NodeJS.ProcessEnv;
  configPath?: string;
  socketPath: string;
  endpoint(): TelemetryEndpoint | null;
  requestDaemon(request: IpcRequest): Promise<IpcResponse | null>;
  out(text: string): void;
  err(text: string): void;
}

export const DAEMON_REQUEST_TIMEOUT_MS = 500;

export function requestDaemonOnce(
  _socketPath: string,
  _request: IpcRequest,
  _timeoutMs: number = DAEMON_REQUEST_TIMEOUT_MS,
): Promise<IpcResponse | null> {
  return Promise.resolve(null);
}

export function defaultTelemetryCliDeps(): TelemetryCliDeps {
  throw new Error('not implemented');
}

export async function telemetryCommand(
  _action: string | undefined,
  _deps?: TelemetryCliDeps,
): Promise<void> {
  // not implemented
}
