import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DisplayCandidate } from '../src/shared/tool-awareness.js';
import {
  estimateCandidateSelectLines,
  filterCandidates,
  missingToolsFooterText,
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

  it('keeps missingTools on matching candidates', () => {
    const flagged: DisplayCandidate[] = [
      { command: 'fd -e ts', explanation: 'find', missingTools: ['fd'] },
      { command: 'git diff', explanation: 'diff' },
    ];
    expect(filterCandidates(flagged, 'fd')).toEqual([
      { command: 'fd -e ts', explanation: 'find', missingTools: ['fd'] },
    ]);
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

describe('estimateCandidateSelectLines — missing-tool flag rows', () => {
  const base = {
    query: '',
    selectedIndex: 0,
    contentWidth: 75,
    includeDevFooter: false,
  };

  it('adds 2 rows (marginTop + footer line) when the selected candidate is flagged', () => {
    const plain = estimateCandidateSelectLines({
      ...base,
      candidates: [{ command: 'git status', explanation: 'show status' }],
    });
    const flagged = estimateCandidateSelectLines({
      ...base,
      candidates: [{ command: 'git status', explanation: 'show status', missingTools: ['git'] }],
    });
    expect(flagged).toBe(plain + 2);
  });

  it('adds 3 rows over the plain baseline when the selected candidate is destructive and flagged', () => {
    const plain = estimateCandidateSelectLines({
      ...base,
      candidates: [{ command: 'git status', explanation: 'show status' }],
    });
    const destructiveOnly = estimateCandidateSelectLines({
      ...base,
      candidates: [{ command: 'rm -rf /tmp/foo', explanation: 'remove files' }],
    });
    const both = estimateCandidateSelectLines({
      ...base,
      candidates: [
        { command: 'rm -rf /tmp/foo', explanation: 'remove files', missingTools: ['rm'] },
      ],
    });
    expect(both).toBe(plain + 3);
    expect(both).toBe(destructiveOnly + 1);
  });

  it('adds no footer rows for a flagged candidate that is not selected', () => {
    const unflagged = estimateCandidateSelectLines({
      ...base,
      candidates: [
        { command: 'ls', explanation: 'list' },
        { command: 'fd -e ts', explanation: 'find' },
      ],
    });
    const flaggedSecond = estimateCandidateSelectLines({
      ...base,
      candidates: [
        { command: 'ls', explanation: 'list' },
        { command: 'fd -e ts', explanation: 'find', missingTools: ['fd'] },
      ],
    });
    expect(flaggedSecond).toBe(unflagged);
  });

  it('adds 1 row when the mark no longer fits on the last command line', () => {
    const narrow = { ...base, contentWidth: 20 };
    const selected = { command: 'ls', explanation: 'list' };
    // 19 columns + ' ⊘' (2) = 21 > 20 → Ink wraps the command text → one extra row.
    const longLine = 'abcdefghij-klmnopqr';
    const withoutMark = estimateCandidateSelectLines({
      ...narrow,
      candidates: [selected, { command: longLine, explanation: 'x' }],
    });
    const withMark = estimateCandidateSelectLines({
      ...narrow,
      candidates: [selected, { command: longLine, explanation: 'x', missingTools: ['abc'] }],
    });
    expect(withMark).toBe(withoutMark + 1);
  });

  it('adds nothing when the last command line has room for the mark', () => {
    const narrow = { ...base, contentWidth: 20 };
    const selected = { command: 'ls', explanation: 'list' };
    // 18 columns + 2 = 20 → fits.
    const fitting = 'abcdefghij-klmnopq';
    const withoutMark = estimateCandidateSelectLines({
      ...narrow,
      candidates: [selected, { command: fitting, explanation: 'x' }],
    });
    const withMark = estimateCandidateSelectLines({
      ...narrow,
      candidates: [selected, { command: fitting, explanation: 'x', missingTools: ['abc'] }],
    });
    expect(withMark).toBe(withoutMark);
  });

  it('adds 1 row when both marks no longer fit (length + 4 > contentWidth)', () => {
    const narrow = { ...base, contentWidth: 20 };
    const selected = { command: 'ls', explanation: 'list' };
    // 17 columns: ' ⚠' alone fits (19), ' ⚠ ⊘' does not (21).
    const destructiveLine = 'rm -rf /tmp/foo12';
    const destructiveOnly = estimateCandidateSelectLines({
      ...narrow,
      candidates: [selected, { command: destructiveLine, explanation: 'x' }],
    });
    const both = estimateCandidateSelectLines({
      ...narrow,
      candidates: [selected, { command: destructiveLine, explanation: 'x', missingTools: ['rm'] }],
    });
    expect(both).toBe(destructiveOnly + 1);
  });

  it('counts the wrapped rows of a flag footer longer than contentWidth', () => {
    const narrow = { ...base, contentWidth: 20 };
    const missing = ['aaaaaaaa', 'bbbbbbbb', 'cccccccc'];
    const footerRows = wrapText(missingToolsFooterText(missing), 20).length;
    expect(footerRows).toBe(3);
    const plain = estimateCandidateSelectLines({
      ...narrow,
      candidates: [{ command: 'ls', explanation: 'list' }],
    });
    const flagged = estimateCandidateSelectLines({
      ...narrow,
      candidates: [{ command: 'ls', explanation: 'list', missingTools: missing }],
    });
    expect(flagged).toBe(plain + 1 + footerRows);
  });
});
