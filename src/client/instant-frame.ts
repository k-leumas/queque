/**
 * Instant first frame takeover (quick 261011-jbh, LD-1). RED stub: the public exports exist so
 * the failing regressions typecheck; the behaviour lands in the GREEN commit.
 */

/** `ESC 7`: save the cursor position. */
export const SAVE_CURSOR = '\u001B7';
/** `ESC 8`: restore the cursor position saved by the last `ESC 7`. */
export const RESTORE_CURSOR = '\u001B8';
/** `CSI J`: erase from the cursor to the end of the screen. */
export const ERASE_BELOW = '\u001B[J';
/** `CSI H`: move the cursor to the top-left cell. */
export const CURSOR_HOME = '\u001B[H';
/** `CSI ?2026 h`: begin a synchronized update (Ink wraps every frame in one). */
export const SYNC_UPDATE_BEGIN = '\u001B[?2026h';

/** Inline surface clear: back to the client's own reserve-top save, then erase below. */
export const INLINE_SURFACE_CLEAR = RESTORE_CURSOR + ERASE_BELOW;
/** Zellij pane surface clear: home the cursor, then erase below. */
export const PANE_SURFACE_CLEAR = CURSOR_HOME + ERASE_BELOW;

/** Handle returned by armInstantFrameTakeover. */
export interface InstantFrameTakeover {
  /** Writes the surface clear now if Ink has not drawn yet, then disarms. */
  clearNow(): void;
}

/** The stream shape the takeover wraps (a tty.WriteStream, or a test fake). */
export interface TakeoverStream {
  write(chunk: unknown, ...rest: unknown[]): unknown;
}

export function inlineScrollReserve(_lines: number): string {
  throw new Error('inlineScrollReserve: not implemented');
}

export function armInstantFrameTakeover(
  _stream: TakeoverStream,
  _clear: string,
): InstantFrameTakeover {
  throw new Error('armInstantFrameTakeover: not implemented');
}
