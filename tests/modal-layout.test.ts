import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  estimateCandidateSelectLines,
  filterCandidates,
  wrapText,
} from '../src/ui/modal-layout.js';

describe('wrapText', () => {
  it('wraps long text into multiple lines', () => {
    const lines = wrapText('alpha beta gamma delta epsilon zeta', 10);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(10);
    }
  });
});

describe('filterCandidates', () => {
  const candidates = [
    { command: 'git status', explanation: 'status' },
    { command: 'git diff', explanation: 'diff' },
  ];

  it('returns all candidates when query is empty', () => {
    expect(filterCandidates(candidates, '')).toHaveLength(2);
  });

  it('filters by command substring', () => {
    expect(filterCandidates(candidates, 'diff')).toHaveLength(1);
  });
});

describe('estimateCandidateSelectLines', () => {
  const base = {
    candidates: [{ command: 'git status', explanation: 'show status' }],
    query: '',
    selectedIndex: 0,
    contentWidth: 75,
    includeDevFooter: false,
  };

  it('counts loading state compactly', () => {
    const lines = estimateCandidateSelectLines({
      ...base,
      candidates: null,
    });
    expect(lines).toBe(5);
  });

  it('grows with additional candidates and wrapped lines', () => {
    const single = estimateCandidateSelectLines(base);
    const multi = estimateCandidateSelectLines({
      ...base,
      candidates: [
        { command: 'git status', explanation: 'show status' },
        { command: 'git diff', explanation: 'show diff' },
      ],
    });
    expect(multi).toBeGreaterThan(single);
  });

  it('adds lines for destructive warning on selected candidate', () => {
    const safe = estimateCandidateSelectLines(base);
    const destructive = estimateCandidateSelectLines({
      ...base,
      candidates: [{ command: 'rm -rf /tmp/foo', explanation: 'remove files' }],
    });
    expect(destructive).toBe(safe + 2);
  });

  it('includes query context header when initialQuery is set', () => {
    const without = estimateCandidateSelectLines(base);
    const withHeader = estimateCandidateSelectLines({
      ...base,
      initialQuery: 'list files',
    });
    expect(withHeader).toBe(without + 1);
  });
});
