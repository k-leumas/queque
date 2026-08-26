import type { CandidateList } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import type { LLMAdapter } from './provider.js';

/** Minimum remaining budget required to start an SDK rescue after CLI failure. */
export const MIN_SDK_RESCUE_MS = 1000;

/**
 * Returns milliseconds left before `deadline`, floored at zero.
 */
export function remainingMs(deadline: number): number {
  return Math.max(0, deadline - Date.now());
}

export const claudeDefaultAdapter: LLMAdapter = {
  async fetchCandidates(_envelope: ContextEnvelope): Promise<CandidateList> {
    throw new Error('claudeDefaultAdapter is not implemented');
  },
};
