import { describe, expect, it } from 'vitest';
import type { CommandCandidate } from '../src/contracts/candidates.js';
import {
  createCandidateScanner,
  MAX_STREAMED_CANDIDATES,
  parseStrictCandidateList,
} from '../src/providers/candidate-stream.js';

/** A recorded `claude -p` answer (Phase 09.1 probes), including the non-ASCII ⓘ. */
const RECORDED_ANSWER =
  '[{"command":"tldr z3","explanation":"Show concise usage examples"},' +
  '{"command":"z3 -h","explanation":"Print z3 options ⓘ"}]';

const RECORDED_CANDIDATES: CommandCandidate[] = [
  { command: 'tldr z3', explanation: 'Show concise usage examples' },
  { command: 'z3 -h', explanation: 'Print z3 options ⓘ' },
];

function scan(pieces: string[]): CommandCandidate[] {
  const seen: CommandCandidate[] = [];
  const feed = createCandidateScanner((candidate) => {
    seen.push(candidate);
  });
  for (const piece of pieces) {
    feed(piece);
  }
  return seen;
}

/** Every two-piece split of `text`, from index 1 to length - 1. */
function everySplit(text: string): Array<[number, string[]]> {
  const splits: Array<[number, string[]]> = [];
  for (let index = 1; index < text.length; index++) {
    splits.push([index, [text.slice(0, index), text.slice(index)]]);
  }
  return splits;
}

function candidateObjects(count: number): string {
  const objects = Array.from(
    { length: count },
    (_, index) => `{"command":"echo ${index}","explanation":"row ${index}"}`,
  );
  return `[${objects.join(',')}]`;
}

describe('createCandidateScanner', () => {
  it('emits the recorded candidates in order at every split point', () => {
    for (const [index, pieces] of everySplit(RECORDED_ANSWER)) {
      expect(scan(pieces), `split at ${index}`).toEqual(RECORDED_CANDIDATES);
    }
  });

  it('emits each candidate as soon as its object closes', () => {
    const seen: CommandCandidate[] = [];
    const feed = createCandidateScanner((candidate) => {
      seen.push(candidate);
    });
    const firstClose = RECORDED_ANSWER.indexOf('}') + 1;

    feed(RECORDED_ANSWER.slice(0, firstClose - 1));
    expect(seen).toHaveLength(0);
    feed(RECORDED_ANSWER.slice(firstClose - 1, firstClose));
    expect(seen).toEqual([RECORDED_CANDIDATES[0]]);
  });

  it('does not end an object early on braces, brackets, escaped quotes or backslashes in strings', () => {
    const tricky = String.raw`use {x} and [y] and \"q\" and \\`;
    const answer = `[{"command":"printf ok","explanation":"${tricky}"},{"command":"ls","explanation":"list"}]`;
    const expected: CommandCandidate[] = [
      { command: 'printf ok', explanation: 'use {x} and [y] and "q" and \\' },
      { command: 'ls', explanation: 'list' },
    ];

    expect(scan([answer])).toEqual(expected);
    for (const [index, pieces] of everySplit(answer)) {
      expect(scan(pieces), `split at ${index}`).toEqual(expected);
    }
  });

  it('ignores a leading json code fence', () => {
    expect(scan(['```json\n', RECORDED_ANSWER, '\n```'])).toEqual(RECORDED_CANDIDATES);
  });

  it('skips an object that fails the candidate schema and still emits the next one', () => {
    const answer =
      '[{"command":"","explanation":"empty"},{"command":"git status","explanation":"status"}]';

    expect(scan([answer])).toEqual([{ command: 'git status', explanation: 'status' }]);
  });

  it('ignores wrapper prose with a brace and a quote before the array, at every split point', () => {
    const noisy = `Sure: {"see" below}\n${RECORDED_ANSWER}`;

    for (const [index, pieces] of everySplit(noisy)) {
      expect(scan(pieces), `split at ${index}`).toEqual(RECORDED_CANDIDATES);
    }
  });

  it('emits at most MAX_STREAMED_CANDIDATES', () => {
    expect(MAX_STREAMED_CANDIDATES).toBe(5);
    const seen = scan([candidateObjects(7)]);

    expect(seen).toHaveLength(MAX_STREAMED_CANDIDATES);
    expect(seen.at(-1)).toEqual({ command: 'echo 4', explanation: 'row 4' });
  });
});

describe('parseStrictCandidateList', () => {
  it('returns a valid candidate array', () => {
    expect(parseStrictCandidateList(RECORDED_ANSWER)).toEqual(RECORDED_CANDIDATES);
  });

  it('returns the array inside a json code fence', () => {
    expect(parseStrictCandidateList(`\`\`\`json\n${RECORDED_ANSWER}\n\`\`\``)).toEqual(
      RECORDED_CANDIDATES,
    );
  });

  it('returns undefined for prose', () => {
    expect(parseStrictCandidateList('Run git status to see changes.')).toBeUndefined();
  });

  it('returns undefined for more than five candidates', () => {
    expect(parseStrictCandidateList(candidateObjects(6))).toBeUndefined();
  });

  it('returns undefined for an empty array', () => {
    expect(parseStrictCandidateList('[]')).toBeUndefined();
  });

  it('returns undefined for invalid JSON', () => {
    expect(parseStrictCandidateList('[{"command":"ls",')).toBeUndefined();
  });
});
