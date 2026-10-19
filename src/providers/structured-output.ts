import type { CandidateList } from '../contracts/candidates.js';
import { appendDebugLog } from '../shared/debug-log.js';
import {
  finalCandidateListWithoutProse,
  SDK_MAX_TOKENS,
  strictCandidateListWithoutProse,
  TRUNCATED_RESPONSE_MESSAGE,
} from './claude.js';
import { isAbortError } from './provider.js';

/**
 * Output ceiling for the OpenAI request (`max_completion_tokens`, reasoning included): the
 * same value as the Claude SDK request (SDK_MAX_TOKENS), by construction rather than a
 * second literal. Ollama uses its own budget-sized OLLAMA_NUM_PREDICT (WR-15).
 */
export const MAX_OUTPUT_TOKENS = SDK_MAX_TOKENS;

/**
 * JSON Schema for the candidate list (src/contracts/candidates.ts): an array of 1-5
 * objects with exactly `command` (non-empty) and `explanation`. Hand-written, not generated
 * from zod, because the generated form adds a `$schema` key that a strict endpoint may
 * reject.
 */
export const CANDIDATE_LIST_JSON_SCHEMA = {
  type: 'array',
  minItems: 1,
  maxItems: 5,
  items: {
    type: 'object',
    properties: {
      command: { type: 'string', minLength: 1 },
      explanation: { type: 'string' },
    },
    required: ['command', 'explanation'],
    additionalProperties: false,
  },
} as const;

/** The candidate list under a `candidates` key: strict structured output needs an object root. */
export const WRAPPED_CANDIDATE_LIST_JSON_SCHEMA = {
  type: 'object',
  properties: {
    candidates: CANDIDATE_LIST_JSON_SCHEMA,
  },
  required: ['candidates'],
  additionalProperties: false,
} as const;

/** One model reply: its text and whether it ended with a normal stop. */
export interface ModelTurn {
  content: string;
  finishedNormally: boolean;
}

/** The candidate objects that closed in a cut-off turn, or none (never the raw text). */
function closedCandidates(content: string, logFields: Record<string, unknown>): CandidateList {
  try {
    return finalCandidateListWithoutProse(content, false, logFields);
  } catch (error) {
    if (error instanceof Error && error.message === TRUNCATED_RESPONSE_MESSAGE) {
      return [];
    }
    throw error;
  }
}

/**
 * The final list for a non-Claude adapter, with one silent retry for a cut-off reply.
 *
 * A turn that finished normally, or one whose text is already a complete candidate list
 * (bare or `{ candidates }`), is returned as finalCandidateListWithoutProse reads it.
 * Anything else was cut off: `retry` runs exactly once (the adapter re-sends on the same
 * signal, so the overall time budget does not grow) and its turn goes through the same
 * no-prose rule, so a cut-off fragment never becomes a command. When the retry fails for any
 * reason other than a user abort, the first turn's closed candidates are returned if it had
 * any; otherwise the retry's error (TRUNCATED_RESPONSE_MESSAGE for a second cut-off)
 * surfaces. A user abort always wins.
 *
 * `budget` is the adapter's shared timeout signal (the AbortSignal.timeout, not the user
 * signal). When it has fired by the time the retry fails and nothing closed, the error is
 * TRUNCATED_RESPONSE_MESSAGE (IN-17): the real problem is the cut-off first answer, not a
 * server that "did not answer". Any other retry error (a refusal, an HTTP status) keeps
 * its own copy.
 */
export async function candidatesWithCutOffRetry(
  first: ModelTurn,
  retry: () => Promise<ModelTurn>,
  logFields: Record<string, unknown> = {},
  budget?: AbortSignal,
): Promise<CandidateList> {
  if (first.finishedNormally) {
    return finalCandidateListWithoutProse(first.content, true, logFields);
  }
  const complete = strictCandidateListWithoutProse(first.content);
  if (complete) {
    return complete;
  }
  const closed = closedCandidates(first.content, logFields);
  void appendDebugLog('provider', 'response cut off, retrying once', logFields);
  try {
    const second = await retry();
    return finalCandidateListWithoutProse(second.content, second.finishedNormally, logFields);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (closed.length === 0) {
      if (budget?.aborted) {
        void appendDebugLog('provider', 'response truncated', logFields);
        throw new Error(TRUNCATED_RESPONSE_MESSAGE);
      }
      throw error;
    }
    return closed;
  }
}
