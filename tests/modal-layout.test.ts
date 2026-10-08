import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DisplayCandidate } from '../src/shared/tool-awareness.js';
import {
  candidateKey,
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
    const footerRows = wrapText(
      missingToolsFooterText({ command: 'ls', explanation: 'list', missingTools: missing }, false),
      20,
    ).length;
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

describe('candidateKey', () => {
  it('is the trimmed command, ::, then the explanation', () => {
    expect(candidateKey({ command: '  fd -e ts ', explanation: 'find' })).toBe('fd -e ts::find');
  });
});

describe('missingToolsFooterText — install states (D-11, D-14)', () => {
  const flagged: DisplayCandidate = {
    command: 'fd . | rg x',
    explanation: 'find',
    missingTools: ['fd', 'rg'],
    install: {
      form: 'brew install fd ripgrep && fd . | rg x',
      packages: ['fd', 'ripgrep'],
      blocked: null,
    },
  };

  it('lists the missing tools while the original command is shown', () => {
    expect(missingToolsFooterText(flagged, false)).toBe('⊘ not installed: fd, rg');
  });

  it('lists the packages while the install form is shown', () => {
    expect(missingToolsFooterText(flagged, true)).toBe('⊘ will install: fd, ripgrep');
  });

  it('explains a missing package manager', () => {
    expect(
      missingToolsFooterText(
        { ...flagged, install: { form: null, packages: [], blocked: 'no-package-manager' } },
        false,
      ),
    ).toBe('⊘ not installed: fd, rg — no package manager found');
  });

  it('explains an unsafe word or an unwrappable command', () => {
    for (const blocked of ['unsafe-package-name', 'unwrappable-command'] as const) {
      expect(
        missingToolsFooterText(
          { ...flagged, install: { form: null, packages: [], blocked } },
          false,
        ),
      ).toBe('⊘ not installed: fd, rg — no safe install command');
    }
  });

  it('keeps the plain copy for a candidate with no install plan', () => {
    expect(
      missingToolsFooterText({ command: 'fd', explanation: '', missingTools: ['fd'] }, false),
    ).toBe('⊘ not installed: fd');
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

  it('counts the mark-overflow row of the displayed install form', () => {
    // Rows: 'brew install fd &&' and 'fd abcdefghijklmnop' (19 + ' ⊘' = 21 > 20 → one more row).
    const candidate = flaggedWithForm('brew install fd && fd abcdefghijklmnop');
    const untoggled = estimateCandidateSelectLines({ ...base, candidates: [selected, candidate] });
    const toggled = estimateCandidateSelectLines({
      ...base,
      candidates: [selected, candidate],
      installToggled: new Set([candidateKey(candidate)]),
    });
    expect(toggled).toBe(untoggled + 2);
  });

  it('runs the destructive check on a toggled sudo form (footer gains the ⚠ line)', () => {
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
    expect(toggled).toBe(untoggled + 1);
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
