import type { QueryOutcome } from '../contracts/telemetry.js';
import type { TelemetryBlockReason, TelemetryState } from '../shared/telemetry-config.js';

/**
 * The one-time telemetry consent ask (phase 10, D-09).
 *
 * After the first accepted `??`, once the shell result is written and Ink has unmounted,
 * the foreground client asks one question on /dev/tty (never stdout) and reads one key.
 * Default No: only `y` or `Y` opts in; Enter, Esc, Ctrl-C, any other key and 30 s of
 * silence mean no. The caller persists the answer (`markTelemetryAsked`) so it is asked
 * once ever. The prompt line is erased before the client exits, so the shell redraw and
 * the accepted buffer are untouched.
 */

/** The one-line consent question (D-09). Default No: only `y` or `Y` opts in. */
export const CONSENT_PROMPT =
  'QueQue: send anonymous usage and error counts (no commands, prompts or paths)? [y/N] ';

/** Silence for this long counts as no. */
export const CONSENT_TIMEOUT_MS = 30_000;

/** Carriage return + erase the whole line. */
const ERASE_LINE = '\r\x1b[2K';
/** Cursor up one row + erase it: for a prompt that wrapped on a narrow terminal. */
const ERASE_ROW_ABOVE = '\x1b[1A\x1b[2K';

export interface ShouldAskTelemetryConsentInput {
  outcome: QueryOutcome | undefined;
  state: TelemetryState;
  blockedBy: TelemetryBlockReason | null;
  hasTty: boolean;
}

type DataListener = (chunk: Buffer | string) => void;

/** The minimal tty read surface the prompt needs (a tty.ReadStream satisfies it). */
export interface ConsentInput {
  setRawMode(mode: boolean): unknown;
  resume(): unknown;
  pause(): unknown;
  once(event: 'data', listener: DataListener): unknown;
  off(event: 'data', listener: DataListener): unknown;
}

export interface ConsentOutput {
  write(text: string): unknown;
  /** Terminal width, used to erase every row of a wrapped prompt. */
  columns?: number;
}

export interface ConsentIo {
  input: ConsentInput;
  output: ConsentOutput;
}

/**
 * Whether to ask now: only after an accepted `??`, when the user was never asked, no
 * environment gate (DO_NOT_TRACK, QQ_TELEMETRY=0, CI) is set and a terminal is open.
 */
export function shouldAskTelemetryConsent(input: ShouldAskTelemetryConsentInput): boolean {
  return (
    input.outcome === 'accepted' && !input.state.asked && input.blockedBy === null && input.hasTty
  );
}

/** The erase sequence for the prompt: its own row plus every row it wrapped onto. */
function eraseSequence(columns: number | undefined): string {
  const width = columns !== undefined && Number.isFinite(columns) && columns > 0 ? columns : 0;
  const rows = width > 0 ? Math.max(1, Math.ceil(CONSENT_PROMPT.length / width)) : 1;
  return `${ERASE_LINE}${ERASE_ROW_ABOVE.repeat(rows - 1)}`;
}

/**
 * Writes CONSENT_PROMPT and resolves with the answer: true only when the first character
 * of the first chunk read is `y` or `Y`. Never rejects. Settles once (first of a key or the
 * timeout), then always turns raw mode off, pauses the input, removes the listener, clears
 * the timer and erases the prompt line.
 */
export function askTelemetryConsent(
  io: ConsentIo,
  timeoutMs: number = CONSENT_TIMEOUT_MS,
): Promise<boolean> {
  const { input, output } = io;
  return new Promise<boolean>((resolve) => {
    try {
      input.setRawMode(true);
    } catch {
      // Not a usable terminal: no question, and no means no.
      resolve(false);
      return;
    }

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const settle = (answer: boolean) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      input.off('data', onData);
      try {
        input.setRawMode(false);
      } catch {
        // the terminal may already be gone
      }
      try {
        input.pause();
      } catch {
        // ignore
      }
      try {
        output.write(eraseSequence(output.columns));
      } catch {
        // ignore
      }
      resolve(answer);
    };

    // A single read can hold several bytes: only the first character counts.
    const onData: DataListener = (chunk) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      const key = text.charAt(0);
      settle(key === 'y' || key === 'Y');
    };

    try {
      output.write(CONSENT_PROMPT);
      input.once('data', onData);
      input.resume();
    } catch {
      settle(false);
      return;
    }
    timer = setTimeout(() => settle(false), timeoutMs);
  });
}
