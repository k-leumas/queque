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

/**
 * Characters that can make candidate text act on, or look different on, the terminal:
 * control bytes (C0, DEL, C1) other than tab and newline, and format characters (`\p{Cf}`:
 * bidi overrides such as U+202E, the U+2066..U+2069 isolates, zero-width characters and
 * the BOM), which can make a command read differently from what will run (IN-12).
 */
const UNSAFE_TEXT_CHARS = /[^\P{Cc}\t\n]|\p{Cf}/gu;

/**
 * Characters that must never reach a one-line terminal string (an error line or a printed
 * setting): every control byte (C0 including tab and newline, DEL, C1) and every format
 * character (`\p{Cf}`, such as the U+202E bidi override), which can reorder what the
 * terminal shows (IN-15). Not global, so `.test()` keeps no state.
 */
export const UNSAFE_LINE_CHARS = /[\p{Cc}\p{Cf}]/u;

const UNSAFE_LINE_CHARS_GLOBAL = new RegExp(UNSAFE_LINE_CHARS.source, 'gu');

/** `text` with every UNSAFE_LINE_CHARS character replaced by a space (IN-15). */
export function replaceUnsafeLineChars(text: string): string {
  return text.replace(UNSAFE_LINE_CHARS_GLOBAL, ' ');
}

/**
 * One candidate without UNSAFE_TEXT_CHARS (WR-04, IN-12), or null when its command is empty
 * afterwards. Tab and newline are kept; the command is trimmed.
 */
export function sanitizeCandidate(candidate: CommandCandidate): CommandCandidate | null {
  const command = candidate.command.replace(UNSAFE_TEXT_CHARS, '').trim();
  if (command.length === 0) {
    return null;
  }
  return { command, explanation: candidate.explanation.replace(UNSAFE_TEXT_CHARS, '') };
}

/** The candidates that survive sanitizeCandidate, in order. */
export function sanitizeCandidates(candidates: readonly CommandCandidate[]): CommandCandidate[] {
  return candidates.flatMap((candidate) => {
    const clean = sanitizeCandidate(candidate);
    return clean ? [clean] : [];
  });
}

/**
 * Removes terminal control bytes (ESC, BEL, CR, C1 ...) and format characters (bidi,
 * zero-width) from candidate text, keeping tab and newline (WR-04, IN-12). Used by the
 * non-Claude adapters, whose text may come from a remote server over plain http: an ESC in
 * a candidate would reach the terminal through Ink as an escape sequence (OSC 52 clipboard
 * writes, title or screen rewrites). A candidate whose command is empty afterwards is
 * dropped. With none left it throws UNPARSEABLE_RESPONSE_MESSAGE (IN-13), which the
 * adapters map to their own "unexpected response" copy, so an unusable answer never shows
 * as a selectable placeholder row.
 */
export function stripTerminalControls(candidates: CandidateList): CandidateList {
  const cleaned = sanitizeCandidates(candidates);
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
