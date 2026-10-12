import type { CandidateList, CommandCandidate } from '../contracts/candidates.js';

/** At most this many candidates are streamed per turn (candidateListSchema max). */
export const MAX_STREAMED_CANDIDATES = 5;

/** RED stub (09.1-02 Task 2): implemented in GREEN. */
export function createCandidateScanner(
  _onCandidate: (candidate: CommandCandidate) => void,
): (text: string) => void {
  throw new Error('createCandidateScanner: not implemented');
}

/** RED stub (09.1-02 Task 2): implemented in GREEN. */
export function parseStrictCandidateList(_text: string): CandidateList | undefined {
  throw new Error('parseStrictCandidateList: not implemented');
}
