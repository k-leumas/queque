/**
 * RED stub (11-06 Task 1): the constants exist so the parity test typechecks; the frame
 * functions throw until GREEN.
 */

export const SAVE_CURSOR = '\u001B7';
export const RESTORE_CURSOR = '\u001B8';
export const ERASE_BELOW = '\u001B[J';
export const CURSOR_HOME = '\u001B[H';
export const INSTANT_FRAME_VIEWPORT_LINES = 18;
export const INSTANT_FRAME_LOADING_TEXT = 'thinking…';
export const MODAL_MAX_COLUMNS = 80;

export const INSTANT_FRAME_SPEC = {
  viewportLines: INSTANT_FRAME_VIEWPORT_LINES,
  maxColumns: MODAL_MAX_COLUMNS,
  paddingColumns: 1,
  zellijFrameColumns: 2,
  rowsAboveLoading: 2,
  loadingText: INSTANT_FRAME_LOADING_TEXT,
  headerPrefix: 'queque › ',
  frameFile: 'instant-frame.txt',
  panePaintScript: 'cat "$1" 2>/dev/null; shift; exec "$@"',
} as const;

export function inlineScrollReserve(_lines: number): string {
  throw new Error('not implemented: inlineScrollReserve (11-06 GREEN)');
}

export function instantFrameRows(_lbuffer: string, _columns: string): string {
  throw new Error('not implemented: instantFrameRows (11-06 GREEN)');
}

export function inlineInstantFrameBytes(_lbuffer: string, _columns: string): string {
  throw new Error('not implemented: inlineInstantFrameBytes (11-06 GREEN)');
}

export function paneInstantFrameBytes(_lbuffer: string, _columns: string): string {
  throw new Error('not implemented: paneInstantFrameBytes (11-06 GREEN)');
}
