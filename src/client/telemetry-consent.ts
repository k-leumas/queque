import type { QueryOutcome } from '../contracts/telemetry.js';
import type { TelemetryBlockReason, TelemetryState } from '../shared/telemetry-config.js';

/** The one-line consent question (D-09). Default No: only `y` or `Y` opts in. */
export const CONSENT_PROMPT =
  'QueQue: send anonymous usage and error counts (no commands, prompts or paths)? [y/N] ';

/** Silence for this long counts as no. */
export const CONSENT_TIMEOUT_MS = 30_000;

export interface ShouldAskTelemetryConsentInput {
  outcome: QueryOutcome | undefined;
  state: TelemetryState;
  blockedBy: TelemetryBlockReason | null;
  hasTty: boolean;
}

type DataListener = (chunk: Buffer | string) => void;

/** The minimal tty read surface the prompt needs (a tty.ReadStream satisfies it). */
export interface ConsentInput {
  setRawMode(mode: boolean): unknown;
  resume(): unknown;
  pause(): unknown;
  once(event: 'data', listener: DataListener): unknown;
  off(event: 'data', listener: DataListener): unknown;
}

export interface ConsentOutput {
  write(text: string): unknown;
  columns?: number;
}

export interface ConsentIo {
  input: ConsentInput;
  output: ConsentOutput;
}

export function shouldAskTelemetryConsent(_input: ShouldAskTelemetryConsentInput): boolean {
  throw new Error('shouldAskTelemetryConsent: not implemented');
}

export function askTelemetryConsent(
  _io: ConsentIo,
  _timeoutMs: number = CONSENT_TIMEOUT_MS,
): Promise<boolean> {
  throw new Error('askTelemetryConsent: not implemented');
}
