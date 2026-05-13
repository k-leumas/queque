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

    expect(onSelect).toHaveBeenCalledWith('git status');
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

    expect(onSelect).toHaveBeenCalledWith('git status');
    expect(onSelect).not.toHaveBeenCalledWith('ls -la');
  });
});
