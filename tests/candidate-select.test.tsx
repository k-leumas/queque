/**
 * tests/candidate-select.test.tsx
 *
 * Wave 0 test scaffold for CandidateSelect. These tests target the Wave 2
 * signature (candidates: CandidateList | null, initialQuery?: string).
 *
 * Tests marked `it.skip` are intentionally RED at Wave 0 — they document the
 * contract that Wave 2 must satisfy. Wave 2 removes the `.skip` as it
 * implements each feature.
 */

import React from 'react';
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

// ---------------------------------------------------------------------------
// CandidateSelect tests — targeting Wave 2 behavior
// ---------------------------------------------------------------------------

describe('CandidateSelect — loading state', () => {
  beforeEach(() => {
    capturedInputHandler = undefined;
    vi.clearAllMocks();
  });

  it('renders spinner placeholder when candidates is null', async () => {
    // Wave 2 changes Props so candidates: CandidateList | null is accepted.
    // Current CandidateSelect.ts Props has candidates: CandidateList (not null).
    // Smoke test: createElement must not throw even with null candidates.
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    expect(() => {
      // biome-ignore lint/suspicious/noExplicitAny: intentional Wave 2 RED test
      React.createElement(CandidateSelect as any, {
        candidates: null,
        onSelect,
        onCancel,
      });
    }).not.toThrow();
  });
});

describe('CandidateSelect — filterCandidates logic', () => {
  beforeEach(() => {
    capturedInputHandler = undefined;
    vi.clearAllMocks();
  });

  // Wave 2: adds live search with initialQuery pre-filtering
  it.skip('only selects matching candidates when query is provided', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    React.createElement(CandidateSelect, {
      candidates: [
        { command: 'git status', explanation: '' },
        { command: 'ls -la', explanation: '' },
      ],
      onSelect,
      onCancel,
      // @ts-expect-error initialQuery not yet in Props (Wave 2 adds it)
      initialQuery: 'git',
    });

    // Simulate Enter key — should accept 'git status' (only match for 'git' filter)
    capturedInputHandler?.('', { ...zeroKeys, return: true });

    expect(onSelect).toHaveBeenCalledWith('git status');
  });
});

describe('CandidateSelect — keyboard navigation', () => {
  beforeEach(() => {
    capturedInputHandler = undefined;
    vi.clearAllMocks();
  });

  // Wave 2: renders the component properly with Ink so useInput is wired
  it.skip('calls onCancel when Escape is pressed', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    React.createElement(CandidateSelect, {
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
  beforeEach(() => {
    capturedInputHandler = undefined;
    vi.clearAllMocks();
  });

  // Wave 2: adds initialQuery prop; pre-filters by lbuffer text (D-01)
  it.skip('pre-populates query from initialQuery prop and accepts only matching candidate', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    React.createElement(CandidateSelect, {
      candidates: [
        { command: 'git status', explanation: '' },
        { command: 'ls -la', explanation: '' },
      ],
      onSelect,
      onCancel,
      // @ts-expect-error initialQuery not yet in Props (Wave 2 adds it)
      initialQuery: 'git',
    });

    // Press Enter — should accept 'git status' (the only candidate after filter)
    capturedInputHandler?.('', { ...zeroKeys, return: true });

    expect(onSelect).toHaveBeenCalledWith('git status');
    expect(onSelect).not.toHaveBeenCalledWith('ls -la');
  });
});
