import type { CandidateList, CommandCandidate } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';

/**
 * Per-call options shared by every adapter (Phase 09.1).
 *
 * `signal` aborts the provider call (Esc, Enter, or the client closing its socket).
 * `onCandidate` receives candidates as they stream in; adapters that never stream do not
 * call it.
 */
export interface FetchOptions {
  signal?: AbortSignal;
  onCandidate?: (candidate: CommandCandidate) => void;
}

export interface LLMAdapter {
  fetchCandidates(envelope: ContextEnvelope, options?: FetchOptions): Promise<CandidateList>;
}

/** The error every QueQue layer rejects with when a fetch is aborted. */
export function abortError(): Error {
  const error = new Error('QueQue: request aborted');
  error.name = 'AbortError';
  return error;
}

/**
 * True only for `end_turn` and `stop_sequence`: the two stop reasons after which a
 * provider's final text is a whole answer (review WR-01-r2, threat T-09.1-14).
 *
 * Every other value means the text may be a fragment and must never reach
 * parseCandidates' prose fallback: `max_tokens`, `refusal`, `pause_turn`, `tool_use`,
 * `model_context_window_exceeded`, null, or a value a later SDK adds. The check is an
 * allow list of the good values, so a stop reason added later fails closed.
 */
export function isNormalStopReason(stopReason: string | null | undefined): boolean {
  return stopReason === 'end_turn' || stopReason === 'stop_sequence';
}

/** True for QueQue's own abort error and the Anthropic SDK's `APIUserAbortError`. */
export function isAbortError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') {
    return false;
  }
  const name = (error as { name?: unknown }).name;
  return name === 'AbortError' || name === 'APIUserAbortError';
}
