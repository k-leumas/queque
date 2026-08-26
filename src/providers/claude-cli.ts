import type { CandidateList } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import type { LLMAdapter } from './provider.js';

/**
 * Spawns `claude -p` and parses stdout as a candidate list. Throws on failure.
 * Unregistered — isolation and tests only.
 */
export async function fetchClaudeCliCandidates(
  _envelope: ContextEnvelope,
  _remainingMs: number,
): Promise<CandidateList> {
  throw new Error('fetchClaudeCliCandidates is not implemented');
}

export const claudeCliAdapter: LLMAdapter = {
  async fetchCandidates(envelope: ContextEnvelope): Promise<CandidateList> {
    return fetchClaudeCliCandidates(envelope, 25_000);
  },
};
