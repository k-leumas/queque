/**
 * tests/candidate-select-layout.test.tsx
 *
 * Real-hooks regression tests for CandidateSelect's layout reports (G-09-7).
 *
 * Unlike tests/candidate-select.test.tsx, this file mocks neither react nor ink: the
 * component runs inside a real Ink render with real effects, mirroring run-foreground.ts
 * (render with candidates null, then a single rerender when candidates arrive). That is
 * the only way to see which layout height the effects report on candidate arrival.
 */

import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';
import { render } from 'ink';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetZellijPaneHeightCache,
  resolveZellijPaneHeight,
  syncZellijFloatingPaneHeight,
} from '../src/client/zellij-pane-resize.js';
import type { CommandCandidate } from '../src/contracts/candidates.js';
import {
  annotateCandidates,
  type DisplayCandidate,
  type ToolInventory,
} from '../src/shared/tool-awareness.js';
import { CandidateSelect } from '../src/ui/CandidateSelect.js';
import { estimateCandidateSelectLines } from '../src/ui/modal-layout.js';

// ---------------------------------------------------------------------------
// spawn spy — the rest of node:child_process stays real (Ink's terminal-size uses it)
// ---------------------------------------------------------------------------
const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawn: (...args: unknown[]) => spawnMock(...args) };
});

/** A fake `zellij action` child that exits with code 0 on the next macrotask. */
function fakeChild(): EventEmitter & { unref: () => void; kill: () => void } {
  const child = Object.assign(new EventEmitter(), { unref: vi.fn(), kill: vi.fn() });
  setImmediate(() => child.emit('exit', 0));
  return child;
}

// ---------------------------------------------------------------------------
// TTY fakes: the debug pane was an 80-wide Zellij floating pane minus its border
// ---------------------------------------------------------------------------
class FakeStdout extends Writable {
  readonly isTTY = true;
  readonly columns = 78;
  readonly rows = 22;
  readonly writes: string[] = [];

  override _write(chunk: unknown, _encoding: BufferEncoding, callback: () => void): void {
    this.writes.push(String(chunk));
    callback();
  }
}

class FakeStdin extends Readable {
  readonly isTTY = true;

  override _read(): void {}

  setRawMode(): this {
    return this;
  }

  ref(): this {
    return this;
  }

  unref(): this {
    return this;
  }
}

/** min(80, 78) − the modal's 2 padding columns − the 3-column gutter (CandidateSelect.tsx). */
const CONTENT_WIDTH = 73;

/** Real time to wait after the last flush so a late second report is captured. */
const SETTLE_MS = 200;

const LBUFFER = 'show me how to use z3';

const RAW_CANDIDATES: CommandCandidate[] = [
  { command: 'z3 -smt2 problem.smt2', explanation: 'Solve an SMT-LIB 2 problem file with z3.' },
  {
    command: "echo '(declare-const x Int) (assert (> x 2)) (check-sat)' | z3 -in",
    explanation: 'Pipe a one-line SMT-LIB script into z3 on stdin.',
  },
  {
    command:
      'python3 -c "from z3 import *; x = Int(\'x\'); s = Solver(); s.add(x > 2); print(s.check())"',
    explanation: 'Use the z3 Python bindings to check a constraint.',
  },
];

const INVENTORY: ToolInventory = {
  commands: new Set(['echo', 'python3', 'cat', 'ls', 'brew', 'pip3']),
  builtins: new Set(['echo', 'cd']),
  functions: new Set(),
};

const ENV_KEYS = ['QQ_DEV_ROOT', 'ZELLIJ', 'ZELLIJ_PANE_ID', 'QQ_PANE_HEIGHT'] as const;

/** The estimator's answer for these candidates filtered by `query`. */
function estimate(
  candidates: readonly DisplayCandidate[],
  initialQuery: string,
  query: string,
): number {
  return estimateCandidateSelectLines({
    candidates,
    initialQuery,
    query,
    selectedIndex: 0,
    contentWidth: CONTENT_WIDTH,
    includeDevFooter: false,
    installToggled: new Set(),
  });
}

/**
 * Mirrors run-foreground.ts: render the loading state, then rerender once with candidates.
 * Returns every chunk Ink wrote to stdout.
 */
async function runArrival(
  candidates: readonly DisplayCandidate[],
  initialQuery: string,
  onLayoutLinesChange: (lines: number) => void,
): Promise<string[]> {
  const stdout = new FakeStdout();
  const stdin = new FakeStdin();
  const build = (list: readonly DisplayCandidate[] | null) =>
    React.createElement(CandidateSelect, {
      candidates: list,
      initialQuery,
      onSelect: () => {},
      onCancel: () => {},
      onLayoutLinesChange,
    });

  const app = render(build(null), {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    interactive: true,
    patchConsole: false,
    exitOnCtrlC: false,
  });
  try {
    await app.waitUntilRenderFlush();
    app.rerender(build(candidates));
    await app.waitUntilRenderFlush();
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
  } finally {
    app.unmount();
  }
  return stdout.writes;
}

describe('CandidateSelect layout reports on candidate arrival (real hooks, G-09-7)', () => {
  const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    spawnMock.mockReset();
    spawnMock.mockImplementation(() => fakeChild());
    resetZellijPaneHeightCache();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    resetZellijPaneHeightCache();
  });

  it('(a) a non-matching lbuffer reports only the full-list height and never draws no-matches', async () => {
    const full = estimate(RAW_CANDIDATES, LBUFFER, '');
    const noMatch = estimate(RAW_CANDIDATES, LBUFFER, LBUFFER);
    expect(full).not.toBe(noMatch);

    const reports: number[] = [];
    const writes = await runArrival(RAW_CANDIDATES, LBUFFER, (lines) => reports.push(lines));

    expect(reports.length).toBeGreaterThan(0);
    expect(reports).not.toContain(noMatch);
    expect(reports).toEqual(reports.map(() => full));
    expect(writes.some((chunk) => chunk.includes('no matches'))).toBe(false);
  });

  it('(b) flagged candidates (tool awareness on) report only the full-list height', async () => {
    const flagged = annotateCandidates(RAW_CANDIDATES, INVENTORY, 'darwin');
    expect(flagged.some((candidate) => (candidate.missingTools?.length ?? 0) > 0)).toBe(true);
    const full = estimate(flagged, LBUFFER, '');
    const noMatch = estimate(flagged, LBUFFER, LBUFFER);
    expect(full).not.toBe(noMatch);

    const reports: number[] = [];
    const writes = await runArrival(flagged, LBUFFER, (lines) => reports.push(lines));

    expect(reports.length).toBeGreaterThan(0);
    expect(reports).not.toContain(noMatch);
    expect(reports).toEqual(reports.map(() => full));
    expect(writes.some((chunk) => chunk.includes('no matches'))).toBe(false);
  });

  it('(c) inside Zellij the arrival spawns exactly one resize, to the full-list height', async () => {
    process.env.ZELLIJ = '0';
    process.env.ZELLIJ_PANE_ID = '7';
    process.env.QQ_PANE_HEIGHT = '24';
    const full = estimate(RAW_CANDIDATES, LBUFFER, '');

    await runArrival(RAW_CANDIDATES, LBUFFER, syncZellijFloatingPaneHeight);

    const heights = spawnMock.mock.calls.map((call) => (call[1] as string[]).at(-1));
    expect(heights).toEqual([String(resolveZellijPaneHeight(full, 24))]);
    expect(spawnMock).toHaveBeenCalledWith(
      'zellij',
      [
        'action',
        'change-floating-pane-coordinates',
        '--pane-id',
        'terminal_7',
        '--height',
        String(resolveZellijPaneHeight(full, 24)),
      ],
      { stdio: 'ignore' },
    );
  });

  it('(d) an lbuffer that matches a command still pre-filters the list on arrival', async () => {
    const initialQuery = 'smt2';
    const filtered = estimate(RAW_CANDIDATES, initialQuery, initialQuery);
    const full = estimate(RAW_CANDIDATES, initialQuery, '');
    expect(filtered).not.toBe(full);

    const reports: number[] = [];
    await runArrival(RAW_CANDIDATES, initialQuery, (lines) => reports.push(lines));

    expect(reports.length).toBeGreaterThan(0);
    expect(reports).toEqual(reports.map(() => filtered));
  });
});
