import { access, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { ShellName } from '../contracts/shell.js';
import { appendDebugLog } from '../shared/debug-log.js';
import type { ToolInventory } from '../shared/tool-awareness.js';

/**
 * Fixed sibling filenames a shell adapter's `??` widget writes next to request.json
 * (`_qq_write_tool_handoff` in shell/zsh/queque.zsh and shell/bash/queque.bash). A contract with
 * long-running shells: renaming needs both sides to change together; missing files degrade to
 * "no flags".
 *
 * - `commands` — external commands the shell resolves on PATH (zsh `$commands`, bash `compgen -c`).
 * - `builtins` — shell builtins; never flagged.
 * - `functions` — names the shell resolves that are not on PATH: functions, aliases and, for fish
 *   in Phase 12, abbreviations. Still one file (09 D-01 amended) — do not split it.
 */
export const TOOL_HANDOFF_FILES = {
  commands: 'commands.txt',
  builtins: 'builtins.txt',
  functions: 'functions.txt',
} as const;

/**
 * Marker an adapter creates before its detached handoff writer starts; the writer removes it last.
 * zsh writes the files synchronously and never creates it (Phase 11 D-05).
 */
export const TOOL_HANDOFF_PENDING = 'tools.pending';

/** Longest wait for a pending scan: covers bash's ~85 ms compgen scan with load headroom. */
export const TOOL_HANDOFF_PENDING_BUDGET_MS = 500;

/** Interval between checks for the pending marker. */
export const TOOL_HANDOFF_PENDING_POLL_MS = 10;

function toNameSet(content: string): Set<string> {
  return new Set(content.split(/\r?\n/).filter((name) => name.length > 0));
}

function errorReason(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) return code;
  }
  return 'unreadable';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolves true once `<sessionDir>/tools.pending` is gone (or was never there), false when it is
 * still present after `budgetMs`. Never throws: any access error counts as "gone".
 */
async function waitWhilePending(sessionDir: string, budgetMs: number): Promise<boolean> {
  const marker = path.join(sessionDir, TOOL_HANDOFF_PENDING);
  const deadline = Date.now() + budgetMs;
  for (;;) {
    try {
      await access(marker);
    } catch {
      return true;
    }
    if (Date.now() >= deadline) return false;
    await sleep(TOOL_HANDOFF_PENDING_POLL_MS);
  }
}

/**
 * Reads the installed-tool handoff from the session dir into a ToolInventory tagged with the
 * shell it came from (`options.shell`, default zsh).
 *
 * While an adapter's `tools.pending` marker exists the read waits, polling every
 * TOOL_HANDOFF_PENDING_POLL_MS, for at most `options.pendingBudgetMs`
 * (TOOL_HANDOFF_PENDING_BUDGET_MS); past that it returns null with reason `pending-timeout`.
 *
 * Returns null — never throws — when `QQ_TOOL_AWARENESS=0`, the marker outlives the budget, any
 * file is missing or unreadable, or commands.txt is empty. Debug logs carry a reason or counts
 * only, never tool names (D-04). Paths are only the fixed names inside `sessionDir`; nothing
 * comes from request JSON.
 */
export async function readToolHandoff(
  sessionDir: string,
  options: { shell?: ShellName; pendingBudgetMs?: number } = {},
): Promise<ToolInventory | null> {
  if (process.env.QQ_TOOL_AWARENESS === '0') {
    void appendDebugLog('client', 'tool handoff unavailable', { reason: 'disabled' });
    return null;
  }

  const ready = await waitWhilePending(
    sessionDir,
    options.pendingBudgetMs ?? TOOL_HANDOFF_PENDING_BUDGET_MS,
  );
  if (!ready) {
    void appendDebugLog('client', 'tool handoff unavailable', { reason: 'pending-timeout' });
    return null;
  }

  let contents: [string, string, string];
  try {
    contents = await Promise.all([
      readFile(path.join(sessionDir, TOOL_HANDOFF_FILES.commands), 'utf-8'),
      readFile(path.join(sessionDir, TOOL_HANDOFF_FILES.builtins), 'utf-8'),
      readFile(path.join(sessionDir, TOOL_HANDOFF_FILES.functions), 'utf-8'),
    ]);
  } catch (error) {
    void appendDebugLog('client', 'tool handoff unavailable', { reason: errorReason(error) });
    return null;
  }

  const [commands, builtins, functions] = contents.map(toNameSet);
  if (commands.size === 0) {
    void appendDebugLog('client', 'tool handoff unavailable', { reason: 'empty' });
    return null;
  }

  void appendDebugLog('client', 'tool handoff read', {
    commands: commands.size,
    builtins: builtins.size,
    functions: functions.size,
  });
  return { commands, builtins, functions, shell: options.shell ?? 'zsh' };
}
