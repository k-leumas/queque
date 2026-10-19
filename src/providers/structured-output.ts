import type { CandidateList } from '../contracts/candidates.js';
import { SDK_MAX_TOKENS } from './claude.js';

/**
 * Output ceiling for the Ollama and OpenAI requests: the same value as the Claude SDK
 * request (SDK_MAX_TOKENS), by construction rather than a second literal.
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

export async function candidatesWithCutOffRetry(
  _first: ModelTurn,
  _retry: () => Promise<ModelTurn>,
  _logFields: Record<string, unknown> = {},
): Promise<CandidateList> {
  throw new Error('not implemented');
}
