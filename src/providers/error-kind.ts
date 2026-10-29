import { ERROR_KINDS, type ErrorKind } from '../contracts/telemetry.js';
import { TRUNCATED_RESPONSE_MESSAGE } from './claude.js';
import { UNPARSEABLE_RESPONSE_MESSAGE } from './provider.js';

/**
 * Error kinds for telemetry (phase 10, D-10).
 *
 * Errors are classified where the error object exists (provider mapping, pin resolution),
 * never from user-visible copy in the client. `withErrorKind` tags an Error in place; the
 * daemon sends `errorKindOf(error)` as `fetch-error.errorKind`, and the client re-tags the
 * Error it rejects with, so the daemon and the in-process fallback look the same.
 */

const KINDS: ReadonlySet<string> = new Set(ERROR_KINDS);

/** Sets `errorKind` on `error` and returns the same object (its message is untouched). */
export function withErrorKind<T extends Error>(error: T, kind: ErrorKind): T {
  Object.defineProperty(error, 'errorKind', {
    value: kind,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return error;
}

/**
 * The kind of an error: a valid `errorKind` tag first, then the two shared response
 * constants (thrown by every provider for a cut-off or unparseable answer), else `unknown`.
 */
export function errorKindOf(error: unknown): ErrorKind {
  if (!(error instanceof Error)) {
    return 'unknown';
  }
  const tag = (error as { errorKind?: unknown }).errorKind;
  if (typeof tag === 'string' && KINDS.has(tag)) {
    return tag as ErrorKind;
  }
  if (error.message === TRUNCATED_RESPONSE_MESSAGE) {
    return 'response_truncated';
  }
  if (error.message === UNPARSEABLE_RESPONSE_MESSAGE) {
    return 'parse_failed';
  }
  return 'unknown';
}
