import { spawn } from 'node:child_process';

/** Default max floating pane height when QQ_PANE_HEIGHT is unset or invalid. */
const DEFAULT_MAX_PANE_HEIGHT = 24;

/** Minimum floating pane height so header, filter, and spinner always fit. */
const MIN_PANE_HEIGHT = 6;

/**
 * Zellij floating pane chrome (border + title) not counted in Ink row estimates.
 * Keep in sync with manual Zellij pane inspection at default theme.
 */
const ZELLIJ_FLOATING_FRAME_LINES = 2;

let lastSyncedHeight: number | undefined;

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
 * Resizes the current Zellij floating pane to fit modal content, capped at QQ_PANE_HEIGHT.
 * No-op outside Zellij or when pane id is unavailable.
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
  if (height === lastSyncedHeight) {
    return;
  }
  lastSyncedHeight = height;

  const paneId = formatZellijPaneId(rawPaneId);
  const child = spawn(
    'zellij',
    ['action', 'change-floating-pane-coordinates', '--pane-id', paneId, '--height', String(height)],
    { stdio: 'ignore' },
  );
  child.unref();
}

/**
 * Clears cached height — for tests only.
 */
export function resetZellijPaneHeightCache(): void {
  lastSyncedHeight = undefined;
}
