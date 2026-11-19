/**
 * The instant first frame, as one TypeScript reference (Phase 11 D-04; quick 261011-jbh, LD-1).
 *
 * The moment `??` fires, every shell adapter paints a `queque › <lbuffer>` header and a
 * `thinking…` row into the modal surface before Node starts. The adapters paint with their own
 * native, fork-free code (shell/zsh/queque.zsh, shell/bash/queque.bash; fish in Phase 12), so
 * there is no shared painter: this module is the reference every native painter must match
 * byte for byte, and tests/instant-frame-parity.test.ts runs each adapter against it.
 *
 * The client never calls the frame functions at runtime. Its own inline reserve comes from
 * `inlineScrollReserve`, and the inline paint starts with exactly that reserve, so the client's
 * reserve moves nothing after an adapter paint (src/client/instant-frame.ts explains the
 * takeover). The Ink UI reads its sizing constants from here (MODAL_VIEWPORT_LINES, the modal
 * max width, the first loading frame), so the TS side has no second copy.
 *
 * Layering: this module imports nothing from src/client, src/ui, src/cli or src/daemon (it owns
 * the escape constants instead), so the oracle stays loadable on its own.
 */

/** `ESC 7`: save the cursor position. */
export const SAVE_CURSOR = '\u001B7';
/** `ESC 8`: restore the cursor position saved by the last `ESC 7`. */
export const RESTORE_CURSOR = '\u001B8';
/** `CSI J`: erase from the cursor to the end of the screen. */
export const ERASE_BELOW = '\u001B[J';
/** `CSI H`: move the cursor to the top-left cell. */
export const CURSOR_HOME = '\u001B[H';

/**
 * Lines the inline (non-Zellij) client scrolls up before the modal renders, so prior terminal
 * content stays visible above it. Sized for the typical tallest modal: query header (1) +
 * filter (1) + content marginTop (1) + 3 two-line candidates with marginBottom (9) + the
 * destructive ⚠ footer (marginTop + line = 2) + the ⓘ legend (marginTop + line = 2) +
 * controls (marginTop + line = 2) + the update line under the controls (1) = 19.
 * The two footers are separate boxes with their own margins, so each adds two lines. A fixed
 * approximation written before candidates arrive: 5-candidate lists, wrapped rows or a
 * wrapped legend can exceed it.
 */
export const INSTANT_FRAME_VIEWPORT_LINES = 19;

/** The first loading frame (LoadingSpinner FRAMES[0]); the instant frame paints it. */
export const INSTANT_FRAME_LOADING_TEXT = 'thinking…';

/** The modal's maximum width in columns (CandidateSelect / Modal). */
export const MODAL_MAX_COLUMNS = 80;

/** Every value a native painter needs, with the adapter constant it mirrors. */
export const INSTANT_FRAME_SPEC = {
  /** QQ_MODAL_VIEWPORT_LINES */
  viewportLines: INSTANT_FRAME_VIEWPORT_LINES,
  /** QQ_MODAL_MAX_COLUMNS */
  maxColumns: MODAL_MAX_COLUMNS,
  /** QQ_MODAL_PADDING_COLUMNS: Modal paddingX on each side */
  paddingColumns: 1,
  /** QQ_ZELLIJ_FRAME_COLUMNS: floating pane border columns */
  zellijFrameColumns: 2,
  /** QQ_INSTANT_FRAME_ROWS_ABOVE_LOADING: the FILTER row + the content marginTop */
  rowsAboveLoading: 2,
  /** QQ_INSTANT_FRAME_LOADING_TEXT */
  loadingText: INSTANT_FRAME_LOADING_TEXT,
  /** The header row's prefix before the lbuffer */
  headerPrefix: 'queque › ',
  /** QQ_INSTANT_FRAME_FILE: the pane frame file inside the 0700 session dir */
  frameFile: 'instant-frame.txt',
  /** QQ_PANE_PAINT_SCRIPT: the Zellij pane wrapper (cat the frame, exec the client argv) */
  panePaintScript: 'cat "$1" 2>/dev/null; shift; exec "$@"',
} as const;

const DIM = '\u001B[2m';
const UNDIM = '\u001B[22m';
const ELLIPSIS = '…';
const ROW_SEPARATOR = '\r\n';
/** C0, DEL and C1: the shells' `[[:cntrl:]]` in a UTF-8 locale. */
const CONTROL_CHARACTERS = /\p{Cc}/gu;

/**
 * The inline scroll reserve: `lines` newlines scroll just enough history up for the modal,
 * `CSI <lines> A` + `\r` return to the reserve top, and `ESC 7` saves it. Every adapter's
 * inline paint starts with exactly these bytes (tests/instant-frame-parity.test.ts guards the
 * drift; tests/zsh-widget.test.ts z5 still asserts the prefix).
 */
export function inlineScrollReserve(lines: number): string {
  return `${'\n'.repeat(lines)}\u001B[${lines}A\r${SAVE_CURSOR}`;
}

/** Digits only and 1..max, else the max (empty, non-numeric, 0, negative, too wide). */
function frameColumns(columns: string): number {
  if (!/^[0-9]+$/.test(columns)) return INSTANT_FRAME_SPEC.maxColumns;
  const value = Number(columns);
  return value >= 1 && value <= INSTANT_FRAME_SPEC.maxColumns
    ? value
    : INSTANT_FRAME_SPEC.maxColumns;
}

/**
 * The frame rows joined by CR LF: the header (only for a non-empty lbuffer; control
 * characters stripped; cut by code points to the content width with a trailing `…`), the
 * FILTER row and the content margin (blank), then the loading text. Each text row is padded
 * by the Modal padding and dimmed. The header depends on the raw value being non-empty, so a
 * lbuffer of only control characters still shows `queque › `.
 */
export function instantFrameRows(lbuffer: string, columns: string): string {
  const pad = ' '.repeat(INSTANT_FRAME_SPEC.paddingColumns);
  const width = Math.max(1, frameColumns(columns) - 2 * INSTANT_FRAME_SPEC.paddingColumns);
  const rows: string[] = [];
  if (lbuffer !== '') {
    let text = [...`${INSTANT_FRAME_SPEC.headerPrefix}${lbuffer.replace(CONTROL_CHARACTERS, '')}`];
    if (text.length > width) {
      text = [...text.slice(0, width - 1), ELLIPSIS];
    }
    rows.push(`${pad}${DIM}${text.join('')}${UNDIM}`);
  }
  for (let i = 0; i < INSTANT_FRAME_SPEC.rowsAboveLoading; i += 1) rows.push('');
  rows.push(`${pad}${DIM}${INSTANT_FRAME_SPEC.loadingText}${UNDIM}`);
  return rows.join(ROW_SEPARATOR);
}

/** The inline paint: the reserve, an erase below, the rows, then back to the reserve top. */
export function inlineInstantFrameBytes(lbuffer: string, columns: string): string {
  return (
    inlineScrollReserve(INSTANT_FRAME_SPEC.viewportLines) +
    ERASE_BELOW +
    instantFrameRows(lbuffer, columns) +
    RESTORE_CURSOR
  );
}

/** The Zellij pane file: the rows, then the cursor home for the client's absolute clear. */
export function paneInstantFrameBytes(lbuffer: string, columns: string): string {
  return instantFrameRows(lbuffer, columns) + CURSOR_HOME;
}
