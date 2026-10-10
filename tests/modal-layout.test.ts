import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DisplayCandidate } from '../src/shared/tool-awareness.js';
import {
  candidateKey,
  estimateCandidateSelectLines,
  explanationText,
  filterCandidates,
  missingToolsLegend,
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

  it('adds the legend (marginTop + one line) when any visible candidate is flagged', () => {
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

  it('adds the legend for a flagged candidate that is not selected', () => {
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
    expect(flaggedSecond).toBe(unflagged + 2);
  });

  it('keeps the height when the selection moves between flagged and unflagged rows', () => {
    const candidates = [
      { command: 'ls', explanation: 'list' },
      { command: 'fd -e ts', explanation: 'find', missingTools: ['fd'] },
    ];
    const onPlain = estimateCandidateSelectLines({ ...base, candidates, selectedIndex: 0 });
    const onFlagged = estimateCandidateSelectLines({ ...base, candidates, selectedIndex: 1 });
    expect(onFlagged).toBe(onPlain);
  });

  it('counts the destructive footer and the legend for a destructive flagged candidate', () => {
    const plain = estimateCandidateSelectLines({
      ...base,
      candidates: [{ command: 'git status', explanation: 'show status' }],
    });
    const both = estimateCandidateSelectLines({
      ...base,
      candidates: [
        { command: 'rm -rf /tmp/foo', explanation: 'remove files', missingTools: ['rm'] },
      ],
    });
    expect(both).toBe(plain + 4);
  });

  it('wraps the explanation with the mark in front of it', () => {
    const narrow = { ...base, contentWidth: 20 };
    // 'abcdefghij klmnopqr' (19) fits on one row; 'ⓘ abcdefghij klmnopqr' (21) does not.
    const explanation = 'abcdefghij klmnopqr';
    const plain = estimateCandidateSelectLines({
      ...narrow,
      candidates: [{ command: 'ls', explanation }],
    });
    const flagged = estimateCandidateSelectLines({
      ...narrow,
      candidates: [{ command: 'ls', explanation, missingTools: ['ls'] }],
    });
    const legendRows = 1 + wrapText('ⓘ not installed: ls', 20).length;
    expect(flagged).toBe(plain + 1 + legendRows);
  });

  it('adds no command-line overflow row for the mark (it sits in the explanation)', () => {
    const narrow = { ...base, contentWidth: 20 };
    const longLine = 'abcdefghij-klmnopqrs'; // exactly 20 columns
    const plain = estimateCandidateSelectLines({
      ...narrow,
      candidates: [{ command: longLine, explanation: 'x' }],
    });
    const flagged = estimateCandidateSelectLines({
      ...narrow,
      candidates: [{ command: longLine, explanation: 'x', missingTools: ['abc'] }],
    });
    const legendRows = 1 + wrapText('ⓘ not installed: abc', 20).length;
    expect(flagged).toBe(plain + legendRows);
  });

  it('adds 1 row when ⚠ no longer fits on the last command line', () => {
    const narrow = { ...base, contentWidth: 20 };
    const selected = { command: 'ls', explanation: 'list' };
    // 'rm -rf /tmp/foo1234' is 19 columns + ' ⚠' (2) = 21 > 20.
    const fits = estimateCandidateSelectLines({
      ...narrow,
      candidates: [selected, { command: 'rm -rf /tmp/foo123', explanation: 'x' }],
    });
    const overflows = estimateCandidateSelectLines({
      ...narrow,
      candidates: [selected, { command: 'rm -rf /tmp/foo1234', explanation: 'x' }],
    });
    expect(overflows).toBe(fits + 1);
  });

  it('counts the wrapped rows of a legend longer than contentWidth', () => {
    const narrow = { ...base, contentWidth: 20 };
    const missing = ['aaaaaaaa', 'bbbbbbbb', 'cccccccc'];
    const legendRows = wrapText(`ⓘ not installed: ${missing.join(', ')}`, 20).length;
    expect(legendRows).toBeGreaterThan(1);
    const plain = estimateCandidateSelectLines({
      ...narrow,
      candidates: [{ command: 'ls', explanation: '' }],
    });
    const flagged = estimateCandidateSelectLines({
      ...narrow,
      candidates: [{ command: 'ls', explanation: '', missingTools: missing }],
    });
    // The mark alone becomes the explanation row, then the legend.
    expect(flagged).toBe(plain + 1 + 1 + legendRows);
  });
});

describe('explanationText', () => {
  it('leaves an unflagged explanation unchanged', () => {
    expect(explanationText({ command: 'ls', explanation: 'list' })).toBe('list');
  });

  it('puts the mark in front of a flagged explanation', () => {
    expect(explanationText({ command: 'fd', explanation: 'find', missingTools: ['fd'] })).toBe(
      'ⓘ find',
    );
  });

  it('is the mark alone when a flagged candidate has no explanation', () => {
    expect(explanationText({ command: 'fd', explanation: '', missingTools: ['fd'] })).toBe('ⓘ');
  });
});

describe('missingToolsLegend', () => {
  it('is undefined when nothing is flagged', () => {
    expect(missingToolsLegend([{ command: 'ls', explanation: 'list' }])).toBeUndefined();
  });

  it('lists every missing tool once, in first-seen order', () => {
    expect(
      missingToolsLegend([
        { command: 'fd . | rg x', explanation: 'a', missingTools: ['fd', 'rg'] },
        { command: 'ls', explanation: 'b' },
        { command: 'rg y | dust', explanation: 'c', missingTools: ['rg', 'dust'] },
      ]),
    ).toBe('ⓘ not installed: fd, rg, dust');
  });

  it('says what Tab does when a visible flagged row has an install form', () => {
    expect(
      missingToolsLegend([
        {
          command: 'dust',
          explanation: 'sizes',
          missingTools: ['dust'],
          install: { form: 'brew install dust && dust', packages: ['dust'], blocked: null },
        },
      ]),
    ).toBe('ⓘ not installed: dust · tab prepends the install command');
  });

  it('leaves Tab out when no visible flagged row can be installed', () => {
    expect(
      missingToolsLegend([
        {
          command: 'dust',
          explanation: 'sizes',
          missingTools: ['dust'],
          install: { form: null, packages: [], blocked: 'no-package-manager' },
        },
      ]),
    ).toBe('ⓘ not installed: dust');
  });
});

describe('candidateKey', () => {
  it('is the trimmed command, ::, then the explanation', () => {
    expect(candidateKey({ command: '  fd -e ts ', explanation: 'find' })).toBe('fd -e ts::find');
  });
});

describe('estimateCandidateSelectLines — install toggle', () => {
  const base = {
    initialQuery: undefined,
    query: '',
    selectedIndex: 0,
    contentWidth: 20,
    includeDevFooter: false,
  };
  const selected = { command: 'ls', explanation: 'list' };

  function flaggedWithForm(form: string): DisplayCandidate {
    return {
      command: 'fd x',
      explanation: 'x',
      missingTools: ['fd'],
      install: { form, packages: ['fd'], blocked: null },
    };
  }

  it('counts the wrapped install-form lines of a toggled row', () => {
    // 'brew install fd && fd x' (23) wraps to 2 rows at 20; 'fd x' is 1 row.
    const candidate = flaggedWithForm('brew install fd && fd x');
    const untoggled = estimateCandidateSelectLines({ ...base, candidates: [selected, candidate] });
    const toggled = estimateCandidateSelectLines({
      ...base,
      candidates: [selected, candidate],
      installToggled: new Set([candidateKey(candidate)]),
    });
    expect(toggled).toBe(untoggled + 1);
  });

  it('counts the install form rows without a mark-overflow row (ⓘ sits in the explanation)', () => {
    // Rows: 'brew install fd &&' and 'fd abcdefghijklmnop' (19 fits in 20).
    const candidate = flaggedWithForm('brew install fd && fd abcdefghijklmnop');
    const untoggled = estimateCandidateSelectLines({ ...base, candidates: [selected, candidate] });
    const toggled = estimateCandidateSelectLines({
      ...base,
      candidates: [selected, candidate],
      installToggled: new Set([candidateKey(candidate)]),
    });
    expect(toggled).toBe(untoggled + 1);
  });

  it('runs the destructive check on a toggled sudo form (the ⚠ footer appears)', () => {
    const candidate: DisplayCandidate = {
      command: 'fdfind -e ts',
      explanation: 'find',
      missingTools: ['fdfind'],
      install: {
        form: 'sudo apt install fd-find && fdfind -e ts',
        packages: ['fd-find'],
        blocked: null,
      },
    };
    const wide = { ...base, contentWidth: 75 };
    const untoggled = estimateCandidateSelectLines({ ...wide, candidates: [candidate] });
    const toggled = estimateCandidateSelectLines({
      ...wide,
      candidates: [candidate],
      installToggled: new Set([candidateKey(candidate)]),
    });
    expect(toggled).toBe(untoggled + 2);
  });

  it('ignores a toggled key whose plan has no form', () => {
    const candidate: DisplayCandidate = {
      command: 'fd x',
      explanation: 'x',
      missingTools: ['fd'],
      install: { form: null, packages: [], blocked: 'no-package-manager' },
    };
    const untoggled = estimateCandidateSelectLines({ ...base, candidates: [selected, candidate] });
    const toggled = estimateCandidateSelectLines({
      ...base,
      candidates: [selected, candidate],
      installToggled: new Set(['fd x::x']),
    });
    expect(toggled).toBe(untoggled);
  });
});
