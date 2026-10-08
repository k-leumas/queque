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
  /** Install plan for a flagged candidate (09-04): the Tab install form or why there is none. */
  readonly install?: InstallPlan;
};

/** Package managers QueQue can name in an install form (D-11). */
export type InstallerId = 'brew' | 'apt' | 'dnf' | 'pacman';

/**
 * Install command prefix per manager. No `-y`/`--noconfirm`: the manager's own confirmation
 * keeps the user in control (D-11). The form is only ever inserted, never run.
 */
export const INSTALL_COMMANDS: Readonly<Record<InstallerId, string>> = {
  brew: 'brew install',
  apt: 'sudo apt install',
  dnf: 'sudo dnf install',
  pacman: 'sudo pacman -S',
};

/** Linux managers in preference order; the first one zsh can resolve wins. */
export const LINUX_INSTALLER_ORDER: readonly InstallerId[] = ['apt', 'dnf', 'pacman'];

/** Only words matching this become installer arguments (T-09-10). */
export const SAFE_PACKAGE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;

/** Why a flagged candidate has no install form. */
export type InstallBlockReason =
  | 'no-package-manager'
  | 'unsafe-package-name'
  | 'unwrappable-command';

/** The install form for a flagged candidate, or the reason there is none. */
export interface InstallPlan {
  /** `<installer> <pkg…> && <command>`, or null when blocked. */
  readonly form: string | null;
  /** Deduplicated package names in first-seen order; empty when blocked. */
  readonly packages: readonly string[];
  readonly blocked: InstallBlockReason | null;
}

/**
 * Binary name → package name where they differ (D-12). Shipped and not user-extendable;
 * a tool not in the map installs under its own name.
 */
export const PACKAGE_ALIASES: ReadonlyMap<string, string> = new Map([]);

/** The installer for this platform, or null when none is available (D-11). */
export function pickInstaller(
  _inventory: ToolInventory,
  _platform: NodeJS.Platform,
): InstallerId | null {
  throw new Error('pickInstaller: not implemented');
}

/** The package that provides `tool` (D-12). */
export function packageFor(_tool: string): string {
  throw new Error('packageFor: not implemented');
}

/** `<installer> <packages> && <command>` with list-safe wrapping, or null when unwrappable. */
export function buildInstallForm(
  _command: string,
  _packages: readonly string[],
  _installer: InstallerId,
): string | null {
  throw new Error('buildInstallForm: not implemented');
}

/** The install plan for a flagged candidate (D-09..D-12). */
export function planInstall(
  _command: string,
  _missing: readonly string[],
  _installer: InstallerId | null,
): InstallPlan {
  throw new Error('planInstall: not implemented');
}

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
  _platform: NodeJS.Platform = process.platform,
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
