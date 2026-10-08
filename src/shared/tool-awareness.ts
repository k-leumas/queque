import type { CommandCandidate } from '../contracts/candidates.js';
import { extractCommandWords } from './command-words.js';

/**
 * Names zsh can resolve, read from the session-dir handoff (D-01).
 * The full set stays in the foreground client — never sent over IPC or logged (D-04).
 */
export interface ToolInventory {
  /** Keys of zsh `$commands` (external commands on PATH, freshly rehashed). */
  readonly commands: ReadonlySet<string>;
  /** Keys of zsh `$builtins` — never flagged (D-02). */
  readonly builtins: ReadonlySet<string>;
  /** zsh function AND alias names from functions.txt (D-01 amended). */
  readonly functions: ReadonlySet<string>;
}

/**
 * A candidate as displayed in the picker. UI-local: flags never enter the IPC candidate contract.
 */
export type DisplayCandidate = CommandCandidate & {
  /** External command words that zsh cannot resolve, in first-seen order. */
  readonly missingTools?: readonly string[];
};

/**
 * The single "installed" predicate: a name zsh resolves through `$commands`, functions or aliases.
 * Every caller (missing-tool flags, catalog intersection, installer choice) uses this.
 */
export function isInstalled(inventory: ToolInventory, name: string): boolean {
  return inventory.commands.has(name) || inventory.functions.has(name);
}

/**
 * External command words in `command` that are not installed, deduplicated in first-seen order.
 * Builtins, reserved words, placeholders, `$VAR` and path commands are never returned.
 */
export function missingTools(command: string, inventory: ToolInventory): string[] {
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const { word, kind } of extractCommandWords(command, inventory.builtins)) {
    if (kind !== 'external' || seen.has(word)) continue;
    seen.add(word);
    if (!isInstalled(inventory, word)) missing.push(word);
  }
  return missing;
}

/**
 * Attaches `missingTools` to candidates that use a tool zsh cannot resolve.
 * Keeps the model's order and never drops a candidate (SC-3, D-13). A null inventory
 * (handoff unavailable or disabled) returns unflagged copies.
 */
export function annotateCandidates(
  candidates: readonly CommandCandidate[],
  inventory: ToolInventory | null,
): DisplayCandidate[] {
  if (inventory === null) {
    return candidates.map((candidate) => ({ ...candidate }));
  }
  return candidates.map((candidate) => {
    try {
      const missing = missingTools(candidate.command, inventory);
      return missing.length > 0 ? { ...candidate, missingTools: missing } : { ...candidate };
    } catch {
      return { ...candidate };
    }
  });
}
