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

import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { render } from 'ink';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  armInstantFrameTakeover,
  INLINE_SURFACE_CLEAR,
  inlineScrollReserve,
  PANE_SURFACE_CLEAR,
  SYNC_UPDATE_BEGIN,
} from '../src/client/instant-frame.js';
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
import {
  type CandidateListState,
  estimateCandidateSelectLines,
  heldPaneLines,
  INCOMPLETE_LIST_NOTE,
  MODAL_VIEWPORT_LINES,
  wrapText,
} from '../src/ui/modal-layout.js';

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
 * so col 0 + next row), `\r`, CSI cursor-move / erase sequences, and `ESC 7` / `ESC 8`
 * (save / restore the cursor row and column; a restore before any save goes to the top-left
 * cell). Colours and private modes (`?2026` synchronized output, `?25` cursor visibility)
 * are ignored. Every glyph in these fixtures (›, ┌, │, ⓘ, ⚠) is one column, as in
 * string-width.
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
  let saved = { row: 0, col: 0 };
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
      } else if (next === '7') {
        index += 1;
        saved = { row, col };
      } else if (next === '8') {
        index += 1;
        row = saved.row;
        col = saved.col;
      } else {
        index += 1; // other two-byte escapes
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

  it('(a) the lbuffer never filters, so the arrival reports only the full-list height and never draws no-matches', async () => {
    const full = estimate(RAW_CANDIDATES, LBUFFER, '');
    // Height of a FILTER pre-filled with the lbuffer (G-09.1-5 regression oracle).
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

  it('(d) an lbuffer that matches a command does not filter the list (G-09.1-5)', async () => {
    const initialQuery = 'smt2';
    // The lbuffer matches one command, so a filter seeded with it would draw fewer rows.
    const filtered = estimate(RAW_CANDIDATES, initialQuery, initialQuery);
    const full = estimate(RAW_CANDIDATES, initialQuery, '');
    expect(filtered).not.toBe(full);

    const reports: number[] = [];
    const writes = await runArrival(RAW_CANDIDATES, initialQuery, (lines) => reports.push(lines));

    // Every report is the unfiltered estimate (the held pane height, quick-261011-f9o).
    expect(reports.length).toBeGreaterThan(0);
    expect(reports).toEqual(reports.map(() => full));
    // The drawn frame is the full list: the lbuffer is only the header, FILTER is empty.
    expect(lastFrameRows(writes)).toBe(full + 1);
    const frame = lastFrame(writes);
    expect(frame).toContain('z3 -smt2 problem.smt2');
    expect(frame).toContain('python3');
    expect(frame).toContain('type to filter');
  });

  it.each([
    {
      name: 'plain',
      build: (): readonly DisplayCandidate[] => RAW_CANDIDATES,
      initialQuery: LBUFFER,
      // The query Ink renders: FILTER opens empty, the lbuffer is only the header (G-09.1-5).
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
      name: 'matching lbuffer',
      build: (): readonly DisplayCandidate[] => RAW_CANDIDATES,
      initialQuery: 'smt2',
      // An lbuffer that matches a command still leaves FILTER empty (G-09.1-5).
      query: '',
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

  it('(g) a new candidates array resets the hold and sizes the pane for the new list', async () => {
    process.env.ZELLIJ = '0';
    process.env.ZELLIJ_PANE_ID = '7';
    process.env.QQ_PANE_HEIGHT = '24';
    const arrival = resolveZellijPaneHeight(estimate(RAW_CANDIDATES, LBUFFER, ''), 24);
    const requery = [RAW_CANDIDATES[0] as CommandCandidate];
    const requeryHeight = resolveZellijPaneHeight(estimate(requery, LBUFFER, ''), 24);
    expect(requeryHeight).toBeLessThan(arrival);

    const mounted = await mountArrival(RAW_CANDIDATES, LBUFFER, syncZellijFloatingPaneHeight);
    try {
      await settle();
      expect(spawnedHeights().join(',')).toBe(String(arrival));

      // A re-query (a NEW array) is not held at the old list's height (decision 4).
      await mounted.rerender(requery);
      await settle();
      expect(spawnedHeights().join(',')).toBe(`${arrival},${requeryHeight}`);
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

  // Rewritten on purpose in 09.1-07 (D-06): this test used to assert that a new candidates
  // array resets selection to row 0 and clears every Tab toggle. Streaming sends a new array
  // per arrival, so the reset now runs only on the first arrival; a later array keeps the
  // highlighted row (by candidateKey) and the Tab toggles (keyed by candidateKey too).
  it('a later arrival keeps the highlighted row and its Tab toggle; the reset runs only on the first arrival', async () => {
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

      // A later arrival: a NEW array with the same rows (what run-foreground sends per row).
      const second = annotateCandidates(RAW_CANDIDATES, INVENTORY, 'darwin');
      expect(second).not.toBe(first);
      app.rerender(build(second));
      await app.waitUntilRenderFlush();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Enter inserts exactly the highlighted row's displayed command: row 1, untoggled.
      await press('\r');
      // Back on row 0, Enter inserts its install form: the toggle survived the arrival.
      await press('\u001B[A');
      await press('\r');
      expect(selections).toEqual([first[1]?.command, installForm]);
    } finally {
      app.unmount();
    }
  });
});

// ---------------------------------------------------------------------------
// Streamed rows (09.1-07, D-05 client half, D-06 to D-10, D-17): run-foreground rerenders
// with a new array per arrived row and `listState: 'arriving'`, then once with the final
// list and `'complete'`. Real hooks, as in the describes above.
// ---------------------------------------------------------------------------

/** The selection glyph on the highlighted row's first line (CandidateSelect.tsx ACTIVE_HEAD). */
const ACTIVE_HEAD_MARK = '┌> ';

/** An lbuffer no row matches; it only ever shows in the `queque ›` header (G-09.1-5). */
const STREAM_LBUFFER = 'show me the history';

const GIT_STATUS: CommandCandidate = { command: 'git status', explanation: 'working tree' };
const GIT_LOG: CommandCandidate = { command: 'git log', explanation: 'commit history' };
const GIT_LOG_ONELINE: CommandCandidate = {
  command: 'git log --oneline',
  explanation: 'one line per commit',
};
const LS_LA: CommandCandidate = { command: 'ls -la', explanation: 'list files' };

/** The first frame line carrying the selection glyph. */
function highlightedLine(writes: readonly string[]): string {
  const line = lastFrame(writes)
    .split('\n')
    .find((text) => text.includes(ACTIVE_HEAD_MARK));
  if (line === undefined) {
    throw new Error('the last frame has no highlighted row');
  }
  return line;
}

/** The first wrapped line of a command as the row shows it. */
function firstRowLine(command: string): string {
  return wrapText(command, CONTENT_WIDTH)[0] ?? '';
}

/** A CandidateSelect mounted in the loading state that rows then stream into. */
interface MountedStream {
  stdout: FakeStdout;
  /** Commands passed to onSelect, in order. */
  selections: string[];
  /** Rerenders with a new rows array and list state, then waits for the flush. */
  arrive: (list: readonly DisplayCandidate[], listState: CandidateListState) => Promise<void>;
  /** Pushes one key to stdin, waits 50 ms, then waits for Ink to flush the render. */
  press: (key: string) => Promise<void>;
  /** Copies every chunk written so far, then unmounts. Safe to call more than once. */
  close: () => string[];
}

/** Mirrors run-foreground.ts streaming: loading first, then one rerender per arrival. */
async function mountStream(
  initialQuery: string,
  onLayoutLinesChange?: (lines: number) => void,
): Promise<MountedStream> {
  const stdout = new FakeStdout();
  const stdin = new FakeStdin();
  const selections: string[] = [];
  const build = (list: readonly DisplayCandidate[] | null, listState: CandidateListState) =>
    React.createElement(CandidateSelect, {
      candidates: list,
      initialQuery,
      listState,
      onSelect: (command: string) => selections.push(command),
      onCancel: () => {},
      onLayoutLinesChange,
    });

  const app = render(build(null, 'arriving'), {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    interactive: true,
    patchConsole: false,
    exitOnCtrlC: false,
  });
  let closedWrites: string[] | undefined;
  const close = (): string[] => {
    if (closedWrites === undefined) {
      closedWrites = [...stdout.writes];
      app.unmount();
    }
    return closedWrites;
  };
  try {
    await app.waitUntilRenderFlush();
  } catch (error) {
    close();
    throw error;
  }

  return {
    stdout,
    selections,
    arrive: async (list, listState) => {
      app.rerender(build(list, listState));
      await app.waitUntilRenderFlush();
    },
    press: async (key: string): Promise<void> => {
      stdin.push(key);
      await new Promise((resolve) => setTimeout(resolve, 50));
      await app.waitUntilRenderFlush();
    },
    close,
  };
}

describe('CandidateSelect streamed rows (real hooks, 09.1-07)', () => {
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

  it('D-06/D-07: the first row is highlighted, later rows never move it, Enter works mid-stream', async () => {
    const mounted = await mountStream(STREAM_LBUFFER);
    try {
      await mounted.arrive([GIT_STATUS], 'arriving');
      await mounted.arrive([GIT_STATUS, GIT_LOG], 'arriving');
      expect(highlightedLine(mounted.stdout.writes)).toContain(GIT_STATUS.command);

      await mounted.press('\u001B[B');
      expect(highlightedLine(mounted.stdout.writes)).toContain(GIT_LOG.command);

      await mounted.arrive([GIT_STATUS, GIT_LOG, LS_LA], 'arriving');
      expect(highlightedLine(mounted.stdout.writes)).toContain(GIT_LOG.command);

      await mounted.press('\r');
      expect(mounted.selections).toEqual([GIT_LOG.command]);
    } finally {
      mounted.close();
    }
  });

  it('D-06: the moved highlight and its Tab install form survive the third arrival and completion', async () => {
    const rows = annotateCandidates(RAW_CANDIDATES, INVENTORY, 'darwin');
    const [r0, r1, r2] = rows as [DisplayCandidate, DisplayCandidate, DisplayCandidate];
    const r1Form = r1.install?.form;
    expect(r0.install?.form).toBeTruthy();
    expect(r1Form).toBeTruthy();

    const mounted = await mountStream(LBUFFER);
    try {
      await mounted.arrive([r0], 'arriving');
      await mounted.arrive([r0, r1], 'arriving');
      await mounted.press('\u001B[B');
      await mounted.press('\t');
      expect(highlightedLine(mounted.stdout.writes)).toContain(firstRowLine(r1Form as string));

      await mounted.arrive([r0, r1, r2], 'arriving');
      expect(highlightedLine(mounted.stdout.writes)).toContain(firstRowLine(r1Form as string));

      // Completion: the final list as a new array of new objects, as run-foreground sends it.
      await mounted.arrive(annotateCandidates(RAW_CANDIDATES, INVENTORY, 'darwin'), 'complete');
      expect(highlightedLine(mounted.stdout.writes)).toContain(firstRowLine(r1Form as string));

      await mounted.press('\r');
      expect(mounted.selections).toEqual([r1Form]);
    } finally {
      mounted.close();
    }
  });

  it('D-08: the thinking row sits below the last arrived row and goes away on completion', async () => {
    const mounted = await mountStream(STREAM_LBUFFER);
    try {
      await mounted.arrive([GIT_STATUS, GIT_LOG], 'arriving');
      const arriving = lastFrame(mounted.stdout.writes).split('\n');
      const spinnerRow = arriving.findIndex((line) => line.includes('thinking'));
      const lastRow = arriving.findIndex((line) => line.includes(GIT_LOG.explanation));
      expect(spinnerRow).toBeGreaterThan(-1);
      expect(spinnerRow).toBeGreaterThan(lastRow);
      expect(lastRow).toBeGreaterThan(-1);

      await mounted.arrive([GIT_STATUS, GIT_LOG], 'complete');
      expect(lastFrame(mounted.stdout.writes)).not.toContain('thinking');
    } finally {
      mounted.close();
    }
  });

  it('D-09: a typed filter also filters rows that arrive later', async () => {
    const mounted = await mountStream(STREAM_LBUFFER);
    try {
      await mounted.arrive([GIT_STATUS, GIT_LOG], 'arriving');
      for (const key of ['l', 'o', 'g']) {
        await mounted.press(key);
      }
      let frame = lastFrame(mounted.stdout.writes);
      expect(frame).toContain(GIT_LOG.command);
      expect(frame).not.toContain(GIT_STATUS.command);

      await mounted.arrive([GIT_STATUS, GIT_LOG, GIT_LOG_ONELINE], 'arriving');
      frame = lastFrame(mounted.stdout.writes);
      expect(frame).toContain(GIT_LOG_ONELINE.command);
      expect(frame).not.toContain(GIT_STATUS.command);

      await mounted.arrive([GIT_STATUS, GIT_LOG, GIT_LOG_ONELINE, LS_LA], 'arriving');
      frame = lastFrame(mounted.stdout.writes);
      expect(frame).toContain('FILTER: log');
      expect(frame).not.toContain(LS_LA.command);
    } finally {
      mounted.close();
    }
  });

  it('G-09.1-5: the lbuffer never filters streamed rows and FILTER shows the placeholder', async () => {
    const mounted = await mountStream(STREAM_LBUFFER);
    try {
      await mounted.arrive([GIT_STATUS], 'arriving');
      await mounted.arrive([GIT_STATUS, LS_LA], 'arriving');
      const frame = lastFrame(mounted.stdout.writes);
      expect(frame).toContain(GIT_STATUS.command);
      expect(frame).toContain(LS_LA.command);
      expect(frame).not.toContain('no matches');
      expect(frame).not.toContain(`FILTER: ${STREAM_LBUFFER}`);
      expect(frame).toContain('type to filter');
    } finally {
      mounted.close();
    }
  });

  it('WR-04: a filter typed while loading survives a first row that does not match it', async () => {
    const rgFoo: CommandCandidate = { command: 'rg foo', explanation: 'search with ripgrep' };
    const grepFoo: CommandCandidate = { command: 'grep -r foo .', explanation: 'search tree' };
    // FILTER opens empty under the lbuffer `gr`; the user types `grep` while `thinking…` shows.
    const mounted = await mountStream('gr');
    try {
      for (const key of ['g', 'r', 'e', 'p']) {
        await mounted.press(key);
      }
      await mounted.arrive([rgFoo], 'arriving');
      expect(lastFrame(mounted.stdout.writes)).toContain('FILTER: grep');
      expect(lastFrame(mounted.stdout.writes)).not.toContain('FILTER: grgrep');

      await mounted.arrive([rgFoo, grepFoo], 'arriving');
      const frame = lastFrame(mounted.stdout.writes);
      expect(frame).toContain('FILTER: grep');
      expect(frame).toContain(grepFoo.command);
      expect(frame).not.toContain(rgFoo.command);
    } finally {
      mounted.close();
    }
  });

  it('WR-05: a later list without the highlighted row keeps the highlight position', async () => {
    const pwd: CommandCandidate = { command: 'pwd', explanation: 'print directory' };
    const du: CommandCandidate = { command: 'du -sh .', explanation: 'disk usage' };
    const mounted = await mountStream('git');
    try {
      await mounted.arrive([GIT_STATUS, GIT_LOG], 'arriving');
      await mounted.press('\u001B[B');
      expect(highlightedLine(mounted.stdout.writes)).toContain(GIT_LOG.command);

      // The final list has no `git` row, so the highlighted key is gone: the index is clamped
      // onto the second row instead of jumping back to the first.
      await mounted.arrive([LS_LA, pwd, du], 'complete');
      await settle();
      expect(lastFrame(mounted.stdout.writes)).not.toContain('FILTER: git');
      expect(highlightedLine(mounted.stdout.writes)).toContain(pwd.command);

      await mounted.press('\r');
      expect(mounted.selections).toEqual([pwd.command]);
    } finally {
      mounted.close();
    }
  });

  it('WR-05: typing and Backspace move the highlight to the first visible row', async () => {
    const mounted = await mountStream(STREAM_LBUFFER);
    try {
      await mounted.arrive([GIT_STATUS, GIT_LOG], 'complete');
      await mounted.press('\u001B[B');
      expect(highlightedLine(mounted.stdout.writes)).toContain(GIT_LOG.command);

      await mounted.press('g');
      expect(highlightedLine(mounted.stdout.writes)).toContain(GIT_STATUS.command);

      await mounted.press('\u001B[B');
      expect(highlightedLine(mounted.stdout.writes)).toContain(GIT_LOG.command);
      await mounted.press('\u007F');
      expect(lastFrame(mounted.stdout.writes)).not.toContain('FILTER: g');
      expect(highlightedLine(mounted.stdout.writes)).toContain(GIT_STATUS.command);
    } finally {
      mounted.close();
    }
  });

  it.each([
    ['down', '\u001B[B'],
    ['up', '\u001B[A'],
  ])('WR-06: %s on an empty filtered list still highlights the next matching row', async (_name, arrow) => {
    const rgFoo: CommandCandidate = { command: 'rg foo', explanation: 'search with ripgrep' };
    const grepFoo: CommandCandidate = { command: 'grep -r foo .', explanation: 'search tree' };
    const mounted = await mountStream('gr');
    try {
      for (const key of ['g', 'r', 'e', 'p']) {
        await mounted.press(key);
      }
      await mounted.arrive([rgFoo], 'arriving');
      // Nothing matches `grep` yet: the arrow key must not corrupt the index (NaN or -1).
      await mounted.press(arrow);
      await mounted.press(arrow);

      await mounted.arrive([rgFoo, grepFoo], 'arriving');
      expect(highlightedLine(mounted.stdout.writes)).toContain(grepFoo.command);
      await mounted.press('\u001B[B');
      expect(highlightedLine(mounted.stdout.writes)).toContain(grepFoo.command);

      await mounted.press('\r');
      expect(mounted.selections).toEqual([grepFoo.command]);
    } finally {
      mounted.close();
    }
  });

  it('D-10/D-17: in Zellij no resize while rows arrive, one at completion, none when filtering after', async () => {
    process.env.ZELLIJ = '0';
    process.env.ZELLIJ_PANE_ID = '7';
    process.env.QQ_PANE_HEIGHT = '24';

    const mounted = await mountStream(LBUFFER, syncZellijFloatingPaneHeight);
    try {
      for (let count = 1; count <= RAW_CANDIDATES.length; count += 1) {
        await mounted.arrive(RAW_CANDIDATES.slice(0, count), 'arriving');
      }
      await settle();
      // Scalar first, so a RED failure is a one-line message.
      expect(spawnedHeights().join(',')).toBe('');

      const final = [...RAW_CANDIDATES];
      await mounted.arrive(final, 'complete');
      await settle();
      const expected = resolveZellijPaneHeight(
        heldPaneLines(0, {
          candidates: final,
          initialQuery: LBUFFER,
          query: '',
          selectedIndex: 0,
          contentWidth: CONTENT_WIDTH,
          includeDevFooter: false,
          installToggled: new Set(),
          listState: 'complete',
        }),
        24,
      );
      expect(spawnedHeights().join(',')).toBe(String(expected));

      for (const key of ['s', 'm', 't']) {
        await mounted.press(key);
      }
      await settle();
      expect(spawnedHeights().join(',')).toBe(String(expected));
    } finally {
      mounted.close();
    }
  });

  it('D-16: a partial list shows the incomplete note below the rows, no spinner, and Enter still selects', async () => {
    const mounted = await mountStream(STREAM_LBUFFER);
    try {
      await mounted.arrive([GIT_STATUS, GIT_LOG], 'arriving');
      await mounted.arrive([GIT_STATUS, GIT_LOG], 'partial');
      const frame = lastFrame(mounted.stdout.writes).split('\n');
      const noteRow = frame.findIndex((line) => line.includes(INCOMPLETE_LIST_NOTE));
      const lastRow = frame.findIndex((line) => line.includes(GIT_LOG.explanation));
      expect(lastRow).toBeGreaterThan(-1);
      expect(noteRow).toBeGreaterThan(lastRow);
      expect(frame.join('\n')).not.toContain('thinking');

      await mounted.press('\u001B[B');
      await mounted.press('\r');
      expect(mounted.selections).toEqual([GIT_LOG.command]);
    } finally {
      mounted.close();
    }
  });

  it('D-16/D-17: in Zellij a partial list reports once, like a complete one', async () => {
    process.env.ZELLIJ = '0';
    process.env.ZELLIJ_PANE_ID = '7';
    process.env.QQ_PANE_HEIGHT = '24';

    const mounted = await mountStream(LBUFFER, syncZellijFloatingPaneHeight);
    try {
      await mounted.arrive(RAW_CANDIDATES.slice(0, 1), 'arriving');
      await mounted.arrive(RAW_CANDIDATES.slice(0, 2), 'arriving');
      await settle();
      expect(spawnedHeights().join(',')).toBe('');

      const partial = RAW_CANDIDATES.slice(0, 2);
      await mounted.arrive(partial, 'partial');
      await settle();
      const expected = resolveZellijPaneHeight(
        heldPaneLines(0, {
          candidates: partial,
          initialQuery: LBUFFER,
          query: '',
          selectedIndex: 0,
          contentWidth: CONTENT_WIDTH,
          includeDevFooter: false,
          installToggled: new Set(),
          listState: 'partial',
        }),
        24,
      );
      expect(spawnedHeights().join(',')).toBe(String(expected));
    } finally {
      mounted.close();
    }
  });
});

// ---------------------------------------------------------------------------
// G-09.1-5 (UAT 09.1 test 5): FILTER opens empty and the lbuffer shows only in the dim
// `queque ›` header. Text typed while `thinking…` shows is the whole filter and keeps
// filtering every row that arrives later (D-09). Supersedes 03.1 D-01/D-02.
// ---------------------------------------------------------------------------

/** The FILTER row on an empty query (SearchInput.tsx placeholder). */
const FILTER_PLACEHOLDER = 'FILTER: type to filter…';

/**
 * The FILTER row of Ink's last frame that has one, trimmed. Unlike `lastFrame` it needs no
 * `queque ›` header, so it also works for an empty lbuffer.
 */
function filterLine(writes: readonly string[]): string {
  for (let index = writes.length - 1; index >= 0; index -= 1) {
    const line = stripVTControlCharacters(writes[index] ?? '')
      .split('\n')
      .find((text) => text.includes('FILTER:'));
    if (line !== undefined) {
      return line.trim();
    }
  }
  throw new Error('Ink never wrote a frame containing the FILTER row');
}

describe('G-09.1-5: FILTER opens empty; the lbuffer is only the header (real hooks, supersedes 03.1 D-01/D-02)', () => {
  const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};
  const [smtRow, stdinRow, pythonRow] = RAW_CANDIDATES as [
    CommandCandidate,
    CommandCandidate,
    CommandCandidate,
  ];

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

  it('G-09.1-5 UAT case: `smt` typed while thinking is the whole filter, not the lbuffer plus `smt`', async () => {
    const mounted = await mountStream(LBUFFER);
    try {
      // The lbuffer is the header; FILTER below it opens empty.
      expect(lastFrame(mounted.stdout.writes)).toContain(`queque › ${LBUFFER}`);
      expect(filterLine(mounted.stdout.writes)).toBe(FILTER_PLACEHOLDER);

      for (const key of ['s', 'm', 't']) {
        await mounted.press(key);
      }
      expect(filterLine(mounted.stdout.writes)).toBe('FILTER: smt');

      // A first row that does not match keeps the typed filter (WR-04 intent).
      await mounted.arrive([stdinRow], 'arriving');
      expect(filterLine(mounted.stdout.writes)).toBe('FILTER: smt');

      await mounted.arrive([stdinRow, smtRow], 'arriving');
      expect(lastFrame(mounted.stdout.writes)).toContain(smtRow.command);

      await mounted.arrive([stdinRow, smtRow, pythonRow], 'complete');
      expect(filterLine(mounted.stdout.writes)).toBe('FILTER: smt');
      const frame = lastFrame(mounted.stdout.writes);
      expect(frame).toContain(smtRow.command);
      expect(frame).not.toContain('python3');
      expect(frame).not.toContain('declare-const');
      expect(frame).not.toContain('no matches');

      await mounted.press('\r');
      expect(mounted.selections).toEqual([smtRow.command]);

      // Backspacing the typed filter away brings back the placeholder and the full list.
      for (let count = 0; count < 3; count += 1) {
        await mounted.press('\u007F');
      }
      expect(filterLine(mounted.stdout.writes)).toBe(FILTER_PLACEHOLDER);
      expect(lastFrame(mounted.stdout.writes)).toContain('python3');
    } finally {
      mounted.close();
    }
  });

  it('G-09.1-5: an empty lbuffer opens on the placeholder and typed `smt` filters the streamed rows', async () => {
    const mounted = await mountStream('');
    try {
      expect(filterLine(mounted.stdout.writes)).toBe(FILTER_PLACEHOLDER);

      for (const key of ['s', 'm', 't']) {
        await mounted.press(key);
      }
      expect(filterLine(mounted.stdout.writes)).toBe('FILTER: smt');

      await mounted.arrive([stdinRow], 'arriving');
      await mounted.arrive([stdinRow, smtRow], 'arriving');
      await mounted.arrive([stdinRow, smtRow, pythonRow], 'complete');
      await mounted.press('\r');
      expect(mounted.selections).toEqual([smtRow.command]);
    } finally {
      mounted.close();
    }
  });

  it('G-09.1-5: typed text equal to the lbuffer is the filter once, and survives a non-matching first row', async () => {
    const mounted = await mountStream('smt');
    try {
      for (const key of ['s', 'm', 't']) {
        await mounted.press(key);
      }
      expect(filterLine(mounted.stdout.writes)).toBe('FILTER: smt');

      // The old guard treated a query equal to the lbuffer as untouched and cleared it here.
      await mounted.arrive([stdinRow], 'arriving');
      expect(filterLine(mounted.stdout.writes)).toBe('FILTER: smt');

      await mounted.arrive([stdinRow, smtRow, pythonRow], 'complete');
      const frame = lastFrame(mounted.stdout.writes);
      expect(frame).toContain(smtRow.command);
      expect(frame).not.toContain('python3');

      await mounted.press('\r');
      expect(mounted.selections).toEqual([smtRow.command]);
    } finally {
      mounted.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Instant frame takeover (quick 261011-jbh, LD-1): the zsh widget paints the header and a
// loading row before Node starts; Ink's first frame must replace them in place. The widget
// bytes come from the real widget (spawnSync zsh), the frame from a real Ink render.
// ---------------------------------------------------------------------------

const WIDGET_PATH = fileURLToPath(new URL('../shell/zsh/queque.zsh', import.meta.url));

/** Rows of the replay screen (FakeStdout.rows, also the Zellij pane minus its chrome). */
const SCREEN_ROWS = 22;

/** The loading row of the instant frame and of Ink's loading frame (LoadingSpinner FRAMES[0]). */
const LOADING_ROW = ' thinking…';

/** Runs a widget helper with `args` as positional parameters (never interpolated). */
function zshHelperOutput(script: string, args: readonly string[]): string {
  const result = spawnSync('zsh', ['-f', '-c', `source "$0"\n${script}`, WIDGET_PATH, ...args], {
    encoding: 'utf8',
    timeout: 5000,
  });
  if (result.status !== 0) {
    throw new Error(`zsh helper failed: ${result.stderr}`);
  }
  return result.stdout;
}

/** The bytes the widget paints inline for `lbuffer` at SCREEN_COLUMNS. */
function widgetInlineBytes(lbuffer: string): string {
  return zshHelperOutput('_qq_inline_instant_frame_bytes "$1" "$2"; print -rn -- "$REPLY"', [
    lbuffer,
    String(SCREEN_COLUMNS),
  ]);
}

/** The pane frame file the widget writes for `lbuffer` (the pane wrapper cats it). */
function widgetPaneFrame(lbuffer: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'qq-pane-frame-'));
  try {
    zshHelperOutput('_qq_write_pane_instant_frame "$1" "$2" "$3"', [
      dir,
      lbuffer,
      String(SCREEN_COLUMNS),
    ]);
    return readFileSync(join(dir, 'instant-frame.txt'), 'utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Every chunk a real Ink render of CandidateSelect's loading state writes up to its first
 * flushed frame, on a FakeStdout armed with the takeover (`clear`), as run-foreground.ts does.
 */
async function inkLoadingWrites(initialQuery: string, clear: string): Promise<string[]> {
  const stdout = new FakeStdout();
  const stdin = new FakeStdin();
  armInstantFrameTakeover(stdout, clear);
  const app = render(
    React.createElement(CandidateSelect, {
      candidates: null,
      initialQuery,
      onSelect: () => {},
      onCancel: () => {},
    }),
    {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
      interactive: true,
      patchConsole: false,
      exitOnCtrlC: false,
    },
  );
  try {
    await app.waitUntilRenderFlush();
    return [...stdout.writes];
  } finally {
    app.unmount();
  }
}

/** Content rows of Ink's first frame (its trailing newline leaves the cursor below them). */
function firstFrameRows(writes: readonly string[]): number {
  const frame = writes
    .map((chunk) => stripVTControlCharacters(chunk))
    .find((text) => text.includes(HEADER_MARKER));
  if (frame === undefined) {
    throw new Error('Ink never wrote a frame containing the header');
  }
  return frame.split('\n').length - 1;
}

/** Indexes of the screen rows that contain the header. */
function headerRows(lines: readonly string[]): number[] {
  return lines.flatMap((line, index) => (line.includes(HEADER_MARKER) ? [index] : []));
}

/** A full screen of history with the prompt and the typed query on the last row. */
function fullScreenPrompt(lbuffer: string): string {
  const history = Array.from({ length: SCREEN_ROWS - 1 }, (_, row) => `history ${row}\n`);
  return `${history.join('')}% ${lbuffer}?`;
}

/** Replays the inline handoff: the screen after the widget paint, and after Ink's first frame. */
async function inlineTakeover(
  prior: string,
  lbuffer: string,
): Promise<{
  before: ReturnType<typeof replayScreen>;
  after: ReturnType<typeof replayScreen>;
  ink: string[];
}> {
  const widget = widgetInlineBytes(lbuffer);
  const ink = await inkLoadingWrites(lbuffer, INLINE_SURFACE_CLEAR);
  const before = replayScreen([prior, widget], SCREEN_ROWS, SCREEN_COLUMNS);
  const after = replayScreen(
    [prior, widget, inlineScrollReserve(MODAL_VIEWPORT_LINES), ...ink],
    SCREEN_ROWS,
    SCREEN_COLUMNS,
  );
  return { before, after, ink };
}

/** A recording Writable for the takeover unit cases. */
class RecordingStream extends Writable {
  readonly chunks: string[] = [];

  override _write(chunk: unknown, _encoding: BufferEncoding, callback: () => void): void {
    this.chunks.push(String(chunk));
    callback();
  }
}

describe('instant frame takeover (quick 261011-jbh)', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it('t1: inline, full screen — one header on the instant frame row, no residue, no extra scroll', async () => {
    const { before, after } = await inlineTakeover(fullScreenPrompt(LBUFFER), LBUFFER);
    expect(headerRows(after.lines).length).toBe(1);
    const h = SCREEN_ROWS - 1 - MODAL_VIEWPORT_LINES;
    expect(headerRows(before.lines)).toEqual([h]);
    expect(before.lines[h + 3]).toBe(LOADING_ROW);
    expect(headerRows(after.lines)).toEqual([h]);
    expect(after.lines[h + 1]?.trimStart().startsWith('FILTER:')).toBe(true);
    expect(after.lines[h + 3]).toBe(before.lines[h + 3]);
    expect(after.lines.slice(0, h)).toEqual(before.lines.slice(0, h));
    expect(after.scrolled).toBe(before.scrolled);
  });

  it('t2: inline, cleared screen — the same handoff on row 0 with no scroll', async () => {
    const { before, after } = await inlineTakeover(`% ${LBUFFER}?`, LBUFFER);
    expect(headerRows(before.lines)).toEqual([0]);
    expect(before.lines[3]).toBe(LOADING_ROW);
    expect(headerRows(after.lines)).toEqual([0]);
    expect(after.lines[1]?.trimStart().startsWith('FILTER:')).toBe(true);
    expect(after.lines[3]).toBe(before.lines[3]);
    expect(before.scrolled).toBe(0);
    expect(after.scrolled).toBe(0);
  });

  it('t3: Zellij pane — the pane frame is replaced in place and nothing survives below Ink', async () => {
    const frame = widgetPaneFrame(LBUFFER);
    const ink = await inkLoadingWrites(LBUFFER, PANE_SURFACE_CLEAR);
    const before = replayScreen([frame], SCREEN_ROWS, SCREEN_COLUMNS);
    const after = replayScreen([frame, ...ink], SCREEN_ROWS, SCREEN_COLUMNS);
    expect(headerRows(before.lines)).toEqual([0]);
    expect(before.lines[3]).toBe(LOADING_ROW);
    expect(headerRows(after.lines)).toEqual([0]);
    expect(after.lines[3]).toBe(before.lines[3]);
    expect(after.scrolled).toBe(0);
    expect(after.lines.slice(firstFrameRows(ink)).filter((line) => line !== '')).toEqual([]);
  });

  it('t4: inline, a 200-character lbuffer leaves one header and no instant-frame residue', async () => {
    const long = 'a'.repeat(200);
    const { before, after, ink } = await inlineTakeover(fullScreenPrompt(long), long);
    const h = SCREEN_ROWS - 1 - MODAL_VIEWPORT_LINES;
    expect(headerRows(before.lines)).toEqual([h]);
    expect(headerRows(after.lines)).toEqual([h]);
    expect(after.lines.slice(0, h)).toEqual(before.lines.slice(0, h));
    expect(after.lines.slice(h + firstFrameRows(ink)).filter((line) => line !== '')).toEqual([]);
  });

  it('t5: no instant frame (older widget or kill switch) — one header on the reserve top', async () => {
    const prior = fullScreenPrompt(LBUFFER);
    const reserve = inlineScrollReserve(MODAL_VIEWPORT_LINES);
    const ink = await inkLoadingWrites(LBUFFER, INLINE_SURFACE_CLEAR);
    const reserveOnly = replayScreen([prior, reserve], SCREEN_ROWS, SCREEN_COLUMNS);
    const after = replayScreen([prior, reserve, ...ink], SCREEN_ROWS, SCREEN_COLUMNS);
    const top = SCREEN_ROWS - 1 - MODAL_VIEWPORT_LINES;
    expect(headerRows(after.lines)).toEqual([top]);
    expect(after.scrolled).toBe(reserveOnly.scrolled);
    expect(after.lines.slice(0, top)).toEqual(reserveOnly.lines.slice(0, top));
  });

  it('t6: control-only chunks pass; the first visible chunk gets the clear, once', () => {
    const stream = new RecordingStream();
    const clear = INLINE_SURFACE_CLEAR;
    armInstantFrameTakeover(stream, clear);
    stream.write('\u001B[?25l');
    stream.write('\n\n');
    stream.write('\u001B[3A');
    stream.write(`${SYNC_UPDATE_BEGIN} queque › x`);
    stream.write('later');
    expect(stream.chunks).toEqual([
      '\u001B[?25l',
      '\n\n',
      '\u001B[3A',
      `${SYNC_UPDATE_BEGIN}${clear} queque › x`,
      'later',
    ]);
  });

  it('t6: a visible chunk without a synchronized-update begin gets the clear prepended', () => {
    const stream = new RecordingStream();
    armInstantFrameTakeover(stream, PANE_SURFACE_CLEAR);
    stream.write(SYNC_UPDATE_BEGIN);
    stream.write(' queque › x\n');
    stream.write(' queque › y\n');
    expect(stream.chunks).toEqual([
      SYNC_UPDATE_BEGIN,
      `${PANE_SURFACE_CLEAR} queque › x\n`,
      ' queque › y\n',
    ]);
  });

  it('t6: clearNow() writes the clear once, then disarms; after the injection it writes nothing', () => {
    const early = new RecordingStream();
    const takeover = armInstantFrameTakeover(early, INLINE_SURFACE_CLEAR);
    takeover.clearNow();
    takeover.clearNow();
    early.write('error text');
    expect(early.chunks).toEqual([INLINE_SURFACE_CLEAR, 'error text']);

    const late = new RecordingStream();
    const fired = armInstantFrameTakeover(late, INLINE_SURFACE_CLEAR);
    late.write('frame');
    fired.clearNow();
    expect(late.chunks).toEqual([`${INLINE_SURFACE_CLEAR}frame`]);
  });

  it('t6: every write argument is forwarded, and an own-property write keeps working', async () => {
    const stream = new RecordingStream();
    armInstantFrameTakeover(stream, INLINE_SURFACE_CLEAR);
    const callback = vi.fn();
    stream.write('frame', 'utf8', callback);
    await new Promise((resolve) => setImmediate(resolve));
    expect(stream.chunks).toEqual([`${INLINE_SURFACE_CLEAR}frame`]);
    expect(callback).toHaveBeenCalledTimes(1);

    const fake = {
      chunks: [] as string[],
      write(chunk: unknown): boolean {
        fake.chunks.push(String(chunk));
        return true;
      },
    };
    armInstantFrameTakeover(fake, PANE_SURFACE_CLEAR);
    expect(fake.write('a')).toBe(true);
    expect(fake.write('b')).toBe(true);
    expect(fake.chunks).toEqual([`${PANE_SURFACE_CLEAR}a`, 'b']);
  });
});
