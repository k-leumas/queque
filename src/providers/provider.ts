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

/**
 * Thrown by finalCandidateListWithoutProse and stripTerminalControls when no candidate can
 * be read from the text. Defined here (not in claude.ts) so stripTerminalControls can
 * throw it without an import cycle; claude.ts re-exports it.
 */
export const UNPARSEABLE_RESPONSE_MESSAGE = 'QueQue: response held no command candidates';

/** Terminal control bytes (C0, DEL, C1) other than tab and newline. */
const UNSAFE_CONTROL_BYTES = /[^\P{Cc}\t\n]/gu;

/**
 * Removes terminal control bytes (ESC, BEL, CR, C1 ...) from candidate text, keeping tab
 * and newline (WR-04). Used by the non-Claude adapters, whose text may come from a remote
 * server over plain http: an ESC in a candidate would reach the terminal through Ink as an
 * escape sequence (OSC 52 clipboard writes, title or screen rewrites). A candidate whose
 * command is empty afterwards is dropped. With none left it throws
 * UNPARSEABLE_RESPONSE_MESSAGE (IN-13), which the adapters map to their own "unexpected
 * response" copy, so an unusable answer never shows as a selectable placeholder row.
 */
export function stripTerminalControls(candidates: CandidateList): CandidateList {
  const cleaned = candidates
    .map((candidate) => ({
      command: candidate.command.replace(UNSAFE_CONTROL_BYTES, '').trim(),
      explanation: candidate.explanation.replace(UNSAFE_CONTROL_BYTES, ''),
    }))
    .filter((candidate) => candidate.command.length > 0);
  if (cleaned.length === 0) {
    throw new Error(UNPARSEABLE_RESPONSE_MESSAGE);
  }
  return cleaned;
}

/** True for QueQue's own abort error and the Anthropic SDK's `APIUserAbortError`. */
export function isAbortError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') {
    return false;
  }
  const name = (error as { name?: unknown }).name;
  return name === 'AbortError' || name === 'APIUserAbortError';
}
