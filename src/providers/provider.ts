import type { CandidateList } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';

export interface LLMAdapter {
  fetchCandidates(envelope: ContextEnvelope): Promise<CandidateList>;
}
