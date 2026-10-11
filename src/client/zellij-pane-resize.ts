import { type ChildProcess, spawn } from 'node:child_process';

/** Default max floating pane height when QQ_PANE_HEIGHT is unset or invalid. */
const DEFAULT_MAX_PANE_HEIGHT = 24;

/** Minimum floating pane height so header, filter, and spinner always fit. */
const MIN_PANE_HEIGHT = 6;

/**
 * Zellij floating pane chrome (border + title) not counted in Ink row estimates.
 * Keep in sync with manual Zellij pane inspection at default theme.
 */
const ZELLIJ_FLOATING_FRAME_LINES = 2;

/**
 * How long one `zellij action` may run before it is killed and the next waiting height is
 * spawned. Each action took about 100-420 ms in the G-09-7 repro, so 2 s is about five times
 * the slowest; a hung action must not freeze every later resize.
 */
export const RESIZE_SETTLE_TIMEOUT_MS = 2000;

/** A resize that has been requested but not yet spawned. */
interface ResizeRequest {
  height: number;
  paneId: string;
}

/** The in-flight `zellij action`; `child` stays undefined when spawn threw synchronously. */
interface InFlightResize {
  child: ChildProcess | undefined;
}

/** Height of the most recently spawned action (the dedupe key). */
let spawnedHeight: number | undefined;

/** Newest height requested while an action runs; replaced by every later request. */
let waiting: ResizeRequest | undefined;

/** The action currently running, if any. At most one runs at a time. */
let current: InFlightResize | undefined;

/** Kills a hung `current` action after RESIZE_SETTLE_TIMEOUT_MS. */
let settleTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Reads the configured max pane height from QQ_PANE_HEIGHT.
 */
export function readMaxZellijPaneHeight(): number {
  const parsed = Number.parseInt(process.env.QQ_PANE_HEIGHT ?? '', 10);
  if (Number.isFinite(parsed) && parsed >= MIN_PANE_HEIGHT) {
    return parsed;
  }
  return DEFAULT_MAX_PANE_HEIGHT;
}

/**
 * Converts Ink content line count into a Zellij floating pane height capped by config.
 */
export function resolveZellijPaneHeight(
  contentLines: number,
  maxHeight = readMaxZellijPaneHeight(),
): number {
  const withFrame = contentLines + ZELLIJ_FLOATING_FRAME_LINES;
  return Math.min(Math.max(withFrame, MIN_PANE_HEIGHT), maxHeight);
}

/**
 * Formats ZELLIJ_PANE_ID for zellij action CLI (e.g. "0" → "terminal_0").
 */
export function formatZellijPaneId(rawPaneId: string): string {
  if (rawPaneId.startsWith('terminal_') || rawPaneId.startsWith('plugin_')) {
    return rawPaneId;
  }
  return `terminal_${rawPaneId}`;
}

/**
 * Releases the slot held by `action` and spawns the newest waiting height, if it differs
 * from the height just spawned. Ignores an action that is no longer current (after a reset).
 */
function settleResize(action: InFlightResize): void {
  if (action !== current) {
    return;
  }
  if (settleTimer !== undefined) {
    clearTimeout(settleTimer);
    settleTimer = undefined;
  }
  current = undefined;

  const next = waiting;
  waiting = undefined;
  if (next !== undefined && next.height !== spawnedHeight) {
    startResize(next);
  }
}

/**
 * Spawns one `zellij action change-floating-pane-coordinates` and holds the slot until it
 * exits, fails to start, or exceeds RESIZE_SETTLE_TIMEOUT_MS (then it is killed).
 */
function startResize(request: ResizeRequest): void {
  spawnedHeight = request.height;
  const action: InFlightResize = { child: undefined };
  current = action;

  let settled = false;
  const settle = (): void => {
    if (settled) {
      return;
    }
    settled = true;
    settleResize(action);
  };

  try {
    const child = spawn(
      'zellij',
      [
        'action',
        'change-floating-pane-coordinates',
        '--pane-id',
        request.paneId,
        '--height',
        String(request.height),
      ],
      { stdio: 'ignore' },
    );
    action.child = child;
    child.once('exit', settle);
    // 'on', not 'once': a spawn failure (zellij not on PATH) must never be an unhandled
    // 'error' event, which would crash the client.
    child.on('error', settle);
    // The client must never wait for zellij to exit.
    child.unref();
  } catch {
    settle();
    return;
  }

  const timer = setTimeout(() => {
    try {
      action.child?.kill();
    } catch {
      // Already gone; settling below is all that matters.
    }
    settle();
  }, RESIZE_SETTLE_TIMEOUT_MS);
  // Never keep the client process alive just to time out a resize.
  timer.unref();
  settleTimer = timer;
}

/**
 * Resizes the current Zellij floating pane to fit modal content, capped at QQ_PANE_HEIGHT.
 * No-op outside Zellij or when pane id is unavailable.
 *
 * Zellij applies resize actions in completion order, not spawn order, so concurrent actions
 * can land reversed and leave a stale height (G-09-7). One action runs at a time: a height
 * requested meanwhile replaces any earlier waiting height, and only the newest waiting height
 * is spawned once the running action settles. The last height applied is the last requested.
 */
export function syncZellijFloatingPaneHeight(contentLines: number): void {
  if (process.env.ZELLIJ === undefined) {
    return;
  }

  const rawPaneId = process.env.ZELLIJ_PANE_ID;
  if (rawPaneId === undefined || rawPaneId.length === 0) {
    return;
  }

  const height = resolveZellijPaneHeight(contentLines);
  const paneId = formatZellijPaneId(rawPaneId);

  if (current !== undefined) {
    // The running action already asks for this height, so nothing needs to wait.
    waiting = height === spawnedHeight ? undefined : { height, paneId };
    return;
  }
  if (height === spawnedHeight) {
    return;
  }
  startResize({ height, paneId });
}

/**
 * Clears cached height and queue state — for tests only.
 */
export function resetZellijPaneHeightCache(): void {
  if (settleTimer !== undefined) {
    clearTimeout(settleTimer);
    settleTimer = undefined;
  }
  spawnedHeight = undefined;
  waiting = undefined;
  current = undefined;
}
