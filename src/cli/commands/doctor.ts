import { type ChildProcess, spawn } from 'node:child_process';
import {
  accessSync,
  constants,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { basename, join } from 'node:path';
import {
  type DoctorCheck,
  type DoctorPlatform,
  type DoctorReport,
  doctorExitCode,
  doctorReportSchema,
} from '../../contracts/doctor.js';
import { isShellName, type ShellName } from '../../contracts/shell.js';
import { pingDaemonFetchCap, tryConnect } from '../../daemon/bootstrap.js';
import { type DetectedProvider, detectProvider } from '../../providers/detect.js';
import { loadProviderPin, type ProviderPinState } from '../../providers/provider-pin.js';
import {
  BASH_WARN_BELOW,
  detectShell,
  getShellSpec,
  loginFileSourcesBashrc,
  parseShellVersion,
  type ShellSpec,
  shippedShellNames,
  versionBelow,
} from '../../shared/shell-registry.js';
import { socketPath as defaultSocketPath } from '../../shared/socket-path.js';
import {
  readTelemetryState,
  type TelemetryBlockReason,
  type TelemetryState,
  telemetryBlockedBy,
} from '../../shared/telemetry-config.js';
import { resolveTelemetryEndpoint } from '../../shared/telemetry-endpoint.js';
import { hasShellIntegration } from './init.js';

// The version floors live in the shell registry (Phase 11 D-02); re-exported for callers that
// imported them from doctor in Phase 10.
export {
  BASH_FAIL_BELOW,
  BASH_WARN_BELOW,
  ZSH_FAIL_BELOW,
  ZSH_WARN_BELOW,
} from '../../shared/shell-registry.js';

/** Unix socket path limits from the Node docs (107 bytes on Linux, 103 on macOS). */
export const SOCKET_PATH_MAX_BYTES = { linux: 107, darwin: 103 } as const;
const SOCKET_PATH_MAX_DEFAULT = 107;

/** Node below this major is older than the supported LTS: `node` warns. */
const NODE_WARN_BELOW_MAJOR = 24;

const SHELL_VERSION_TIMEOUT_MS = 3000;
const SHELL_BINDINGS_TIMEOUT_MS = 5000;
/** After `exit`, wait this long for `close`: a grandchild (e.g. gitstatusd) may hold stdout. */
const EXIT_GRACE_MS = 100;
const MAX_CAPTURE_CHARS = 64 * 1024;

/** What `?` runs in each keymap the adapter binds, plus the bash readline extras. */
export interface ShellBindings {
  keymaps: Record<string, string | null>;
  /** bash `enable-bracketed-paste`; null when unknown or not applicable (zsh). */
  bracketedPaste: boolean | null;
  /** bash: ble.sh is loaded (it replaces readline). Always false for zsh. */
  bleLoaded: boolean;
}

/** Everything doctor reads, injectable so tests never spawn or touch the real machine. */
export interface DoctorDeps {
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  homeDir: string;
  uid: number;
  socketPath: string;
  nodeVersion: string;
  qqVersion: string;
  which(name: string): string | null;
  shellVersion(shell: ShellName): Promise<string | null>;
  shellBindings(shell: ShellName): Promise<ShellBindings | null>;
  /** Reads a file relative to `homeDir`; null when it is missing or unreadable. */
  readRc(relPath: string): string | null;
  /** The passwd login shell (`os.userInfo().shell`), the fallback when `$SHELL` is not a shell. */
  userShell?: string;
  probeTmp(): boolean;
  socketOwner(path: string): number | null;
  pingDaemon(path: string): Promise<'yes' | 'no' | 'unknown'>;
  /** Whether anything accepts a connection on the socket (told apart from a ping reply). */
  socketConnectable(path: string): Promise<boolean>;
  loadProviderPin(): ProviderPinState;
  detectProvider(): Promise<DetectedProvider>;
  /** Telemetry gate, consent state and whether this build has a project key (D-09, D-22). */
  telemetryStatus(): TelemetryStatus;
}

export interface TelemetryStatus {
  blockedBy: TelemetryBlockReason | null;
  state: TelemetryState;
  keyPresent: boolean;
}

// ---------------------------------------------------------------------------
// Real dependencies
// ---------------------------------------------------------------------------

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

/**
 * Runs a command with stdin ignored and returns its stdout, or null on a spawn error or a
 * timeout (the child is killed). Uses `spawn`, never a promise-wrapped `execFile`, so stdin
 * is really closed (cerebrum 2026-08-26). The exit code is not checked: callers parse.
 */
function captureStdout(
  command: string,
  args: string[],
  timeoutMs: number,
  env: NodeJS.ProcessEnv,
): Promise<string | null> {
  return new Promise((resolve) => {
    let stdout = '';
    let settled = false;
    let child: ChildProcess | undefined;
    let grace: ReturnType<typeof setTimeout> | undefined;
    const finish = (value: string | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (grace !== undefined) {
        clearTimeout(grace);
      }
      child?.stdout?.destroy();
      child?.stderr?.destroy();
      resolve(value);
    };
    const timer = setTimeout(() => {
      child?.kill('SIGKILL');
      finish(null);
    }, timeoutMs);

    try {
      child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      finish(null);
      return;
    }
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      if (stdout.length < MAX_CAPTURE_CHARS) {
        stdout += chunk;
      }
    });
    child.stderr?.resume();
    child.on('error', () => finish(null));
    child.on('close', () => finish(stdout));
    child.on('exit', () => {
      grace = setTimeout(() => finish(stdout), EXIT_GRACE_MS);
    });
  });
}

const BINDING_LINE = /^__qq_(emacs|viins)__ (.*)$/gm;
const BOUND_WIDGET = /^"\?" ([A-Za-z0-9_.:+-]{1,64})$/;

/**
 * Parses the marker lines printed by the binding probe. Only `"?" <widget>` after a marker
 * counts; anything else the user's ~/.zshrc prints is ignored. Null when no marker appeared.
 */
export function parseZshBindings(output: string): ShellBindings | null {
  const keymaps: Record<string, string | null> = { emacs: null, viins: null };
  let seen = false;
  for (const match of output.matchAll(BINDING_LINE)) {
    seen = true;
    const keymap = match[1] as 'emacs' | 'viins';
    const widget = BOUND_WIDGET.exec(match[2]?.trim() ?? '');
    keymaps[keymap] = widget?.[1] ?? null;
  }
  return seen ? { keymaps, bracketedPaste: null, bleLoaded: false } : null;
}

/**
 * bash binding probe, run with `bash -ic` after the version gate (3.2 has no `bind -X`). For
 * each keymap it prints the `bind -x` line for `?` or, failing that, the readline function from
 * `bind -p` (so `self-insert` can be named). Builtins are called with `builtin` and grep with
 * `command`, so the user's aliases cannot change the output. `BLE_VERSION` only decides a
 * boolean; its value is never reported.
 */
export const BASH_BINDINGS_SCRIPT =
  `for __qq_m in emacs vi-insert; do ` +
  `builtin printf '__qq_%s__ %s\\n' "$__qq_m" ` +
  `"$({ builtin bind -m "$__qq_m" -X; builtin bind -m "$__qq_m" -p; } 2>/dev/null ` +
  `| command grep -m 1 -F '"?"')"; done; ` +
  `builtin printf '__qq_paste__ %s\\n' ` +
  `"$(builtin bind -v 2>/dev/null | command grep -F enable-bracketed-paste)"; ` +
  `builtin printf '__qq_ble__ %s\\n' "\${BLE_VERSION:-}"`;

// Not anchored at a line start: readline may print `ESC[?1034h` right before a marker.
const BASH_MARKER = /__qq_(emacs|vi-insert|paste|ble)__ ?([^\n]*)/g;
/** `"?" "_qq_question"` (bind -X; bash 5.3 prints no colon), `"?": self-insert` (bind -p). */
const BASH_BOUND = /^"\?":?\s+"?([A-Za-z0-9_.:+-]{1,64})"?$/;
const BASH_PASTE = /^set enable-bracketed-paste (on|off)$/;

/**
 * Parses the marker lines printed by `BASH_BINDINGS_SCRIPT`; anything else ~/.bashrc or
 * readline prints is ignored. Null when no marker appeared.
 */
export function parseBashBindings(output: string): ShellBindings | null {
  const keymaps: Record<string, string | null> = { emacs: null, 'vi-insert': null };
  let bracketedPaste: boolean | null = null;
  let bleLoaded = false;
  let seen = false;
  for (const match of output.matchAll(BASH_MARKER)) {
    seen = true;
    const marker = match[1];
    const value = (match[2] ?? '').trim();
    if (marker === 'paste') {
      const paste = BASH_PASTE.exec(value);
      bracketedPaste = paste ? paste[1] === 'on' : null;
    } else if (marker === 'ble') {
      bleLoaded = value !== '';
    } else if (marker !== undefined) {
      keymaps[marker] = BASH_BOUND.exec(value)?.[1] ?? null;
    }
  }
  return seen ? { keymaps, bracketedPaste, bleLoaded } : null;
}

const BINDINGS_SCRIPT =
  `print -r -- "__qq_emacs__ $(bindkey -M emacs '?')"; ` +
  `print -r -- "__qq_viins__ $(bindkey -M viins '?')"`;

function probeTmpDir(): boolean {
  try {
    if (!statSync('/tmp').isDirectory()) {
      return false;
    }
    accessSync('/tmp', constants.W_OK);
    const dir = mkdtempSync('/tmp/qq-doctor-');
    rmSync(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function lstatOwner(path: string): number | null {
  try {
    return lstatSync(path).uid;
  } catch {
    return null;
  }
}

function passwdShell(): string | undefined {
  try {
    return userInfo().shell ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Probe env: a non-interactive bash reads `$BASH_ENV` even with `--norc`, and `ENV` in POSIX
 * mode, so both are dropped (cerebrum 2026-11-14).
 */
function probeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const { BASH_ENV: _bashEnv, ENV: _env, ...rest } = env;
  return rest;
}

export function defaultDoctorDeps(): DoctorDeps {
  const env = process.env;
  const homeDir = homedir();
  const which = (name: string) => whichOnPath(name, env.PATH);
  /** The binary `??` would run in: for bash the `$SHELL` bash, else the PATH one (D-12). */
  const shellBinary = (shell: ShellName): string | null => {
    const spec = getShellSpec(shell);
    if (!spec.shipped) {
      return null;
    }
    if (shell === 'bash' && env.SHELL && basename(env.SHELL) === 'bash') {
      return env.SHELL;
    }
    return shell === 'zsh' ? 'zsh' : which(spec.binary);
  };
  return {
    env,
    platform: process.platform,
    homeDir,
    uid: process.getuid?.() ?? 0,
    socketPath: defaultSocketPath(),
    nodeVersion: process.versions.node,
    qqVersion: __QUEQUE_VERSION__,
    which,
    shellVersion: async (shell) => {
      const binary = shellBinary(shell);
      if (binary === null) {
        return null;
      }
      const args = [...getShellSpec(shell).versionArgs];
      const out = await captureStdout(binary, args, SHELL_VERSION_TIMEOUT_MS, probeEnv(env));
      return out?.trim() || null;
    },
    shellBindings: async (shell) => {
      const binary = shellBinary(shell);
      if (binary === null) {
        return null;
      }
      // `-ic` sources the user's real rc file (~/.zshrc or ~/.bashrc): whatever it prints, how
      // slow it is, and, with the adapter installed, its source-time daemon prewarm. Contained:
      // QQ_DAEMON_PREWARMED=1 makes the adapter skip the prewarm, stdin is ignored, the child is
      // killed after the timeout, and stdout is only parsed for marker lines (stderr is
      // discarded); none of it is ever printed. runDoctorChecks only calls this for bash once
      // the version is 5.0 or newer.
      const script = shell === 'bash' ? BASH_BINDINGS_SCRIPT : BINDINGS_SCRIPT;
      const out = await captureStdout(binary, ['-ic', script], SHELL_BINDINGS_TIMEOUT_MS, {
        ...probeEnv(env),
        QQ_DAEMON_PREWARMED: '1',
      });
      if (out === null) {
        return null;
      }
      return shell === 'bash' ? parseBashBindings(out) : parseZshBindings(out);
    },
    readRc: (relPath) => {
      try {
        return readFileSync(join(homeDir, relPath), 'utf8');
      } catch {
        return null;
      }
    },
    userShell: passwdShell(),
    probeTmp: probeTmpDir,
    socketOwner: lstatOwner,
    pingDaemon: pingDaemonFetchCap,
    socketConnectable: tryConnect,
    loadProviderPin,
    detectProvider,
    telemetryStatus: () => ({
      blockedBy: telemetryBlockedBy(env),
      state: readTelemetryState(),
      keyPresent: resolveTelemetryEndpoint(env) !== null,
    }),
  };
}

// ---------------------------------------------------------------------------
// Checks. Every summary and hint is fixed copy plus a version number, the socket path, a
// widget name or a `~/` rc literal (`~/.zshrc`, `~/.bashrc`, `~/.bash_profile`,
// `~/.bash_login`, `~/.profile`, `~/.inputrc`): never an environment value, key, path under
// the home directory or file content (D-18: the JSON lands in public revert PR bodies).
// ---------------------------------------------------------------------------

const ok = (id: DoctorCheck['id'], summary: string): DoctorCheck => ({ id, status: 'ok', summary });
const warn = (id: DoctorCheck['id'], summary: string, hint: string): DoctorCheck => ({
  id,
  status: 'warn',
  summary,
  hint,
});
const fail = (id: DoctorCheck['id'], summary: string, hint: string): DoctorCheck => ({
  id,
  status: 'fail',
  summary,
  hint,
});

function installHint(spec: ShellSpec, platform: NodeJS.Platform): string {
  if (spec.shell === 'bash') {
    // D-14: macOS ships bash 3.2; Homebrew has a current one.
    return platform === 'darwin'
      ? `brew install bash (${BASH_WARN_BELOW} or newer), then make it your login shell`
      : `install bash ${BASH_WARN_BELOW} or newer with your package manager`;
  }
  return `install ${spec.shell} ${spec.warnBelow} or newer`;
}

interface VersionResult {
  check: DoctorCheck;
  /** The parsed version, or null when the shell is missing or its version is unreadable. */
  parts: number[] | null;
}

/** Before bash 5.1 readline's bracketed paste is off by default (and bash is untested). */
const BASH_PASTE_DEFAULT_SINCE = '5.1';

/**
 * The target shell's version row (id `zsh` or `bash`): fails below `failBelow` (D-12, D-20),
 * warns below `warnBelow`. Prints the parsed major.minor.patch only, never the raw build
 * string (`5.2.21(1)-release`).
 */
async function checkShellVersion(deps: DoctorDeps, spec: ShellSpec): Promise<VersionResult> {
  const id = spec.shell;
  const hint = installHint(spec, deps.platform);
  if (deps.which(spec.binary) === null) {
    return { check: fail(id, `${id} not found on PATH`, hint), parts: null };
  }
  let raw: string | null;
  try {
    raw = await deps.shellVersion(spec.shell);
  } catch {
    raw = null;
  }
  const parts = raw === null ? null : parseShellVersion(raw);
  if (parts === null) {
    return { check: warn(id, `${id} is on PATH but its version could not be read`, hint), parts };
  }
  const version = parts.slice(0, 3).join('.');
  if (versionBelow(parts, spec.failBelow)) {
    return { check: fail(id, `${id} ${version} is older than ${spec.failBelow}`, hint), parts };
  }
  if (versionBelow(parts, spec.warnBelow)) {
    const paste =
      spec.shell === 'bash' && versionBelow(parts, BASH_PASTE_DEFAULT_SINCE)
        ? `; bracketed paste is off by default before ${BASH_PASTE_DEFAULT_SINCE}`
        : '';
    const summary = `${id} ${version} is untested (oldest tested is ${spec.warnBelow}${paste})`;
    return { check: warn(id, summary, hint), parts };
  }
  return { check: ok(id, `${id} ${version}`), parts };
}

function checkJq(deps: DoctorDeps): DoctorCheck {
  if (deps.which('jq') === null) {
    return fail(
      'jq',
      'jq not found on PATH (the ?? widget builds and parses JSON with it)',
      'install jq with your package manager',
    );
  }
  return ok('jq', 'jq found');
}

function checkTmp(deps: DoctorDeps): DoctorCheck {
  if (!deps.probeTmp()) {
    return fail(
      'tmp',
      '/tmp is not a writable directory',
      'make /tmp a writable directory (chmod 1777 /tmp)',
    );
  }
  return ok('tmp', '/tmp is writable');
}

function checkSocket(deps: DoctorDeps): DoctorCheck {
  const limit =
    deps.platform === 'linux' || deps.platform === 'darwin'
      ? SOCKET_PATH_MAX_BYTES[deps.platform]
      : SOCKET_PATH_MAX_DEFAULT;
  const bytes = Buffer.byteLength(deps.socketPath);
  if (bytes > limit) {
    return fail(
      'socket',
      `daemon socket path is ${bytes} bytes, over the ${limit}-byte limit`,
      'report this as a QueQue bug: the socket path must be shorter',
    );
  }
  const owner = deps.socketOwner(deps.socketPath);
  if (owner !== null && owner !== deps.uid) {
    return fail(
      'socket',
      `${deps.socketPath} is owned by another user`,
      `remove ${deps.socketPath} (as its owner or root), then retry ??`,
    );
  }
  return ok('socket', `daemon socket ${deps.socketPath}`);
}

async function checkDaemon(deps: DoctorDeps): Promise<DoctorCheck> {
  let state: 'yes' | 'no' | 'unknown';
  try {
    state = await deps.pingDaemon(deps.socketPath);
  } catch {
    state = 'unknown';
  }
  if (state === 'yes') {
    return ok('daemon', 'daemon running');
  }
  if (state === 'no') {
    return warn(
      'daemon',
      'daemon outdated; replaced on the next ??',
      'nothing to do, or run `qq daemon --ensure` now',
    );
  }
  // `unknown` covers both "nothing listening" and "a listener that never sends a pong". The
  // second is the one where `??` stalls (ensureDaemon keeps a listener that does not answer),
  // so it must not read as a healthy "not running" (WR-03).
  let connectable = false;
  try {
    connectable = await deps.socketConnectable(deps.socketPath);
  } catch {
    connectable = false;
  }
  if (connectable) {
    return warn(
      'daemon',
      `a process accepts connections on ${deps.socketPath} but does not answer the daemon ping`,
      `stop the process holding ${deps.socketPath} (lsof -t ${deps.socketPath}); the next ?? starts a fresh daemon`,
    );
  }
  return ok('daemon', 'daemon not running; starts on the next ??');
}

function readRcSafe(deps: DoctorDeps, relPath: string): string | null {
  try {
    return deps.readRc(relPath);
  } catch {
    return null;
  }
}

/** The rc file is only regex-tested, never printed. */
function checkIntegration(deps: DoctorDeps, spec: ShellSpec): DoctorCheck {
  if (!hasShellIntegration(readRcSafe(deps, spec.rcFile) ?? '', spec.shell)) {
    return warn(
      'integration',
      `${spec.rcDisplay} does not load QueQue`,
      `qq init ${spec.shell} && source ${spec.rcDisplay}`,
    );
  }
  return ok('integration', `${spec.rcDisplay} loads QueQue`);
}

const BASHRC_SOURCE_LINE = '[ -f ~/.bashrc ] && . ~/.bashrc';

/**
 * macOS terminals start login shells, which read the first of `~/.bash_profile`,
 * `~/.bash_login`, `~/.profile` and skip `~/.bashrc` unless that file sources it (D-09).
 * Read only: doctor never edits a login file. Only the `~/` literal of the file is printed.
 */
function checkBashProfile(deps: DoctorDeps): DoctorCheck {
  const login = loginFileSourcesBashrc((relPath) => readRcSafe(deps, relPath));
  if (login.file === null) {
    return warn(
      'bash_profile',
      'no ~/.bash_profile, ~/.bash_login or ~/.profile; macOS login shells skip ~/.bashrc',
      `add ${BASHRC_SOURCE_LINE} to ~/.bash_profile`,
    );
  }
  if (!login.sourcesBashrc) {
    return warn(
      'bash_profile',
      `${login.file} does not source ~/.bashrc; macOS login shells skip it`,
      `add ${BASHRC_SOURCE_LINE} to ${login.file}`,
    );
  }
  return ok('bash_profile', `${login.file} sources ~/.bashrc`);
}

function bindingHint(spec: ShellSpec): string {
  return spec.shell === 'bash'
    ? 'qq init bash && source ~/.bashrc, then check what rebinds ? later in ~/.bashrc'
    : 'qq init zsh && source ~/.zshrc, then check plugins that rebind ?';
}

/**
 * `?` must run the adapter's widget in every keymap it binds. bash also needs readline (not
 * ble.sh, which replaces it; supporting ble.sh is out of scope) and bracketed paste, without
 * which pasted text containing `??` opens QueQue. Skipped (warn) when the version row failed,
 * and for bash also when its version is unreadable: bash 3.2 has no `bind -X`.
 */
async function checkBinding(
  deps: DoctorDeps,
  spec: ShellSpec,
  version: VersionResult,
): Promise<DoctorCheck> {
  const hint = bindingHint(spec);
  if (version.check.status === 'fail' || (spec.shell === 'bash' && version.parts === null)) {
    return warn(
      'binding',
      `? key bindings not checked: ${spec.shell} ${spec.failBelow} or newer is needed first`,
      installHint(spec, deps.platform),
    );
  }
  let bindings: ShellBindings | null;
  try {
    bindings = await deps.shellBindings(spec.shell);
  } catch {
    bindings = null;
  }
  if (bindings === null) {
    return warn(
      'binding',
      `could not read the ? key bindings from an interactive ${spec.shell}`,
      hint,
    );
  }
  if (bindings.bleLoaded) {
    return warn(
      'binding',
      'ble.sh is loaded and replaces readline; the ?? trigger needs plain readline',
      'start bash without ble.sh (remove it from ~/.bashrc) to use ??',
    );
  }
  for (const keymap of spec.bindingKeymaps) {
    const widget = bindings.keymaps[keymap] ?? null;
    if (widget === null) {
      return warn('binding', `? has no readable binding in the ${keymap} keymap`, hint);
    }
    if (widget !== spec.bindingWidget) {
      return warn('binding', `? is bound to ${widget} in the ${keymap} keymap`, hint);
    }
  }
  if (bindings.bracketedPaste === false) {
    return warn(
      'binding',
      'bracketed paste is off, so pasting text that contains ?? opens QueQue',
      'add set enable-bracketed-paste on to ~/.inputrc',
    );
  }
  return ok(
    'binding',
    `? is bound to ${spec.bindingWidget} in ${spec.bindingKeymaps.join(' and ')}`,
  );
}

function checkTerm(deps: DoctorDeps): DoctorCheck {
  const term = deps.env.TERM;
  const hint = 'run ?? in a terminal emulator that sets TERM (e.g. xterm-256color)';
  if (!term) {
    return warn('term', 'TERM is not set', hint);
  }
  if (term === 'dumb') {
    return warn('term', 'TERM is dumb', hint);
  }
  return ok('term', 'TERM is set');
}

function checkLocale(deps: DoctorDeps): DoctorCheck {
  const names = ['LC_ALL', 'LC_CTYPE', 'LANG'] as const;
  const source = names.find((name) => deps.env[name]);
  const value = source ? deps.env[source] : undefined;
  if (source && value && /utf-?8/i.test(value)) {
    return ok('locale', `locale is UTF-8 (from ${source})`);
  }
  return warn(
    'locale',
    source
      ? `locale is not UTF-8 (from ${source}); non-ASCII text may render badly`
      : 'no locale set (LC_ALL, LC_CTYPE, LANG); non-ASCII text may render badly',
    'export LANG=en_US.UTF-8 (or another UTF-8 locale)',
  );
}

const PROVIDER_HINT = 'run `claude /login`, set ANTHROPIC_API_KEY, or run `qq init provider`';

const DETECTED_NAMES: Record<Exclude<DetectedProvider['kind'], 'none'>, string> = {
  'anthropic-key': 'Claude (ANTHROPIC_API_KEY)',
  'claude-cli': 'Claude CLI login',
  ollama: 'Ollama',
  'openai-key': 'OpenAI (OPENAI_API_KEY)',
};

async function checkProvider(deps: DoctorDeps): Promise<DoctorCheck> {
  let pin: ProviderPinState;
  try {
    pin = deps.loadProviderPin();
  } catch {
    pin = { kind: 'invalid', path: '', message: '' };
  }
  if (pin.kind === 'pinned') {
    return ok('provider', `provider pinned to ${pin.pin.provider}`);
  }
  if (pin.kind === 'invalid') {
    // The pin path and its parse message can carry home paths and file text: never echoed.
    return warn('provider', 'provider pin is invalid', 'run `qq init provider` to rewrite it');
  }
  let detected: DetectedProvider;
  try {
    detected = await deps.detectProvider();
  } catch {
    return warn('provider', 'could not detect an AI provider', PROVIDER_HINT);
  }
  if (detected.kind === 'none') {
    return warn('provider', 'no AI provider configured', PROVIDER_HINT);
  }
  return ok('provider', `provider detected: ${DETECTED_NAMES[detected.kind]}`);
}

function checkNode(deps: DoctorDeps): DoctorCheck {
  const parts = parseShellVersion(deps.nodeVersion);
  if (parts === null) {
    return warn(
      'node',
      'Node version could not be read',
      `install Node ${NODE_WARN_BELOW_MAJOR} LTS`,
    );
  }
  const version = parts.join('.');
  if ((parts[0] ?? 0) < NODE_WARN_BELOW_MAJOR) {
    return warn(
      'node',
      `Node ${version} is older than ${NODE_WARN_BELOW_MAJOR}`,
      `install Node ${NODE_WARN_BELOW_MAJOR} LTS`,
    );
  }
  return ok('node', `Node ${version}`);
}

/**
 * Telemetry state (D-18): always ok, never a blocker. Names a blocking variable, never its
 * value, and never the install id.
 */
function checkTelemetry(deps: DoctorDeps): DoctorCheck {
  let status: TelemetryStatus;
  try {
    status = deps.telemetryStatus();
  } catch {
    return ok('telemetry', 'telemetry state could not be read (treated as off)');
  }
  if (status.blockedBy !== null) {
    return ok('telemetry', `telemetry off (${status.blockedBy} is set)`);
  }
  if (!status.state.enabled || status.state.installId === undefined) {
    return ok('telemetry', status.state.asked ? 'telemetry off' : 'telemetry off (not asked yet)');
  }
  return ok(
    'telemetry',
    status.keyPresent
      ? 'telemetry on'
      : 'telemetry on (no project key in this build: nothing is sent)',
  );
}

function reportPlatform(platform: NodeJS.Platform): DoctorPlatform {
  return platform === 'darwin' || platform === 'linux' ? platform : 'other';
}

/**
 * The shell a report targets (D-08): `options.shell` > `$SHELL` > the passwd shell (via
 * `detectShell`) > zsh. Only shipped shells are targets, so fish falls back to zsh until
 * Phase 12.
 */
export function resolveDoctorShell(deps: DoctorDeps, requested?: ShellName): ShellName {
  if (requested !== undefined && getShellSpec(requested).shipped) {
    return requested;
  }
  const detected = detectShell({ env: deps.env, userShell: deps.userShell });
  return detected !== null && getShellSpec(detected).shipped ? detected : 'zsh';
}

/**
 * Runs the checks for one target shell: its version row (`zsh` or `bash`), then `jq`, `tmp`,
 * `socket`, `daemon`, `integration`, `bash_profile` (bash on macOS only), `binding`, `term`,
 * `locale`, `provider`, `node`, `telemetry`. Only hard blockers that make `??` impossible fail
 * (D-12, D-17, D-19, D-20); everything else warns. The report is validated with
 * `doctorReportSchema` before it is returned.
 */
export async function runDoctorChecks(
  deps: DoctorDeps = defaultDoctorDeps(),
  options: { shell?: ShellName } = {},
): Promise<DoctorReport> {
  const spec = getShellSpec(resolveDoctorShell(deps, options.shell));
  const versionThenBinding = (async () => {
    const version = await checkShellVersion(deps, spec);
    return { version, binding: await checkBinding(deps, spec, version) };
  })();
  const [{ version, binding }, daemon, provider] = await Promise.all([
    versionThenBinding,
    checkDaemon(deps),
    checkProvider(deps),
  ]);
  const loginRow =
    spec.shell === 'bash' && deps.platform === 'darwin' ? [checkBashProfile(deps)] : [];
  const checks: DoctorCheck[] = [
    version.check,
    checkJq(deps),
    checkTmp(deps),
    checkSocket(deps),
    daemon,
    checkIntegration(deps, spec),
    ...loginRow,
    binding,
    checkTerm(deps),
    checkLocale(deps),
    provider,
    checkNode(deps),
    checkTelemetry(deps),
  ];
  return doctorReportSchema.parse({
    version: 1,
    ok: !checks.some((check) => check.status === 'fail'),
    qqVersion: deps.qqVersion,
    platform: reportPlatform(deps.platform),
    checks,
  });
}

const STATUS_MARKS: Record<DoctorCheck['status'], string> = { ok: '✓', warn: '⚠', fail: '✗' };

/**
 * Human checklist (D-18): one line per check with ✓, ⚠ or ✗ and the summary; warn and fail
 * lines end with ` — fix: HINT`. The last line counts the problems (warn plus fail).
 */
export function formatDoctorReport(report: DoctorReport): string {
  const lines = report.checks.map((check) => {
    const line = `${STATUS_MARKS[check.status]} ${check.summary}`;
    return check.status !== 'ok' && check.hint ? `${line} — fix: ${check.hint}` : line;
  });
  const problems = report.checks.filter((check) => check.status !== 'ok').length;
  lines.push(
    problems === 0
      ? 'qq doctor: no problems found'
      : `qq doctor: ${problems} problem${problems === 1 ? '' : 's'} found`,
  );
  return `${lines.join('\n')}\n`;
}

/**
 * `qq doctor [--json] [--shell <name>]`: prints the checklist or the JSON report to stdout and
 * sets the exit code (1 only for hard blockers). `--shell` picks the target shell; a shell that
 * is not shipped yet (fish) or not a shell name is a usage error: one line on stderr, no
 * report, exit 2 (exit 1 stays reserved for hard blockers). The rejected value is never echoed.
 * Sets `process.exitCode`, never `process.exit`, so the output flushes before the process ends.
 */
export async function doctorCommand(
  options: { json?: boolean; shell?: string },
  deps?: DoctorDeps,
): Promise<void> {
  const supported = shippedShellNames().join(', ');
  let shell: ShellName | undefined;
  if (options.shell !== undefined) {
    if (!isShellName(options.shell)) {
      process.stderr.write(`qq doctor: unsupported shell; supported: ${supported}\n`);
      process.exitCode = 2;
      return;
    }
    if (!getShellSpec(options.shell).shipped) {
      process.stderr.write(
        `qq doctor: ${options.shell} support is coming in a later release; supported now: ${supported}\n`,
      );
      process.exitCode = 2;
      return;
    }
    shell = options.shell;
  }
  const report = await runDoctorChecks(deps ?? defaultDoctorDeps(), { shell });
  process.stdout.write(
    options.json ? `${JSON.stringify(report, null, 2)}\n` : formatDoctorReport(report),
  );
  process.exitCode = doctorExitCode(report);
}
