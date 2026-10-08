import type { CommandCandidate } from '../contracts/candidates.js';
import { extractCommandWords, lexHand } from './command-words.js';

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
export const PACKAGE_ALIASES: ReadonlyMap<string, string> = new Map([
  ['rg', 'ripgrep'],
  ['delta', 'git-delta'],
  ['nvim', 'neovim'],
  ['magick', 'imagemagick'],
  ['convert', 'imagemagick'],
  ['identify', 'imagemagick'],
  ['mogrify', 'imagemagick'],
  ['ag', 'the_silver_searcher'],
  // Homebrew coreutils 9.11 installs `timeout`, `nproc`, `sha256sum` unprefixed and
  // `gtimeout`, `gdate` prefixed. Linux ships these, so they are never flagged there.
  ['gtimeout', 'coreutils'],
  ['timeout', 'coreutils'],
  ['gdate', 'coreutils'],
  ['nproc', 'coreutils'],
  ['sha256sum', 'coreutils'],
  ['gsed', 'gnu-sed'],
  ['ffprobe', 'ffmpeg'],
  ['btm', 'bottom'],
  ['difft', 'difftastic'],
  ['http', 'httpie'],
  ['https', 'httpie'],
  ['vd', 'visidata'],
  ['mlr', 'miller'],
  ['csvlook', 'csvkit'],
  ['gtime', 'gnu-time'],
  ['kubectl', 'kubernetes-cli'],
  ['dig', 'bind'],
  ['rga', 'ripgrep-all'],
  ['tldr', 'tealdeer'],
  ['aws', 'awscli'],
  // Debian binary names: they only appear where the Debian package is the right one.
  ['fdfind', 'fd-find'],
  ['batcat', 'bat'],
]);

/** List operators after which a failed install would still run the user's command (T-09-11). */
const LIST_OPS: ReadonlySet<string> = new Set([';', '||', '&', ';;']);

/** A heredoc operator (`<<`, `<<-`, `2<<`); a here-string `<<<` does not match. */
const HEREDOC_RE = /^\d*<<-?$/;

const BLOCKED_PLAN = (blocked: InstallBlockReason): InstallPlan => ({
  form: null,
  packages: [],
  blocked,
});

/** The installer for this platform, or null when none is available (D-11). */
export function pickInstaller(
  inventory: ToolInventory,
  platform: NodeJS.Platform,
): InstallerId | null {
  if (platform === 'darwin') return isInstalled(inventory, 'brew') ? 'brew' : null;
  if (platform === 'linux') {
    return LINUX_INSTALLER_ORDER.find((id) => isInstalled(inventory, id)) ?? null;
  }
  return null;
}

/** The package that provides `tool` (D-12). */
export function packageFor(tool: string): string {
  return PACKAGE_ALIASES.get(tool) ?? tool;
}

/**
 * `<installer> <packages> && <command>`. A command with a list operator (`;`, `||`, `&`, `;;`,
 * newline) is wrapped in `{ …; }` so it never runs after a failed install; pipelines and
 * `&&` chains need no wrap because `&&` binds looser than `|`. Returns null when a wrap is
 * needed but a `#` comment or heredoc would swallow or displace the closing brace (T-09-20).
 */
export function buildInstallForm(
  command: string,
  packages: readonly string[],
  installer: InstallerId,
): string | null {
  const cmd = command.trim();
  const prefix = `${INSTALL_COMMANDS[installer]} ${packages.join(' ')}`;
  const tokens = lexHand(cmd);
  const needsWrap = tokens.some((token) => token.t === 'op' && LIST_OPS.has(token.v));
  if (!needsWrap) return `${prefix} && ${cmd}`;
  const unwrappable = tokens.some(
    (token) => token.t === 'comment' || (token.t === 'redir' && HEREDOC_RE.test(token.v)),
  );
  if (unwrappable) return null;
  const last = tokens[tokens.length - 1];
  const terminated = last?.t === 'op' && (last.v === ';' || last.v === ';;' || last.v === '&');
  return `${prefix} && { ${cmd}${terminated ? '' : ';'} }`;
}

/** The install plan for a flagged candidate (D-09..D-12). */
export function planInstall(
  command: string,
  missing: readonly string[],
  installer: InstallerId | null,
): InstallPlan {
  if (installer === null) return BLOCKED_PLAN('no-package-manager');
  if (missing.some((word) => !SAFE_PACKAGE_NAME_RE.test(word))) {
    return BLOCKED_PLAN('unsafe-package-name');
  }
  const packages = [...new Set(missing.map(packageFor))];
  const form = buildInstallForm(command, packages, installer);
  if (form === null) return BLOCKED_PLAN('unwrappable-command');
  return { form, packages, blocked: null };
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
 * Attaches `missingTools` and an install plan to candidates that use a tool zsh cannot resolve.
 * Keeps the model's order and never drops a candidate (SC-3, D-13). A null inventory
 * (handoff unavailable or disabled) returns unflagged copies. The installer is chosen once
 * from the same inventory (D-11); there is no use-before-install or wrong-OS logic (D-07).
 */
export function annotateCandidates(
  candidates: readonly CommandCandidate[],
  inventory: ToolInventory | null,
  platform: NodeJS.Platform = process.platform,
): DisplayCandidate[] {
  if (inventory === null) {
    return candidates.map((candidate) => ({ ...candidate }));
  }
  const installer = pickInstaller(inventory, platform);
  return candidates.map((candidate) => {
    try {
      const missing = missingTools(candidate.command, inventory);
      if (missing.length === 0) return { ...candidate };
      return {
        ...candidate,
        missingTools: missing,
        install: planInstall(candidate.command, missing, installer),
      };
    } catch {
      return { ...candidate };
    }
  });
}
