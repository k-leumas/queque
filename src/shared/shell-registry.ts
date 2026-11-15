import { existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isShellName, SHELL_NAMES, type ShellName } from '../contracts/shell.js';

/**
 * One per-shell registry (Phase 11 D-02, D-08): every fact `qq init` and `qq doctor` need about
 * a shell lives here, so no shared code hardcodes zsh. Adding a shell means adding a spec and an
 * adapter under `shell/<name>/`.
 */
export interface ShellSpec {
  shell: ShellName;
  /** False until the adapter ships; init then says support is coming (fish in Phase 11). */
  shipped: boolean;
  /** rc file relative to the home directory; the only file init ever writes for this shell. */
  rcFile: string;
  /** The `~/`-form literal user-facing copy may print (never the expanded home path). */
  rcDisplay: string;
  /** Adapter script name under `shell/<shell>/` and `<prefix>/share/queque/`. */
  adapterFile: string;
  /** Executable name looked up on PATH. */
  binary: string;
  /** Arguments that make the shell print its own version and nothing else, without rc files. */
  versionArgs: readonly string[];
  /** Below this version the adapter cannot run: init refuses, doctor fails. */
  failBelow: string;
  /** Below this version the adapter is untested: doctor warns. */
  warnBelow: string;
  /** The function or widget the adapter binds to `?`. */
  bindingWidget: string;
  /** Keymaps the adapter binds `?` in. */
  bindingKeymaps: readonly string[];
}

/** zsh below this version cannot run the widget: doctor fails (Phase 10 D-20). */
export const ZSH_FAIL_BELOW = '5.0';
/** zsh below this version is untested: doctor warns (5.8 is Ubuntu 22.04, the oldest CI). */
export const ZSH_WARN_BELOW = '5.8';
/** D-12 refuses bash below 5.0 (READLINE_POINT in characters, `bind -x` buffer access). */
export const BASH_FAIL_BELOW = '5.0';
/**
 * bash below this version is untested: doctor warns. 5.1 is ubuntu:22.04, the oldest CI image,
 * and the release that turned bracketed paste on by default.
 */
export const BASH_WARN_BELOW = '5.1';

export const SHELL_SPECS: Readonly<Record<ShellName, ShellSpec>> = {
  zsh: {
    shell: 'zsh',
    shipped: true,
    rcFile: '.zshrc',
    rcDisplay: '~/.zshrc',
    adapterFile: 'queque.zsh',
    binary: 'zsh',
    versionArgs: ['-fc', 'print -r -- $ZSH_VERSION'],
    failBelow: ZSH_FAIL_BELOW,
    warnBelow: ZSH_WARN_BELOW,
    bindingWidget: 'qq-question-widget',
    bindingKeymaps: ['emacs', 'viins'],
  },
  bash: {
    shell: 'bash',
    shipped: true,
    rcFile: '.bashrc',
    rcDisplay: '~/.bashrc',
    adapterFile: 'queque.bash',
    binary: 'bash',
    versionArgs: ['--noprofile', '--norc', '-c', 'printf %s "$BASH_VERSION"'],
    failBelow: BASH_FAIL_BELOW,
    warnBelow: BASH_WARN_BELOW,
    bindingWidget: '_qq_question',
    bindingKeymaps: ['emacs', 'vi-insert'],
  },
  // Phase 12 confirms these values when the fish adapter ships.
  fish: {
    shell: 'fish',
    shipped: false,
    rcFile: '.config/fish/conf.d/queque.fish',
    rcDisplay: '~/.config/fish/conf.d/queque.fish',
    adapterFile: 'queque.fish',
    binary: 'fish',
    versionArgs: ['--no-config', '-c', 'echo $version'],
    failBelow: '4.0',
    warnBelow: '4.0',
    bindingWidget: '_qq_question',
    bindingKeymaps: ['default', 'insert'],
  },
};

export function getShellSpec(shell: ShellName): ShellSpec {
  return SHELL_SPECS[shell];
}

/** Shells whose adapter ships in this release, in registry order. */
export function shippedShellNames(): ShellName[] {
  return SHELL_NAMES.filter((name) => SHELL_SPECS[name].shipped);
}

function shellFromPath(path: string | undefined): ShellName | null {
  if (!path) {
    return null;
  }
  const name = basename(path.trim());
  return isShellName(name) ? name : null;
}

/**
 * Which shell `qq init` targets (D-08): an explicit argument wins and must be a shell name;
 * otherwise the basename of `$SHELL`, then the passwd login shell. fish is returned so callers
 * can say it is not shipped yet; anything else is null.
 */
export function detectShell(input: {
  arg?: string;
  env?: NodeJS.ProcessEnv;
  userShell?: string;
}): ShellName | null {
  if (input.arg !== undefined) {
    return isShellName(input.arg) ? input.arg : null;
  }
  return shellFromPath(input.env?.SHELL) ?? shellFromPath(input.userShell);
}

export const HOMEBREW_PREFIXES: readonly string[] = [
  '/opt/homebrew',
  '/usr/local',
  '/home/linuxbrew/.linuxbrew',
];

// The bundle (dist/cli/app.js) sits two levels below the package root, so `../../shell` is the
// package's shell/ directory. Tests pass `packageShellDir` explicitly.
const PACKAGE_SHELL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../shell');

/**
 * Path of the adapter script that the rc file sources.
 *
 * Homebrew installs the shell script to $(brew --prefix)/share/queque/ — a path that is stable
 * across `brew upgrade` (no version number). The formula's install block copies the adapter
 * there. For npm global installs the script stays inside the package directory, which npm
 * updates in-place so the path is also stable. Only fixed prefixes and the package directory
 * are used: nothing from the environment enters the path (T-11-14).
 */
export function resolveAdapterPath(
  spec: ShellSpec,
  opts: {
    prefixes?: readonly string[];
    packageShellDir?: string;
    exists?: (p: string) => boolean;
  } = {},
): string {
  const prefixes = opts.prefixes ?? HOMEBREW_PREFIXES;
  const exists = opts.exists ?? existsSync;
  for (const prefix of prefixes) {
    const candidate = resolve(prefix, 'share', 'queque', spec.adapterFile);
    if (exists(candidate)) {
      return candidate;
    }
  }
  return resolve(opts.packageShellDir ?? PACKAGE_SHELL_DIR, spec.shell, spec.adapterFile);
}

const VERSION_PREFIX = /^\d+(?:\.\d+)*/;

/** `5.2.21(1)-release` → `[5, 2, 21]`; anything without a leading number → null. */
export function parseShellVersion(raw: string): number[] | null {
  const match = VERSION_PREFIX.exec(raw.trim());
  return match ? match[0].split('.').map(Number) : null;
}

/** True when `version` sorts below the dotted `threshold` (missing parts count as 0). */
export function versionBelow(version: readonly number[], threshold: string): boolean {
  const floor = threshold.split('.').map(Number);
  for (let i = 0; i < Math.max(version.length, floor.length); i++) {
    const a = version[i] ?? 0;
    const b = floor[i] ?? 0;
    if (a !== b) {
      return a < b;
    }
  }
  return false;
}

/** One line without its comment: the first unquoted `#` that starts a word, to the end. */
function stripLineComment(line: string): string {
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      continue;
    }
    if (c === '\\') {
      i++;
      continue;
    }
    if (quote === '"') {
      if (c === '"') quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '#' && (i === 0 || /[\s;&|()]/.test(line[i - 1] ?? ''))) {
      return line.slice(0, i);
    }
  }
  return line;
}

/**
 * Rc-file text with shell comments removed line by line (11-REVIEW WR-06), so a source line the
 * user commented out to disable QueQue no longer counts as installed. A `#` inside quotes or in
 * the middle of a word stays. The line count is unchanged. Quotes that span lines are not
 * tracked: each line starts unquoted, which is enough for source lines.
 */
export function stripShellComments(text: string): string {
  return text.split('\n').map(stripLineComment).join('\n');
}

/** A login bash reads the first of these that exists (bash INVOCATION). */
export const BASH_LOGIN_FILES = ['.bash_profile', '.bash_login', '.profile'] as const;

/**
 * A `.` or `source` command that loads `~/.bashrc` (written `~`, `$HOME` or `${HOME}`, quoted or
 * not), at a line start or after whitespace, `;`, `&` or `|`.
 */
export const BASHRC_SOURCE_RE =
  /(?:^|[\s;&|])(?:\.|source)\s+["']?(?:~|\$HOME|\$\{HOME\})\/\.bashrc(?=["'\s;&|)]|$)/m;

/**
 * Whether a login bash would load `~/.bashrc` (D-09). macOS terminals start login shells, which
 * skip `~/.bashrc` unless the first login file sources it. Read only: init prints a hint and
 * never edits a login file. Commented-out lines do not count (WR-06).
 */
export function loginFileSourcesBashrc(readRc: (relPath: string) => string | null): {
  file: string | null;
  sourcesBashrc: boolean;
} {
  for (const relPath of BASH_LOGIN_FILES) {
    const text = readRc(relPath);
    if (text !== null) {
      return {
        file: `~/${relPath}`,
        sourcesBashrc: BASHRC_SOURCE_RE.test(stripShellComments(text)),
      };
    }
  }
  return { file: null, sourcesBashrc: false };
}
