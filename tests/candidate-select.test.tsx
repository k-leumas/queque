/**
 * tests/candidate-select.test.tsx
 *
 * Wave 2 tests for CandidateSelect — targeting the full monocle contract:
 * candidates: CandidateList | null, initialQuery?: string, live search,
 * ┌> glyph, LoadingSpinner/SearchInput/ControlsLine composition, error state.
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
    expect(useEffect).toHaveBeenCalledTimes(3);
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
