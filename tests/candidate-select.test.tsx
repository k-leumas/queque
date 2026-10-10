/**
 * tests/candidate-select.test.tsx
 *
 * Wave 2 tests for CandidateSelect — nullable candidates, live search,
 * LoadingSpinner/SearchInput/ControlsLine composition, error state.
 *
 * Hook execution strategy: React hooks are mocked so the component function
 * can be called directly (outside a React render tree) to exercise the
 * useInput handler without a real renderer.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Capture useInput handler so tests can simulate key presses without a TTY
// ---------------------------------------------------------------------------
let capturedInputHandler: ((input: string, key: Record<string, boolean>) => void) | undefined;

vi.mock('ink', () => ({
  Box: ({ children }: { children?: unknown }) => children,
  Text: ({ children }: { children?: unknown }) => children,
  useInput: vi
    .fn()
    .mockImplementation((handler: (input: string, key: Record<string, boolean>) => void) => {
      capturedInputHandler = handler;
    }),
  useStdin: vi.fn().mockReturnValue({ isRawModeSupported: true }),
  useStdout: vi.fn().mockReturnValue({ stdout: { columns: 80 } }),
  useApp: vi.fn().mockReturnValue({ exit: vi.fn() }),
  render: vi.fn().mockReturnValue({ unmount: vi.fn(), rerender: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Mock sub-components so they don't cause issues when called outside React tree
// ---------------------------------------------------------------------------
vi.mock('../src/ui/Modal.js', () => ({
  Modal: ({ children }: { children?: unknown }) => children,
}));

vi.mock('../src/ui/SearchInput.js', () => ({
  SearchInput: () => null,
}));

vi.mock('../src/ui/ControlsLine.js', () => ({
  ControlsLine: () => null,
}));

vi.mock('../src/ui/LoadingSpinner.js', () => ({
  LoadingSpinner: () => null,
}));

// ---------------------------------------------------------------------------
// Mock react hooks so the component can be called as a plain function
// ---------------------------------------------------------------------------
let stateValues: unknown[] = [];
let stateSetters: Array<(v: unknown) => void> = [];
let stateCallCount = 0;

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: vi.fn().mockImplementation((initial: unknown) => {
      const index = stateCallCount++;
      if (stateValues[index] === undefined) {
        stateValues[index] = initial;
      }
      const setter = vi.fn().mockImplementation((next: unknown) => {
        stateValues[index] =
          typeof next === 'function' ? (next as (v: unknown) => unknown)(stateValues[index]) : next;
      });
      stateSetters[index] = setter;
      return [stateValues[index], setter];
    }),
    useEffect: vi.fn(),
    createElement: actual.createElement,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const zeroKeys = {
  upArrow: false,
  downArrow: false,
  escape: false,
  return: false,
  backspace: false,
  ctrl: false,
  meta: false,
  shift: false,
  tab: false,
  delete: false,
  pageDown: false,
  pageUp: false,
  home: false,
  end: false,
};

function resetState() {
  capturedInputHandler = undefined;
  stateValues = [];
  stateSetters = [];
  stateCallCount = 0;
  vi.clearAllMocks();
}

// ---------------------------------------------------------------------------
// CandidateSelect tests — targeting Wave 2 behavior
// ---------------------------------------------------------------------------

describe('CandidateSelect — loading state', () => {
  beforeEach(resetState);

  it('renders spinner placeholder when candidates is null', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    expect(() => {
      CandidateSelect({ candidates: null, onSelect, onCancel });
    }).not.toThrow();
  });
});

describe('CandidateSelect — filterCandidates logic', () => {
  beforeEach(resetState);

  // Wave 2: adds live search with initialQuery pre-filtering
  it('only selects matching candidates when query is provided', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    // Call the component function directly — hooks are mocked so this works
    // State slot 0 = selectedIndex (0), State slot 1 = query ('git')
    CandidateSelect({
      candidates: [
        { command: 'git status', explanation: '' },
        { command: 'ls -la', explanation: '' },
      ],
      onSelect,
      onCancel,
      initialQuery: 'git',
    });

    // Simulate Enter key — should accept 'git status' (only match for 'git' filter)
    capturedInputHandler?.('', { ...zeroKeys, return: true });

    expect(onSelect).toHaveBeenCalledWith('git status', 'see man git');
  });
});

describe('CandidateSelect — keyboard navigation', () => {
  beforeEach(resetState);

  // Wave 2: renders the component properly so useInput is wired
  it('calls onCancel when Escape is pressed', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    CandidateSelect({
      candidates: [
        { command: 'git status', explanation: '' },
        { command: 'ls -la', explanation: '' },
      ],
      onSelect,
      onCancel,
    });

    // Simulate Escape key — should call onCancel
    capturedInputHandler?.('', { ...zeroKeys, escape: true });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('CandidateSelect — D-01 pre-filter', () => {
  beforeEach(resetState);

  // Wave 2: adds initialQuery prop; pre-filters by lbuffer text (D-01)
  it('pre-populates query from initialQuery prop and accepts only matching candidate', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    CandidateSelect({
      candidates: [
        { command: 'git status', explanation: '' },
        { command: 'ls -la', explanation: '' },
      ],
      onSelect,
      onCancel,
      initialQuery: 'git',
    });

    // Press Enter — should accept 'git status' (the only candidate after filter)
    capturedInputHandler?.('', { ...zeroKeys, return: true });

    expect(onSelect).toHaveBeenCalledWith('git status', 'see man git');
    expect(onSelect).not.toHaveBeenCalledWith('ls -la');
  });
});

// ---------------------------------------------------------------------------
// New test cases for Wave 1 (Phase 04) — added by Plan 04-01
// ---------------------------------------------------------------------------

describe('CandidateSelect — selectedIndex reset on query change', () => {
  beforeEach(resetState);

  it('registers a useEffect hook for query dependency', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const { useEffect } = await import('react');
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    CandidateSelect({
      candidates: [
        { command: 'git status', explanation: '' },
        { command: 'ls -la', explanation: '' },
      ],
      onSelect,
      onCancel,
    });
    // useEffect must be called twice: once for useEffect([candidates]) and
    // once for useEffect([query]) — the latter added by Plan 04-02.
    // +1 for the isRawModeSupported cancel guard added in the prod-tui-crash fix.
    expect(useEffect).toHaveBeenCalledTimes(4);
  });
});

describe('CandidateSelect — zero-match after filter', () => {
  beforeEach(resetState);

  // Regression guard: Return key is a no-op when no candidates match the query.
  // This should be GREEN already (guard is present in CandidateSelect.tsx).
  it('does not call onSelect when no candidates match the query', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    // initialQuery='zzz' matches neither 'git status' nor 'ls -la'
    CandidateSelect({
      candidates: [
        { command: 'git status', explanation: '' },
        { command: 'ls -la', explanation: '' },
      ],
      onSelect,
      onCancel,
      initialQuery: 'zzz',
    });

    // Press Return — zero-match guard prevents onSelect from being called
    capturedInputHandler?.('', { ...zeroKeys, return: true });

    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('CandidateSelect — onSelect receives explanation', () => {
  beforeEach(resetState);

  // The shell context line feature requires the explanation to flow through
  // onSelect so run-foreground.ts can include it in the FIFO result.
  it('calls onSelect with command and explanation when Enter is pressed', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    CandidateSelect({
      candidates: [
        { command: 'git status', explanation: 'show working tree status' },
        { command: 'ls -la', explanation: 'list directory contents' },
      ],
      onSelect,
      onCancel,
    });
    capturedInputHandler?.('\r', { ...zeroKeys, return: true });
    expect(onSelect).toHaveBeenCalledWith('git status', 'show working tree status');
  });

  it('falls back to "see man <command>" when candidate explanation is empty', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    CandidateSelect({ candidates: [{ command: 'ls', explanation: '' }], onSelect, onCancel });
    capturedInputHandler?.('\r', { ...zeroKeys, return: true });
    expect(onSelect).toHaveBeenCalledWith('ls', 'see man ls');
  });

  it('passes explanation of the currently selected (non-first) candidate on Enter', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    const candidates = [
      { command: 'git status', explanation: 'show working tree status' },
      { command: 'ls -la', explanation: 'list directory contents' },
    ];
    CandidateSelect({ candidates, onSelect, onCancel });
    capturedInputHandler?.('', { ...zeroKeys, downArrow: true });
    stateCallCount = 0;
    CandidateSelect({ candidates, onSelect, onCancel });
    capturedInputHandler?.('\r', { ...zeroKeys, return: true });
    expect(onSelect).toHaveBeenCalledWith('ls -la', 'list directory contents');
  });
});

describe('CandidateSelect — command whitespace normalization', () => {
  beforeEach(resetState);

  /** Collects string leaves from a React element tree returned by the component. */
  function collectText(node: unknown): string[] {
    if (node == null || typeof node === 'boolean') {
      return [];
    }
    if (typeof node === 'string' || typeof node === 'number') {
      return [String(node)];
    }
    if (Array.isArray(node)) {
      return node.flatMap(collectText);
    }
    if (typeof node === 'object' && node !== null && 'props' in node) {
      const props = (node as { props: { children?: unknown } }).props;
      return collectText(props.children);
    }
    return [];
  }

  it('renders commands without leading whitespace in the candidate list', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    const tree = CandidateSelect({
      candidates: [{ command: '  git status', explanation: 'show working tree status' }],
      onSelect,
      onCancel,
    });

    const text = collectText(tree).join('\n');
    expect(text).toContain('git status');
    expect(text).not.toContain('  git status');
  });

  it('passes trimmed command to onSelect when Enter is pressed', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    CandidateSelect({
      candidates: [{ command: '  git status  ', explanation: 'show working tree status' }],
      onSelect,
      onCancel,
    });

    capturedInputHandler?.('\r', { ...zeroKeys, return: true });

    expect(onSelect).toHaveBeenCalledWith('git status', 'show working tree status');
  });

  it('uses a fixed 3-char gutter so selection does not shift command text', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    const tree = CandidateSelect({
      candidates: [
        { command: 'git rm foo.txt', explanation: 'remove tracked file' },
        { command: 'git rm --cached foo.txt', explanation: 'untrack only' },
      ],
      onSelect,
      onCancel,
    });

    const text = collectText(tree).join('\n');
    expect(text).toContain('┌>');
    expect(text).toContain('git rm foo.txt');
    expect(text).toContain('│');
    expect(text).toContain('remove tracked file');
    expect(text).toContain('git rm --cached foo.txt');
    expect(text).toContain('untrack only');
  });

  it('extends the vertical tail through wrapped explanation lines on the active item', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    const tree = CandidateSelect({
      candidates: [
        {
          command: 'git rm foo.txt',
          explanation:
            'remove the file from both the working directory and the git index staging area for commit',
        },
      ],
      onSelect,
      onCancel,
    });

    const text = collectText(tree).join('\n');
    const tailCount = (text.match(/│/g) ?? []).length;
    expect(text).toContain('┌>');
    expect(tailCount).toBeGreaterThanOrEqual(2);
  });
});

describe('CandidateSelect — Enter key raw-mode regression', () => {
  beforeEach(resetState);

  // In terminal raw mode, Enter sends '\r' as the `input` character alongside
  // key.return=true. The generic `input && !key.ctrl && !key.meta` handler would
  // previously consume '\r' and call setQuery before key.return was checked,
  // silently preventing onSelect from ever firing.
  it('fires onSelect when Enter sends \\r as input (raw mode)', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    CandidateSelect({
      candidates: [
        { command: 'git status', explanation: '' },
        { command: 'ls -la', explanation: '' },
      ],
      onSelect,
      onCancel,
    });

    // Simulate raw-mode Enter: input='\r', key.return=true
    capturedInputHandler?.('\r', { ...zeroKeys, return: true });

    expect(onSelect).toHaveBeenCalledWith('git status', 'see man git');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('does not append \\r to query when Enter is pressed', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    CandidateSelect({
      candidates: [{ command: 'git status', explanation: '' }],
      onSelect,
      onCancel,
    });

    // State slot 1 = query; capture the setter before pressing Enter
    const querySetterBefore = stateSetters[1];
    capturedInputHandler?.('\r', { ...zeroKeys, return: true });

    // setQuery (stateSetters[1]) must NOT have been called — '\r' should not
    // be appended to the search query
    expect(querySetterBefore).not.toHaveBeenCalled();
  });

  it('selects correct candidate after navigating down then pressing Enter', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    const candidates = [
      { command: 'git status', explanation: '' },
      { command: 'ls -la', explanation: '' },
    ];

    CandidateSelect({ candidates, onSelect, onCancel });
    // Move to second candidate
    capturedInputHandler?.('', { ...zeroKeys, downArrow: true });

    // Re-render with updated selectedIndex
    stateCallCount = 0;
    CandidateSelect({ candidates, onSelect, onCancel });

    // Press Enter via raw-mode '\r'
    capturedInputHandler?.('\r', { ...zeroKeys, return: true });

    expect(onSelect).toHaveBeenCalledWith('ls -la', 'see man ls');
  });
});

describe('CandidateSelect — destructive command warning', () => {
  beforeEach(resetState);

  /** Collects string leaves from a React element tree returned by the component. */
  function collectText(node: unknown): string[] {
    if (node == null || typeof node === 'boolean') {
      return [];
    }
    if (typeof node === 'string' || typeof node === 'number') {
      return [String(node)];
    }
    if (Array.isArray(node)) {
      return node.flatMap(collectText);
    }
    if (typeof node === 'object' && node !== null && 'props' in node) {
      const props = (node as { props: { children?: unknown } }).props;
      return collectText(props.children);
    }
    return [];
  }

  it('shows destructive warning below selected candidate for rm -rf commands', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    const tree = CandidateSelect({
      candidates: [{ command: 'rm -rf /tmp/foo', explanation: 'remove temp files' }],
      onSelect,
      onCancel,
    });

    const text = collectText(tree).join('\n');
    expect(text).toContain('⚠ review carefully — this command may be destructive');
    expect(text).toMatch(/rm -rf \/tmp\/foo\n ⚠/);
  });

  it('shows warning mark on destructive candidates even when not selected', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    const tree = CandidateSelect({
      candidates: [
        { command: 'git status', explanation: 'show working tree status' },
        { command: 'rm -rf /tmp/foo', explanation: 'remove temp files' },
      ],
      onSelect,
      onCancel,
    });

    const text = collectText(tree).join('\n');
    expect(text).toMatch(/rm -rf \/tmp\/foo\n ⚠/);
    expect(text).not.toMatch(/git status\n ⚠/);
    expect(text).not.toContain('⚠ review carefully — this command may be destructive');
  });

  it('does not show destructive warning for safe commands', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    const tree = CandidateSelect({
      candidates: [{ command: 'git status', explanation: 'show working tree status' }],
      onSelect,
      onCancel,
    });

    const text = collectText(tree).join('\n');
    expect(text).not.toContain('⚠ review carefully — this command may be destructive');
    expect(text).not.toMatch(/git status\n ⚠/);
  });

  it('still calls onSelect for destructive commands (warn-only, not blocked)', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    CandidateSelect({
      candidates: [{ command: 'rm -rf /tmp/foo', explanation: 'remove temp files' }],
      onSelect,
      onCancel,
    });

    capturedInputHandler?.('\r', { ...zeroKeys, return: true });

    expect(onSelect).toHaveBeenCalledWith('rm -rf /tmp/foo', 'remove temp files');
  });
});

describe('CandidateSelect — wrapping navigation', () => {
  beforeEach(resetState);

  // Test 1: upArrow from index 0 wraps to the last candidate.
  // Strategy: render once (selectedIndex=0), press upArrow to update stateValues[0]=2,
  // then reset stateCallCount and re-render so the new closure captures selectedIndex=2,
  // then press Return to confirm 'pwd' is selected.
  it('wraps selection to last candidate when pressing upArrow at index 0', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    const candidates = [
      { command: 'git status', explanation: '' },
      { command: 'ls -la', explanation: '' },
      { command: 'pwd', explanation: '' },
    ];

    // First render — selectedIndex=0 captured in closure
    CandidateSelect({ candidates, onSelect, onCancel });

    // upArrow from 0 wraps to visible.length - 1 = 2; stateValues[0] is now 2
    capturedInputHandler?.('', { ...zeroKeys, upArrow: true });

    // Simulate re-render by resetting call counter and re-calling the component.
    // stateValues[0] is already 2, so useState(0) returns [2, setter].
    stateCallCount = 0;
    CandidateSelect({ candidates, onSelect, onCancel });

    // Press Return — selectedIndex=2 in new closure → onSelect('pwd')
    capturedInputHandler?.('', { ...zeroKeys, return: true });

    expect(onSelect).toHaveBeenCalledWith('pwd', 'see man pwd');
  });

  // Test 2: downArrow wraps from last back to index 0.
  // Strategy: render once (selectedIndex=0), press downArrow twice (0->1->0),
  // then reset stateCallCount and re-render so the new closure captures selectedIndex=0,
  // then press Return to confirm 'git status' is selected.
  it('wraps selection back to first candidate when pressing downArrow past the last', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    const candidates = [
      { command: 'git status', explanation: '' },
      { command: 'ls -la', explanation: '' },
    ];

    // First render — selectedIndex=0 captured in closure
    CandidateSelect({ candidates, onSelect, onCancel });

    // downArrow: 0 -> 1; stateValues[0] = 1
    capturedInputHandler?.('', { ...zeroKeys, downArrow: true });
    // downArrow: 1 -> wraps to 0; stateValues[0] = 0
    capturedInputHandler?.('', { ...zeroKeys, downArrow: true });

    // Simulate re-render by resetting call counter and re-calling the component.
    // stateValues[0] is 0 again, so useState(0) returns [0, setter].
    stateCallCount = 0;
    CandidateSelect({ candidates, onSelect, onCancel });

    // Press Return — selectedIndex=0 in new closure → onSelect('git status')
    capturedInputHandler?.('', { ...zeroKeys, return: true });

    expect(onSelect).toHaveBeenCalledWith('git status', 'see man git');
  });
});

describe('CandidateSelect — missing-tool flag', () => {
  beforeEach(resetState);

  /** Collects string leaves from a React element tree returned by the component. */
  function collectText(node: unknown): string[] {
    if (node == null || typeof node === 'boolean') {
      return [];
    }
    if (typeof node === 'string' || typeof node === 'number') {
      return [String(node)];
    }
    if (Array.isArray(node)) {
      return node.flatMap(collectText);
    }
    if (typeof node === 'object' && node !== null && 'props' in node) {
      const props = (node as { props: { children?: unknown } }).props;
      return collectText(props.children);
    }
    return [];
  }

  it('renders ⓘ before the explanation and the legend for the selected candidate', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');

    const tree = CandidateSelect({
      candidates: [{ command: 'fd -e ts', explanation: 'find ts files', missingTools: ['fd'] }],
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    });

    const text = collectText(tree).join('\n');
    expect(text).toMatch(/fd -e ts\n.{3}\nⓘ\n find ts files/);
    expect(text).toContain('ⓘ\n not installed');
  });

  type Element = { props: Record<string, unknown> & { children?: unknown } };

  /** Every element in the tree (function components are not invoked). */
  function collectElements(node: unknown): Element[] {
    if (Array.isArray(node)) {
      return node.flatMap(collectElements);
    }
    if (typeof node === 'object' && node !== null && 'props' in node) {
      const element = node as Element;
      return [element, ...collectElements(element.props.children)];
    }
    return [];
  }

  it('shows ⚠, ⓘ, the destructive footer and the legend for a destructive flagged candidate', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');

    const tree = CandidateSelect({
      candidates: [{ command: 'sudo fd -e ts', explanation: 'x', missingTools: ['fd'] }],
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    });

    const text = collectText(tree).join('\n');
    expect(text).toMatch(/sudo fd -e ts\n ⚠\n.{3}\nⓘ\n x/);
    expect(text).toContain('⚠ review carefully — this command may be destructive');
    expect(text).toContain('ⓘ\n not installed');

    const footers = collectElements(tree).filter((element) => {
      if (element.props.marginTop !== 1) return false;
      const footerText = collectText(element.props.children).join('\n');
      return footerText === '⚠ review carefully — this command may be destructive';
    });
    expect(footers).toHaveLength(1);
    expect(collectText(footers[0].props.children).join('\n')).not.toContain('sudo fd -e ts');
  });

  it('gives the gutter prefix and ⚠ flexShrink 0', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');

    const tree = CandidateSelect({
      candidates: [{ command: 'sudo fd -e ts', explanation: 'x', missingTools: ['fd'] }],
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    });

    const nonShrinking = collectElements(tree)
      .filter((element) => element.props.flexShrink === 0)
      .map((element) => collectText(element.props.children).join(''));
    expect(nonShrinking).toContain('┌> ');
    expect(nonShrinking).toContain(' ⚠');
    expect(nonShrinking).not.toContain(' ⓘ');
  });

  it('puts the legend directly above the controls line', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const { ControlsLine } = await import('../src/ui/ControlsLine.js');

    const tree = CandidateSelect({
      candidates: [{ command: 'fd -e ts', explanation: 'find ts files', missingTools: ['fd'] }],
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    }) as unknown as Element;

    const children = (tree.props.children as unknown[]).filter(
      (child) => typeof child === 'object' && child !== null,
    ) as (Element & { type?: unknown })[];
    const controlsIndex = children.findIndex((child) => child.type === ControlsLine);
    expect(controlsIndex).toBeGreaterThan(0);
    expect(collectText(children[controlsIndex - 1].props.children).join('\n')).toBe(
      'ⓘ\n not installed',
    );
  });

  it('shows no ⓘ for an unflagged candidate', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');

    const tree = CandidateSelect({
      candidates: [{ command: 'git status', explanation: 'show status' }],
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    });

    const text = collectText(tree).join('\n');
    expect(text).not.toContain('ⓘ');
  });

  it('shows ⓘ and the legend for an unselected flagged candidate', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');

    const tree = CandidateSelect({
      candidates: [
        { command: 'ls', explanation: 'list' },
        { command: 'fd -e ts', explanation: 'find ts files', missingTools: ['fd'] },
      ],
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    });

    const text = collectText(tree).join('\n');
    expect(text).toMatch(/fd -e ts\n {3}\nⓘ\n find ts files/);
    expect(text).toContain('ⓘ\n not installed');
  });

  it('Enter on a flagged candidate inserts its command unchanged', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();

    CandidateSelect({
      candidates: [{ command: 'fd -e ts', explanation: 'find ts files', missingTools: ['fd'] }],
      onSelect,
      onCancel: vi.fn(),
    });

    capturedInputHandler?.('\r', { ...zeroKeys, return: true });

    expect(onSelect).toHaveBeenCalledWith('fd -e ts', 'find ts files');
  });
});

describe('CandidateSelect — Tab install form', () => {
  beforeEach(resetState);

  /** Collects string leaves from a React element tree returned by the component. */
  function collectText(node: unknown): string[] {
    if (node == null || typeof node === 'boolean') {
      return [];
    }
    if (typeof node === 'string' || typeof node === 'number') {
      return [String(node)];
    }
    if (Array.isArray(node)) {
      return node.flatMap(collectText);
    }
    if (typeof node === 'object' && node !== null && 'props' in node) {
      const props = (node as { props: { children?: unknown } }).props;
      return collectText(props.children);
    }
    return [];
  }

  type Element = { type: unknown; props: Record<string, unknown> & { children?: unknown } };

  /** First element of the given type, walking props.children (function components are not invoked). */
  function findElementByType(node: unknown, type: unknown): Element | undefined {
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = findElementByType(child, type);
        if (found) return found;
      }
      return undefined;
    }
    if (typeof node === 'object' && node !== null && 'props' in node) {
      const element = node as Element;
      if (element.type === type) return element;
      return findElementByType(element.props.children, type);
    }
    return undefined;
  }

  /** Every element in the tree (function components are not invoked). */
  function collectElements(node: unknown): Element[] {
    if (Array.isArray(node)) {
      return node.flatMap(collectElements);
    }
    if (typeof node === 'object' && node !== null && 'props' in node) {
      const element = node as Element;
      return [element, ...collectElements(element.props.children)];
    }
    return [];
  }

  const flagged = {
    command: 'fd -e ts',
    explanation: 'find ts files',
    missingTools: ['fd'],
    install: { form: 'brew install fd && fd -e ts', packages: ['fd'], blocked: null },
  } as const;

  const tab = { ...zeroKeys, tab: true };

  it('Tab switches the selected flagged row to its install form and back', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const props = { candidates: [flagged], onSelect: vi.fn(), onCancel: vi.fn() };

    CandidateSelect(props);
    capturedInputHandler?.('', tab);
    expect(stateSetters[2]).toHaveBeenCalled();

    stateCallCount = 0;
    let text = collectText(CandidateSelect(props)).join('\n');
    expect(text).toMatch(/brew install fd && fd -e ts\n.{3}\nⓘ\n find ts files/);
    expect(text).toContain('ⓘ\n not installed · tab prepends the install command');

    capturedInputHandler?.('', tab);
    stateCallCount = 0;
    text = collectText(CandidateSelect(props)).join('\n');
    expect(text).toMatch(/fd -e ts\n.{3}\nⓘ\n find ts files/);
    expect(text).not.toContain('brew install fd');
    expect(text).toContain('ⓘ\n not installed');
  });

  it('Shift+Tab toggles the same way', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const props = { candidates: [flagged], onSelect: vi.fn(), onCancel: vi.fn() };

    CandidateSelect(props);
    capturedInputHandler?.('', { ...tab, shift: true });
    stateCallCount = 0;
    const text = collectText(CandidateSelect(props)).join('\n');
    expect(text).toContain('brew install fd && fd -e ts');
  });

  it('Tab never reaches the search filter', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');

    CandidateSelect({ candidates: [flagged], onSelect: vi.fn(), onCancel: vi.fn() });
    capturedInputHandler?.('\t', tab);

    expect(stateSetters[1]).not.toHaveBeenCalled();
    expect(stateValues[1]).toBe('');
  });

  it('Enter after Tab inserts exactly the install form', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const props = { candidates: [flagged], onSelect, onCancel: vi.fn() };

    CandidateSelect(props);
    capturedInputHandler?.('', tab);
    stateCallCount = 0;
    CandidateSelect(props);
    capturedInputHandler?.('\r', { ...zeroKeys, return: true });

    expect(onSelect).toHaveBeenCalledWith('brew install fd && fd -e ts', 'find ts files');
  });

  it('builds the explanation fallback from the original command, not the installer', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const props = {
      candidates: [{ ...flagged, explanation: '' }],
      onSelect,
      onCancel: vi.fn(),
    };

    CandidateSelect(props);
    capturedInputHandler?.('', tab);
    stateCallCount = 0;
    CandidateSelect(props);
    capturedInputHandler?.('\r', { ...zeroKeys, return: true });

    expect(onSelect).toHaveBeenCalledWith('brew install fd && fd -e ts', 'see man fd');
  });

  it('Tab does nothing on an unflagged candidate', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');

    CandidateSelect({
      candidates: [{ command: 'git status', explanation: 'status' }],
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    });
    capturedInputHandler?.('', tab);

    expect(stateSetters[2]).not.toHaveBeenCalled();
    expect(stateSetters[1]).not.toHaveBeenCalled();
  });

  it('Tab does nothing on a flagged candidate whose install plan is blocked', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');

    CandidateSelect({
      candidates: [
        {
          command: 'fd -e ts',
          explanation: 'find',
          missingTools: ['fd'],
          install: { form: null, packages: [], blocked: 'no-package-manager' },
        },
      ],
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    });
    capturedInputHandler?.('', tab);

    expect(stateSetters[2]).not.toHaveBeenCalled();
    expect(stateSetters[1]).not.toHaveBeenCalled();
  });

  it('marks a blocked plan with ⓘ and the legend', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    for (const blocked of [
      'no-package-manager',
      'unsafe-package-name',
      'unwrappable-command',
    ] as const) {
      resetState();
      const tree = CandidateSelect({
        candidates: [
          {
            command: 'fd -e ts',
            explanation: 'find',
            missingTools: ['fd'],
            install: { form: null, packages: [], blocked },
          },
        ],
        onSelect: vi.fn(),
        onCancel: vi.fn(),
      });
      const text = collectText(tree).join('\n');
      expect(text).toMatch(/fd -e ts\n.{3}\nⓘ\n find/);
      expect(text).toContain('ⓘ\n not installed');
      expect(text).not.toContain('tab prepends');
    }
  });

  it('shows ⚠, ⓘ, the destructive footer and the legend for a toggled sudo install form (D-08)', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const props = {
      candidates: [
        {
          command: 'fdfind -e ts',
          explanation: 'find',
          missingTools: ['fdfind'],
          install: {
            form: 'sudo apt install fd-find && fdfind -e ts',
            packages: ['fd-find'],
            blocked: null,
          },
        },
      ],
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    };

    CandidateSelect(props);
    capturedInputHandler?.('', tab);
    stateCallCount = 0;
    const tree = CandidateSelect(props);

    const text = collectText(tree).join('\n');
    expect(text).toMatch(/sudo apt install fd-find && fdfind -e ts\n ⚠\n.{3}\nⓘ\n find/);
    expect(text).toContain('ⓘ\n not installed · tab prepends the install command');
    expect(text).not.toContain('will install');
    const footers = collectElements(tree).filter((element) => {
      if (element.props.marginTop !== 1) return false;
      const footerText = collectText(element.props.children).join('\n');
      return footerText === '⚠ review carefully — this command may be destructive';
    });
    expect(footers).toHaveLength(1);
  });

  it('keeps the toggle on the same candidate when a search query re-indexes the list (D-13)', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const props = {
      candidates: [{ command: 'ls -la', explanation: 'list' }, flagged],
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    };

    CandidateSelect(props);
    capturedInputHandler?.('', { ...zeroKeys, downArrow: true });
    stateCallCount = 0;
    CandidateSelect(props);
    capturedInputHandler?.('', tab);

    // Type a query that hides `ls -la`; the [query] effect would reset selection to 0.
    stateCallCount = 0;
    CandidateSelect(props);
    capturedInputHandler?.('f', zeroKeys);
    stateValues[0] = 0;
    stateCallCount = 0;
    const text = collectText(CandidateSelect(props)).join('\n');

    expect(stateValues[1]).toBe('f');
    expect(text).not.toContain('ls -la');
    expect(text).toMatch(/brew install fd && fd -e ts\n.{3}\nⓘ/);
  });

  it('renders ControlsLine without a tab hint, toggled or not', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const { ControlsLine } = await import('../src/ui/ControlsLine.js');
    const props = { candidates: [flagged], onSelect: vi.fn(), onCancel: vi.fn() };

    const before = findElementByType(CandidateSelect(props), ControlsLine);
    expect(before).toBeDefined();
    expect(before?.props).toEqual({});

    capturedInputHandler?.('', tab);
    stateCallCount = 0;
    const after = findElementByType(CandidateSelect(props), ControlsLine);
    expect(after?.props).toEqual({});
  });
});
