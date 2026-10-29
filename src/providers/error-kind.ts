import type { ErrorKind } from '../contracts/telemetry.js';

// RED stub (plan 10-06 Task 3): public names only, so typecheck passes before GREEN.

export function withErrorKind<T extends Error>(error: T, _kind: ErrorKind): T {
  return error;
}

export function errorKindOf(_error: unknown): ErrorKind {
  throw new Error('not implemented');
}
