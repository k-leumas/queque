/**
 * `qq init [shell]` (Phase 11 D-08, D-09, D-12, D-14): detect the login shell, gate bash below
 * 5.0, and append the integration marker plus one source line to that shell's rc file. Every
 * per-shell fact (rc file, adapter, version probe, floors) comes from src/shared/shell-registry.ts.
 *
 * The only file ever written is `join(home, spec.rcFile)` for a shipped, registered shell, and
 * only by appending: never `~/.bash_profile`, `~/.bash_login`, `~/.profile` or `/etc/shells`,
 * and never `chsh` (T-11-13). Output is fixed copy plus the registry's `~/` display literals.
 */
import { spawnSync } from 'node:child_process';
import { accessSync, appendFileSync, constants, readFileSync, statSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { basename, join } from 'node:path';

import type { ShellName } from '../../contracts/shell.js';
import { bootstrapBuiltins } from '../../registry/bootstrap.js';
import { listShellAdapters } from '../../registry/shell-adapters.js';
import {
  detectShell,
  getShellSpec,
  loginFileSourcesBashrc,
  parseShellVersion,
  resolveAdapterPath,
  type ShellSpec,
  shippedShellNames,
  stripShellComments,
  versionBelow,
} from '../../shared/shell-registry.js';

const MARKER = '# queque shell integration';
const VERSION_PROBE_TIMEOUT_MS = 3000;

/**
 * Returns true when the rc file actively sources this shell's queque adapter — not merely any
 * mention of "queque". A `source` or `.` command word (at a line start or after whitespace, `;`,
 * `&` or `|`) followed by a path ending in `queque.<shell>`, double-quoted, single-quoted or
 * bare. Comments are stripped first (WR-06): a source line the user commented out does not
 * count, and neither does the `# queque shell integration` marker on its own (init always
 * writes it together with the source line, so a lone marker means that line is gone).
 */
export function hasShellIntegration(existing: string, shell: ShellName): boolean {
  const file = `queque\\.${shell}`;
  const scriptPattern = new RegExp(
    `(?:^|[\\s;&|])(?:source|\\.)\\s+` +
      `(?:"[^"\\n]*${file}"|'[^'\\n]*${file}'|[^\\s"';&|]*${file}(?=[\\s;&|)]|$))`,
    'm',
  );
  return scriptPattern.test(stripShellComments(existing));
}

/** Everything init reads or writes, injectable so tests never touch the real home or spawn. */
export interface InitDeps {
  home: string;
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  /** The passwd login shell (`os.userInfo().shell`). */
  userShell?: string;
  which(name: string): string | null;
  probeVersion(binary: string, args: readonly string[]): string | null;
  readFile(path: string): string | null;
  appendFile(path: string, text: string): void;
  out(line: string): void;
  err(line: string): void;
  /** Adapter script path; defaults to the registry's fixed Homebrew prefixes or the package. */
  adapterPath?: (spec: ShellSpec) => string;
}

/** PATH scan for an executable regular file (the `command -v` question, without a shell). */
function whichOnPath(name: string, pathEnv: string | undefined): string | null {
  for (const dir of (pathEnv ?? '').split(':')) {
    if (!dir) {
      continue;
    }
    const candidate = join(dir, name);
    try {
      if (statSync(candidate).isFile()) {
        accessSync(candidate, constants.X_OK);
        return candidate;
      }
    } catch {
      // not here, or not executable: keep scanning
    }
  }
  return null;
}

function passwdShell(): string | undefined {
  try {
    return userInfo().shell ?? undefined;
  } catch {
    return undefined;
  }
}

export function defaultInitDeps(): InitDeps {
  const env = process.env;
  return {
    home: homedir(),
    env,
    platform: process.platform,
    userShell: passwdShell(),
    which: (name) => whichOnPath(name, env.PATH),
    probeVersion: (binary, args) => {
      // A non-interactive bash reads $BASH_ENV even with --norc; drop it (and sh's $ENV) so the
      // probe runs no user code. stdin is ignored and the probe is bounded (T-11-16).
      const probeEnv = { ...env };
      delete probeEnv.BASH_ENV;
      delete probeEnv.ENV;
      const result = spawnSync(binary, [...args], {
        encoding: 'utf8',
        env: probeEnv,
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: VERSION_PROBE_TIMEOUT_MS,
      });
      return result.status === 0 && typeof result.stdout === 'string' ? result.stdout : null;
    },
    readFile: (path) => {
      try {
        return readFileSync(path, 'utf8');
      } catch {
        return null;
      }
    },
    appendFile: (path, text) => appendFileSync(path, text),
    out: (line) => console.log(line),
    err: (line) => console.error(line),
  };
}

type InitResult = { exitCode: 0 | 1; wrote: boolean };

const refused: InitResult = { exitCode: 1, wrote: false };

const BASH_NOT_FOUND = 'queque: bash not found; bash 5.0 or newer is needed for the ?? trigger';
const BASH_TOO_OLD_DARWIN = 'bash 5+ needed: brew install bash';
const BASH_TOO_OLD = 'bash 5.0 or newer is needed for the ?? trigger';
const BASH_NEWER_NOT_LOGIN =
  'queque: a newer bash is installed but is not your login shell; add it to /etc/shells, ' +
  'run chsh -s with its path, then run qq init bash again';
const FISH_NOT_SHIPPED =
  'queque: fish support is coming in a later release; supported now: zsh, bash';
const CANNOT_DETECT = 'queque: could not detect your shell; run qq init zsh or qq init bash';
const BASHRC_SNIPPET = '  [ -f ~/.bashrc ] && . ~/.bashrc';

/** Probes a bash binary; null when it is missing or does not report a readable version. */
function bashVersion(deps: InitDeps, spec: ShellSpec, binary: string | null): number[] | null {
  if (!binary) {
    return null;
  }
  const raw = deps.probeVersion(binary, spec.versionArgs);
  return raw === null ? null : parseShellVersion(raw);
}

/**
 * D-12 / D-14: probe the bash that will run (`$SHELL` when it is a bash, else the PATH bash)
 * and refuse below the floor. Returns true when init may continue.
 */
function bashGate(deps: InitDeps, spec: ShellSpec): boolean {
  const shellEnv = deps.env.SHELL;
  const loginBash = shellEnv && basename(shellEnv) === spec.binary ? shellEnv : null;
  const pathBash = deps.which(spec.binary);
  const binary = loginBash ?? pathBash;
  const version = bashVersion(deps, spec, binary);

  if (!version) {
    deps.err(BASH_NOT_FOUND);
    return false;
  }
  if (!versionBelow(version, spec.failBelow)) {
    return true;
  }

  deps.err(deps.platform === 'darwin' ? BASH_TOO_OLD_DARWIN : BASH_TOO_OLD);
  // Homebrew bash installed while the login shell is still the old one: fixed copy, no path.
  if (loginBash && pathBash && pathBash !== loginBash) {
    const other = bashVersion(deps, spec, pathBash);
    if (other && !versionBelow(other, spec.failBelow)) {
      deps.err(BASH_NEWER_NOT_LOGIN);
    }
  }
  return false;
}

/** D-09: macOS terminals start login shells; hint (read only) when ~/.bashrc would be skipped. */
function loginShellHint(deps: InitDeps): void {
  const login = loginFileSourcesBashrc((relPath) => deps.readFile(join(deps.home, relPath)));
  if (login.sourcesBashrc) {
    return;
  }
  const file = login.file ?? '~/.bash_profile';
  deps.err(`queque: macOS terminals start login shells; make ${file} source ~/.bashrc`);
  deps.err(BASHRC_SNIPPET);
}

export function runInit(shellArg: string | undefined, deps: InitDeps): InitResult {
  // Defensive bootstrap — main.ts also registers built-ins at startup.
  bootstrapBuiltins();
  const registered = new Set(listShellAdapters().map((adapter) => adapter.shell));
  const supported = shippedShellNames().filter((name) => registered.has(name));

  const shell = detectShell({ arg: shellArg, env: deps.env, userShell: deps.userShell });
  if (shellArg !== undefined && shell === null) {
    deps.err(`Unsupported shell: '${shellArg}'. Supported: ${supported.join(', ')}`);
    return refused;
  }
  if (shell === null) {
    deps.err(CANNOT_DETECT);
    return refused;
  }

  const spec = getShellSpec(shell);
  if (!spec.shipped) {
    deps.err(FISH_NOT_SHIPPED);
    return refused;
  }
  if (!supported.includes(shell)) {
    deps.err(`Unsupported shell: '${shell}'. Supported: ${supported.join(', ')}`);
    return refused;
  }

  if (shell === 'bash' && !bashGate(deps, spec)) {
    return refused;
  }

  const rcPath = join(deps.home, spec.rcFile);
  const existing = deps.readFile(rcPath) ?? '';
  let wrote = false;

  if (hasShellIntegration(existing, shell)) {
    deps.err(`queque: shell integration already present in ${spec.rcDisplay}`);
  } else {
    const scriptPath = (deps.adapterPath ?? resolveAdapterPath)(spec);
    deps.appendFile(rcPath, `\n${MARKER}\nsource "${scriptPath}"\n`);
    deps.out(
      `queque: added shell integration to ${spec.rcDisplay} — run: source ${spec.rcDisplay}`,
    );
    wrote = true;
  }

  if (shell === 'bash' && deps.platform === 'darwin') {
    loginShellHint(deps);
  }
  return { exitCode: 0, wrote };
}

/**
 * CLI entry: prints through deps and sets `process.exitCode` (no `process.exit`, so output
 * flushes). `shell` is optional: with none, init detects the login shell.
 */
export function initCommand(shell?: string, deps: InitDeps = defaultInitDeps()): void {
  const result = runInit(shell, deps);
  if (result.exitCode !== 0) {
    process.exitCode = result.exitCode;
  }
}
