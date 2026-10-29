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
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  type DoctorCheck,
  type DoctorPlatform,
  type DoctorReport,
  doctorExitCode,
  doctorReportSchema,
} from '../../contracts/doctor.js';
import { pingDaemonFetchCap } from '../../daemon/bootstrap.js';
import { type DetectedProvider, detectProvider } from '../../providers/detect.js';
import { loadProviderPin, type ProviderPinState } from '../../providers/provider-pin.js';
import { socketPath as defaultSocketPath } from '../../shared/socket-path.js';
import {
  readTelemetryState,
  type TelemetryBlockReason,
  type TelemetryState,
  telemetryBlockedBy,
} from '../../shared/telemetry-config.js';
import { resolveTelemetryEndpoint } from '../../shared/telemetry-endpoint.js';
import { hasShellIntegration } from './init.js';

/** zsh below this version cannot run the widget: `zsh` fails (D-20). */
export const ZSH_FAIL_BELOW = '5.0';
/** zsh below this version is untested: `zsh` warns (D-20; 5.8 is Ubuntu 22.04, the oldest CI). */
export const ZSH_WARN_BELOW = '5.8';

/** Unix socket path limits from the Node docs (107 bytes on Linux, 103 on macOS). */
export const SOCKET_PATH_MAX_BYTES = { linux: 107, darwin: 103 } as const;
const SOCKET_PATH_MAX_DEFAULT = 107;

/** Node below this major is older than the supported LTS: `node` warns. */
const NODE_WARN_BELOW_MAJOR = 24;

const QQ_WIDGET = 'qq-question-widget';
const ZSH_VERSION_TIMEOUT_MS = 3000;
const ZSH_BINDINGS_TIMEOUT_MS = 5000;
/** After `exit`, wait this long for `close`: a grandchild (e.g. gitstatusd) may hold stdout. */
const EXIT_GRACE_MS = 100;
const MAX_CAPTURE_CHARS = 64 * 1024;

export interface ZshBindings {
  emacs: string | null;
  viins: string | null;
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
  zshVersion(): Promise<string | null>;
  zshBindings(): Promise<ZshBindings | null>;
  readZshrc(): string | null;
  probeTmp(): boolean;
  socketOwner(path: string): number | null;
  pingDaemon(path: string): Promise<'yes' | 'no' | 'unknown'>;
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
export function parseZshBindings(output: string): ZshBindings | null {
  const result: ZshBindings = { emacs: null, viins: null };
  let seen = false;
  for (const match of output.matchAll(BINDING_LINE)) {
    seen = true;
    const keymap = match[1] as 'emacs' | 'viins';
    const widget = BOUND_WIDGET.exec(match[2]?.trim() ?? '');
    result[keymap] = widget?.[1] ?? null;
  }
  return seen ? result : null;
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

export function defaultDoctorDeps(): DoctorDeps {
  const env = process.env;
  const homeDir = homedir();
  return {
    env,
    platform: process.platform,
    homeDir,
    uid: process.getuid?.() ?? 0,
    socketPath: defaultSocketPath(),
    nodeVersion: process.versions.node,
    qqVersion: __QUEQUE_VERSION__,
    which: (name) => whichOnPath(name, env.PATH),
    zshVersion: async () => {
      const out = await captureStdout(
        'zsh',
        ['-fc', 'print -r -- $ZSH_VERSION'],
        ZSH_VERSION_TIMEOUT_MS,
        env,
      );
      return out?.trim() || null;
    },
    zshBindings: async () => {
      // QQ_DAEMON_PREWARMED=1 makes the sourced widget skip its daemon prewarm.
      const out = await captureStdout('zsh', ['-ic', BINDINGS_SCRIPT], ZSH_BINDINGS_TIMEOUT_MS, {
        ...env,
        QQ_DAEMON_PREWARMED: '1',
      });
      return out === null ? null : parseZshBindings(out);
    },
    readZshrc: () => {
      try {
        return readFileSync(join(homeDir, '.zshrc'), 'utf8');
      } catch {
        return null;
      }
    },
    probeTmp: probeTmpDir,
    socketOwner: lstatOwner,
    pingDaemon: pingDaemonFetchCap,
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
// widget name or the literal `~/.zshrc`: never an environment value, key, path under the
// home directory or file content (D-18: the JSON lands in public revert PR bodies).
// ---------------------------------------------------------------------------

const VERSION_PREFIX = /^\d+(?:\.\d+)*/;

function versionParts(text: string): number[] | null {
  const match = VERSION_PREFIX.exec(text.trim());
  return match ? match[0].split('.').map(Number) : null;
}

function versionBelow(version: number[], threshold: string): boolean {
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

const ZSH_INSTALL_HINT = `install zsh ${ZSH_WARN_BELOW} or newer`;

async function checkZsh(deps: DoctorDeps): Promise<DoctorCheck> {
  if (deps.which('zsh') === null) {
    return fail('zsh', 'zsh not found on PATH', ZSH_INSTALL_HINT);
  }
  const raw = await deps.zshVersion();
  const parts = raw === null ? null : versionParts(raw);
  if (parts === null) {
    return warn('zsh', 'zsh is on PATH but its version could not be read', ZSH_INSTALL_HINT);
  }
  const version = parts.join('.');
  if (versionBelow(parts, ZSH_FAIL_BELOW)) {
    return fail('zsh', `zsh ${version} is older than ${ZSH_FAIL_BELOW}`, ZSH_INSTALL_HINT);
  }
  if (versionBelow(parts, ZSH_WARN_BELOW)) {
    return warn(
      'zsh',
      `zsh ${version} is untested (oldest tested is ${ZSH_WARN_BELOW})`,
      ZSH_INSTALL_HINT,
    );
  }
  return ok('zsh', `zsh ${version}`);
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
  return ok('daemon', 'daemon not running; starts on the next ??');
}

function checkIntegration(deps: DoctorDeps): DoctorCheck {
  if (!hasShellIntegration(deps.readZshrc() ?? '', 'zsh')) {
    return warn('integration', '~/.zshrc does not load QueQue', 'qq init zsh && source ~/.zshrc');
  }
  return ok('integration', '~/.zshrc loads QueQue');
}

async function checkBinding(deps: DoctorDeps): Promise<DoctorCheck> {
  let bindings: ZshBindings | null;
  try {
    bindings = await deps.zshBindings();
  } catch {
    bindings = null;
  }
  const hint = 'qq init zsh && source ~/.zshrc, then check plugins that rebind ?';
  if (bindings === null) {
    return warn('binding', 'could not read the ? key bindings from an interactive zsh', hint);
  }
  for (const keymap of ['emacs', 'viins'] as const) {
    const widget = bindings[keymap];
    if (widget === null) {
      return warn('binding', `? has no readable binding in the ${keymap} keymap`, hint);
    }
    if (widget !== QQ_WIDGET) {
      return warn('binding', `? is bound to ${widget} in the ${keymap} keymap`, hint);
    }
  }
  return ok('binding', `? is bound to ${QQ_WIDGET} in emacs and viins`);
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
  const parts = versionParts(deps.nodeVersion);
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
 * Runs every check in `DOCTOR_CHECK_IDS` order. Only hard blockers that make `??`
 * impossible fail (D-17, D-19, D-20); everything else warns. The report is validated with
 * `doctorReportSchema` before it is returned.
 */
export async function runDoctorChecks(
  deps: DoctorDeps = defaultDoctorDeps(),
): Promise<DoctorReport> {
  const [zsh, daemon, binding, provider] = await Promise.all([
    checkZsh(deps),
    checkDaemon(deps),
    checkBinding(deps),
    checkProvider(deps),
  ]);
  const checks: DoctorCheck[] = [
    zsh,
    checkJq(deps),
    checkTmp(deps),
    checkSocket(deps),
    daemon,
    checkIntegration(deps),
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
 * `qq doctor [--json]`: prints the checklist or the JSON report to stdout and sets the exit
 * code (1 only for hard blockers). Sets `process.exitCode`, never `process.exit`, so the
 * output flushes before the process ends.
 */
export async function doctorCommand(options: { json?: boolean }, deps?: DoctorDeps): Promise<void> {
  const report = await runDoctorChecks(deps ?? defaultDoctorDeps());
  process.stdout.write(
    options.json ? `${JSON.stringify(report, null, 2)}\n` : formatDoctorReport(report),
  );
  process.exitCode = doctorExitCode(report);
}
