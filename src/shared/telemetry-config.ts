// RED stub (10-04 Task 2): public exports only, so the failing consent-state test
// typechecks. Every function throws until the GREEN commit replaces this file.

export const TELEMETRY_BLOCK_REASONS: readonly string[] = [];

export type TelemetryBlockReason = 'DO_NOT_TRACK' | 'QQ_TELEMETRY' | 'CI';

export interface TelemetryState {
  enabled: boolean;
  asked: boolean;
  installId?: string;
}

export type EffectiveTelemetry =
  | { on: true; installId: string }
  | { on: false; reason: TelemetryBlockReason | 'disabled' };

export class TelemetryConfigWriteError extends Error {}

const NOT_IMPLEMENTED = 'telemetry-config: not implemented (RED stub)';

export function telemetryBlockedBy(_env?: NodeJS.ProcessEnv): TelemetryBlockReason | null {
  throw new Error(NOT_IMPLEMENTED);
}

export function readTelemetryState(_path?: string): TelemetryState {
  throw new Error(NOT_IMPLEMENTED);
}

export function setTelemetryEnabled(_enabled: boolean, _path?: string): TelemetryState {
  throw new Error(NOT_IMPLEMENTED);
}

export function markTelemetryAsked(_answer: boolean, _path?: string): TelemetryState {
  throw new Error(NOT_IMPLEMENTED);
}

export function effectiveTelemetry(_env?: NodeJS.ProcessEnv, _path?: string): EffectiveTelemetry {
  throw new Error(NOT_IMPLEMENTED);
}
