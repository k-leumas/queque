/**
 * Instant first frame takeover (quick 261011-jbh, LD-1).
 *
 * The zsh widget paints a `queque › <lbuffer>` header and a `thinking…` row the moment `??`
 * fires, before Node starts (shell/zsh/queque.zsh `_qq_paint_inline_instant_frame`, or the
 * Zellij pane wrapper that cats `instant-frame.txt`). This module lets the Ink client take that
 * surface over in its own first frame: `armInstantFrameTakeover` wraps the client's tty write
 * stream once and inserts a surface clear into the first write that carries visible text, so
 * the clear and Ink's frame land in one write (inside Ink's synchronized update when present).
 *
 * Why the clears are safe:
 * - Inline: the client writes `inlineScrollReserve(MODAL_VIEWPORT_LINES)` itself at the start
 *   of its llm branch. It is byte-identical to the widget's reserve, so after the widget's paint
 *   it moves nothing, and it ends with a fresh `ESC 7` on the reserve top. Every inline clear
 *   (`ESC 8` + `CSI J`) therefore restores the client's own save, never a stale one left by
 *   someone else, even with an older widget or `QQ_INSTANT_FRAME=0`.
 * - Zellij: the pane clear is absolute (`CSI H` + `CSI J`) on a pane the client owns.
 */
import { stripVTControlCharacters } from 'node:util';

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
  /** Writes the surface clear now if no visible text was written yet, then disarms. */
  clearNow(): void;
}

/** The stream shape the takeover wraps (a tty.WriteStream, or a test fake). */
export interface TakeoverStream {
  write(chunk: unknown, ...rest: unknown[]): unknown;
}

/**
 * The inline scroll reserve: `lines` newlines scroll just enough history up for the modal,
 * `CSI <lines> A` + `\r` return to the reserve top, and `ESC 7` saves it. The widget's inline
 * paint starts with exactly these bytes (tests/zsh-widget.test.ts z5 guards the drift).
 */
export function inlineScrollReserve(lines: number): string {
  return `${'\n'.repeat(lines)}\u001B[${lines}A\r${SAVE_CURSOR}`;
}

/** True when the chunk draws something: text left after removing escapes and whitespace. */
function hasVisibleText(chunk: unknown): boolean {
  const text = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString() : '';
  return stripVTControlCharacters(text).trim() !== '';
}

/**
 * Arms a one-shot takeover on `stream`. Control-only writes (cursor hide, newlines, cursor
 * moves, a lone synchronized-update begin) pass through unchanged. The first write with
 * visible text gets `clear` inserted right after a leading SYNC_UPDATE_BEGIN, or prepended;
 * then the original `write` is put back. `clearNow()` writes `clear` while still armed.
 */
export function armInstantFrameTakeover(
  stream: TakeoverStream,
  clear: string,
): InstantFrameTakeover {
  const originalWrite = stream.write;
  let armed = true;

  const disarm = (): void => {
    if (!armed) return;
    armed = false;
    // Reassign rather than delete: test fakes define `write` as an own property.
    stream.write = originalWrite;
  };

  stream.write = function takeoverWrite(chunk: unknown, ...rest: unknown[]): unknown {
    if (!armed || !hasVisibleText(chunk)) {
      return originalWrite.call(stream, chunk, ...rest);
    }
    disarm();
    const text = typeof chunk === 'string' ? chunk : String(chunk);
    const withClear = text.startsWith(SYNC_UPDATE_BEGIN)
      ? SYNC_UPDATE_BEGIN + clear + text.slice(SYNC_UPDATE_BEGIN.length)
      : clear + text;
    return originalWrite.call(stream, withClear, ...rest);
  };

  return {
    clearNow(): void {
      if (!armed) return;
      disarm();
      originalWrite.call(stream, clear);
    },
  };
}
