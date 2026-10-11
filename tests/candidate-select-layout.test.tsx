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
import { stripVTControlCharacters } from 'node:util';
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

/**
 * Zellij floating-pane chrome (border + title), as rows. Kept as an independent oracle on
 * purpose: reading the source constant would make a wrong value pass its own check.
 */
const ZELLIJ_PANE_CHROME_ROWS = 2;

/** The header text every CandidateSelect frame starts with. */
const HEADER_MARKER = 'queque ›';

/** Columns of the fake TTY (FakeStdout.columns), used as the replay screen width. */
const SCREEN_COLUMNS = 78;

/** The text of Ink's last frame (escape codes stripped), i.e. the last chunk with the header. */
function lastFrame(writes: readonly string[]): string {
  const frame = writes
    .map((chunk) => stripVTControlCharacters(chunk))
    .filter((text) => text.includes(HEADER_MARKER))
    .at(-1);
  if (frame === undefined) {
    throw new Error('Ink never wrote a frame containing the header');
  }
  return frame;
}

/**
 * Rows Ink's last frame occupies on the PTY. N content rows that each end in a newline
 * leave the cursor on row N + 1; a fullscreen frame without the trailing newline gives N.
 */
function lastFrameRows(writes: readonly string[]): number {
  return lastFrame(writes).split('\n').length;
}

/** The `--height` value of the last spawned `zellij action`. */
function lastSpawnedHeight(): number {
  const args = spawnMock.mock.calls.at(-1)?.[1] as string[] | undefined;
  if (args === undefined) {
    throw new Error('no zellij resize was spawned');
  }
  return Number(args[args.indexOf('--height') + 1]);
}

/** The `--height` value of every spawned `zellij action`, in spawn order. */
function spawnedHeights(): number[] {
  return spawnMock.mock.calls.map((call) => {
    const args = call[1] as string[];
    return Number(args[args.indexOf('--height') + 1]);
  });
}

/**
 * A tiny terminal model: feeds Ink's raw writes, in order, into a rows x columns grid and
 * returns the visible rows (trailing spaces trimmed) plus how many times the grid scrolled.
 * It understands just what Ink's log-update emits: printable text, `\n` (the PTY's onlcr,
 * so col 0 + next row), `\r`, and CSI cursor-move / erase sequences. Colours, private modes
 * (`?2026` synchronized output, `?25` cursor visibility) and bare `ESC 7` / `ESC 8` are
 * ignored. Every glyph in these fixtures (›, ┌, │, ⓘ, ⚠) is one column, as in string-width.
 */
function replayScreen(
  writes: readonly string[],
  rows: number,
  columns: number,
): { lines: string[]; scrolled: number } {
  const blankRow = (): string[] => Array.from({ length: columns }, () => ' ');
  const grid: string[][] = Array.from({ length: rows }, blankRow);
  let row = 0;
  let col = 0;
  let scrolled = 0;
  const clampRow = (value: number): number => Math.max(0, Math.min(rows - 1, value));
  const clampCol = (value: number): number => Math.max(0, Math.min(columns - 1, value));
  const eraseRow = (target: number, from: number, to: number): void => {
    const line = grid[target];
    if (line === undefined) return;
    for (let index = Math.max(0, from); index <= Math.min(columns - 1, to); index += 1) {
      line[index] = ' ';
    }
  };
  const lineFeed = (): void => {
    col = 0;
    if (row === rows - 1) {
      grid.shift();
      grid.push(blankRow());
      scrolled += 1;
    } else {
      row += 1;
    }
  };

  const chars = [...writes.join('')];
  let index = 0;
  while (index < chars.length) {
    const char = chars[index] as string;
    index += 1;
    if (char === '\u001B') {
      const next = chars[index];
      if (next === '[') {
        index += 1;
        let params = '';
        while (index < chars.length && !/[@-~]/.test(chars[index] as string)) {
          params += chars[index];
          index += 1;
        }
        const final = chars[index] ?? '';
        index += 1;
        if (params.startsWith('?')) continue; // private modes (?2026, ?25)
        const numbers = params.split(';').map((part) => (part === '' ? undefined : Number(part)));
        const n = numbers[0] ?? 1;
        switch (final) {
          case 'A':
            row = clampRow(row - n);
            break;
          case 'B':
            row = clampRow(row + n);
            break;
          case 'C':
            col = clampCol(col + n);
            break;
          case 'D':
            col = clampCol(col - n);
            break;
          case 'E':
            row = clampRow(row + n);
            col = 0;
            break;
          case 'F':
            row = clampRow(row - n);
            col = 0;
            break;
          case 'G':
            col = clampCol(n - 1);
            break;
          case 'H':
            row = clampRow((numbers[0] ?? 1) - 1);
            col = clampCol((numbers[1] ?? 1) - 1);
            break;
          case 'K': {
            const mode = numbers[0] ?? 0;
            if (mode === 0) eraseRow(row, col, columns - 1);
            else if (mode === 1) eraseRow(row, 0, col);
            else if (mode === 2) eraseRow(row, 0, columns - 1);
            break;
          }
          case 'J': {
            const mode = numbers[0] ?? 0;
            if (mode === 0) {
              eraseRow(row, col, columns - 1);
              for (let target = row + 1; target < rows; target += 1) {
                eraseRow(target, 0, columns - 1);
              }
            } else if (mode === 2) {
              for (let target = 0; target < rows; target += 1) eraseRow(target, 0, columns - 1);
            }
            break;
          }
          default:
            break; // `m` (colours) and anything else
        }
      } else {
        index += 1; // bare ESC 7 / ESC 8 and other two-byte escapes
      }
      continue;
    }
    if (char === '\n') {
      lineFeed();
      continue;
    }
    if (char === '\r') {
      col = 0;
      continue;
    }
    if (char < ' ') continue; // other control bytes
    if (col < columns) {
      const line = grid[row];
      if (line !== undefined) line[col] = char;
      col += 1;
    }
  }

  return { lines: grid.map((line) => line.join('').trimEnd()), scrolled };
}

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

/** Waits SETTLE_MS of real time so a late report or resize is captured. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
}

/** A mounted CandidateSelect after candidate arrival, with key and rerender helpers. */
interface MountedArrival {
  stdout: FakeStdout;
  /** Pushes one key to stdin, waits 50 ms, then waits for Ink to flush the render. */
  press: (key: string) => Promise<void>;
  /** Rerenders with a new candidates array (a re-query) and waits for the flush. */
  rerender: (list: readonly DisplayCandidate[] | null) => Promise<void>;
  /** Copies every chunk written so far, then unmounts. Safe to call more than once. */
  close: () => string[];
}

/**
 * Mirrors run-foreground.ts: render the loading state, then rerender once with candidates.
 * The app stays mounted so a test can press keys before `close()`.
 */
async function mountArrival(
  candidates: readonly DisplayCandidate[],
  initialQuery: string,
  onLayoutLinesChange: (lines: number) => void,
): Promise<MountedArrival> {
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
  let closedWrites: string[] | undefined;
  const close = (): string[] => {
    if (closedWrites === undefined) {
      // Copy before unmount, so unmount writes are never mistaken for the last frame.
      closedWrites = [...stdout.writes];
      app.unmount();
    }
    return closedWrites;
  };
  try {
    await app.waitUntilRenderFlush();
    app.rerender(build(candidates));
    await app.waitUntilRenderFlush();
  } catch (error) {
    close();
    throw error;
  }

  return {
    stdout,
    press: async (key: string): Promise<void> => {
      stdin.push(key);
      await new Promise((resolve) => setTimeout(resolve, 50));
      await app.waitUntilRenderFlush();
    },
    rerender: async (list: readonly DisplayCandidate[] | null): Promise<void> => {
      app.rerender(build(list));
      await app.waitUntilRenderFlush();
    },
    close,
  };
}

/**
 * Mounts, lets the arrival settle, and unmounts. Returns a copy of every chunk Ink wrote to
 * stdout before unmount.
 */
async function runArrival(
  candidates: readonly DisplayCandidate[],
  initialQuery: string,
  onLayoutLinesChange: (lines: number) => void,
): Promise<string[]> {
  const mounted = await mountArrival(candidates, initialQuery, onLayoutLinesChange);
  try {
    await settle();
  } finally {
    mounted.close();
  }
  return mounted.close();
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
    const writes = await runArrival(RAW_CANDIDATES, initialQuery, (lines) => reports.push(lines));

    // Changed on purpose in quick-261011-f9o: the report is the held pane height, sized for
    // the unfiltered list, so clearing the pre-filter never needs a grow.
    expect(reports.length).toBeGreaterThan(0);
    expect(reports).toEqual(reports.map(() => full));
    // The drawn frame is still pre-filtered (Phase 4).
    expect(lastFrameRows(writes)).toBe(filtered + 1);
    const frame = lastFrame(writes);
    expect(frame).toContain('z3 -smt2 problem.smt2');
    expect(frame).not.toContain('python3');
  });

  it.each([
    {
      name: 'plain',
      build: (): readonly DisplayCandidate[] => RAW_CANDIDATES,
      initialQuery: LBUFFER,
      // The query Ink renders: the non-matching lbuffer is cleared on arrival.
      query: '',
    },
    {
      name: 'flagged',
      build: (): readonly DisplayCandidate[] =>
        annotateCandidates(RAW_CANDIDATES, INVENTORY, 'darwin'),
      initialQuery: LBUFFER,
      query: '',
    },
    {
      name: 'smt2 pre-filter',
      build: (): readonly DisplayCandidate[] => RAW_CANDIDATES,
      initialQuery: 'smt2',
      query: 'smt2',
    },
  ])('(e) $name: the Zellij pane keeps the header row (PTY rows fit the whole Ink frame)', async ({
    build,
    initialQuery,
    query,
  }) => {
    process.env.ZELLIJ = '0';
    process.env.ZELLIJ_PANE_ID = '7';
    process.env.QQ_PANE_HEIGHT = '24';

    const reports: number[] = [];
    const writes = await runArrival(build(), initialQuery, (lines) => {
      reports.push(lines);
      syncZellijFloatingPaneHeight(lines);
    });

    expect(reports.length).toBeGreaterThan(0);
    const occupied = lastFrameRows(writes);
    // Ink draws exactly the estimated lines of the drawn state plus its trailing cursor row.
    // Changed on purpose in quick-261011-f9o: compared to the drawn-state estimate, not the
    // last report, because the report is now the held pane height, not the drawn height.
    expect(occupied).toBe(estimate(build(), initialQuery, query) + 1);
    const paneRows = lastSpawnedHeight() - ZELLIJ_PANE_CHROME_ROWS;
    expect(paneRows).toBeGreaterThanOrEqual(occupied);
  });

  it.each([
    { name: 'plain', build: (): readonly DisplayCandidate[] => RAW_CANDIDATES },
    {
      name: 'flagged',
      build: (): readonly DisplayCandidate[] =>
        annotateCandidates(RAW_CANDIDATES, INVENTORY, 'darwin'),
    },
  ])('(f) $name: typing smt then backspacing keeps the pane at the arrival height', async ({
    build,
  }) => {
    process.env.ZELLIJ = '0';
    process.env.ZELLIJ_PANE_ID = '7';
    process.env.QQ_PANE_HEIGHT = '24';
    const list = build();
    const arrivalEstimate = estimate(list, LBUFFER, '');

    const reports: number[] = [];
    const mounted = await mountArrival(list, LBUFFER, (lines) => {
      reports.push(lines);
      syncZellijFloatingPaneHeight(lines);
    });
    try {
      await settle();
      const arrivalHeight = lastSpawnedHeight();
      expect(arrivalHeight).toBe(resolveZellijPaneHeight(arrivalEstimate, 24));
      const screenRows = arrivalHeight - ZELLIJ_PANE_CHROME_ROWS;

      for (const key of ['s', 'm', 't']) {
        await mounted.press(key);
      }
      await settle();

      // Scalar first, so a RED failure is a one-line message (pre-fix plain: '18,11').
      expect(spawnedHeights().join(',')).toBe(String(arrivalHeight));
      expect(Math.min(...reports)).toBe(arrivalEstimate);

      // The shorter filtered frame erases every row of the taller one: header on row 0,
      // no stale full-list rows, no scroll.
      const filtered = replayScreen(mounted.stdout.writes, screenRows, SCREEN_COLUMNS);
      expect(filtered.scrolled).toBe(0);
      expect(filtered.lines[0]?.trimStart().startsWith(HEADER_MARKER)).toBe(true);
      expect(filtered.lines.some((line) => line.includes('FILTER: smt'))).toBe(true);
      expect(filtered.lines.some((line) => line.includes('z3 -smt2 problem.smt2'))).toBe(true);
      expect(filtered.lines.some((line) => line.includes('python3'))).toBe(false);
      expect(filtered.lines.some((line) => line.includes('z3 -in'))).toBe(false);

      for (let count = 0; count < 3; count += 1) {
        await mounted.press('\u007F');
      }
      await settle();

      expect(spawnedHeights().join(',')).toBe(String(arrivalHeight));
      const restored = replayScreen(mounted.close(), screenRows, SCREEN_COLUMNS);
      expect(restored.scrolled).toBe(0);
      expect(restored.lines[0]?.trimStart().startsWith(HEADER_MARKER)).toBe(true);
      expect(restored.lines.some((line) => line.includes('python3 -c'))).toBe(true);
      expect(restored.lines.some((line) => line.includes('type to filter'))).toBe(true);
    } finally {
      mounted.close();
    }
  });
});

describe('CandidateSelect arrival reset (real hooks, 09-06 truth 3 / D-09)', () => {
  beforeEach(() => {
    spawnMock.mockReset();
    spawnMock.mockImplementation(() => fakeChild());
    resetZellijPaneHeightCache();
  });

  it('a new candidates array resets selection to row 0 and clears every Tab install toggle', async () => {
    const first = annotateCandidates(RAW_CANDIDATES, INVENTORY, 'darwin');
    const installForm = first[0]?.install?.form;
    expect(installForm).toBeTruthy();
    expect(first[1]?.command).not.toBe(first[0]?.command);

    const stdout = new FakeStdout();
    const stdin = new FakeStdin();
    const selections: string[] = [];
    const build = (list: readonly DisplayCandidate[] | null) =>
      React.createElement(CandidateSelect, {
        candidates: list,
        initialQuery: '',
        onSelect: (command: string) => selections.push(command),
        onCancel: () => {},
      });
    const press = async (key: string): Promise<void> => {
      stdin.push(key);
      await new Promise((resolve) => setTimeout(resolve, 50));
      await app.waitUntilRenderFlush();
    };

    const app = render(build(first), {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
      interactive: true,
      patchConsole: false,
      exitOnCtrlC: false,
    });
    try {
      await app.waitUntilRenderFlush();
      // Toggle the install form on flagged row 0, then move selection to row 1.
      await press('\t');
      expect(stdout.writes.join('')).toContain(installForm as string);
      await press('\u001B[B');

      // Arrival: a NEW array (same commands, so a stale toggle keyed by command would survive).
      const second = annotateCandidates(RAW_CANDIDATES, INVENTORY, 'darwin');
      expect(second).not.toBe(first);
      const writesBefore = stdout.writes.length;
      app.rerender(build(second));
      await app.waitUntilRenderFlush();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const frameAfter = stdout.writes.slice(writesBefore).join('');
      expect(frameAfter).not.toContain(installForm as string);

      // Enter inserts exactly the selected row's displayed command.
      await press('\r');
      expect(selections).toEqual([first[0]?.command]);
    } finally {
      app.unmount();
    }
  });
});
