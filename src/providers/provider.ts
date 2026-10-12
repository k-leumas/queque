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

/** True for QueQue's own abort error and the Anthropic SDK's `APIUserAbortError`. */
export function isAbortError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') {
    return false;
  }
  const name = (error as { name?: unknown }).name;
  return name === 'AbortError' || name === 'APIUserAbortError';
}
