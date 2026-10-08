import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { appendDebugLog } from '../shared/debug-log.js';
import type { ToolInventory } from '../shared/tool-awareness.js';

/**
 * Fixed sibling filenames the `??` widget writes next to request.json
 * (`_qq_write_tool_handoff` in shell/zsh/queque.zsh). A contract with long-running shells:
 * renaming needs both sides to change together; missing files degrade to "no flags".
 *
 * `functions` holds zsh function AND alias names in one file (D-01 amended) — do not split it.
 */
export const TOOL_HANDOFF_FILES = {
  commands: 'commands.txt',
  builtins: 'builtins.txt',
  functions: 'functions.txt',
} as const;

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

/**
 * Reads the installed-tool handoff from the session dir into a ToolInventory.
 *
 * Returns null — never throws — when `QQ_TOOL_AWARENESS=0`, any file is missing or unreadable,
 * or commands.txt is empty. Debug logs carry a reason or counts only, never tool names (D-04).
 * Paths are only the fixed names inside `sessionDir`; nothing comes from request JSON.
 */
export async function readToolHandoff(sessionDir: string): Promise<ToolInventory | null> {
  if (process.env.QQ_TOOL_AWARENESS === '0') {
    void appendDebugLog('client', 'tool handoff unavailable', { reason: 'disabled' });
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
  return { commands, builtins, functions };
}
