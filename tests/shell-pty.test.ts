import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { build, type Options } from 'tsup';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import tsupConfig from '../tsup.config.js';
import { ciRequired, findBinary, findShell, shellVersionOf } from './helpers/shells.js';

// ---------------------------------------------------------------------------
// PTY round trips for every shell adapter (Phase 11 D-02, D-10; BASH-01).
//
// Guards the promise that `??` behaves the same in every supported shell: the adapter reads
// the live line, runs the unchanged `qq client`, and puts the result back into the line
// without running it. Unit tests of the adapter helpers cannot see readline or ZLE redraws,
// the key bindings or the terminal, so each test drives a real interactive shell in a private
// tmux server (tests/pty/drive.sh).
//
// The client is the real tsup bundle built into a temp dir (QQ_DEV_ROOT), in fixture mode
// (QQ_TEST_RESULT_MODE=replace-buffer-fixture writes the lbuffer back, or `echo hello` for an
// empty one), so no model is called. The shells start without ZELLIJ* or TMUX, with a
// throwaway HOME, QQ_DAEMON_PREWARMED=1 (handoff-quiet turns the prewarm back on in its rc),
// QQ_TELEMETRY=0 and QQ_INSTANT_FRAME=0 (frame bytes
// are guarded by the instant-frame parity test). Fixture mode still ensures the daemon, so a
// local run replaces the developer's dev daemon once (the next real `??` replaces it back).
//
// A missing shell, tmux or jq skips locally and fails when CI is set. Assertions are on
// captured screen lines, never on timing.
// ---------------------------------------------------------------------------

const BUILD_TIMEOUT_MS = 180_000;
const TEST_TIMEOUT_MS = 60_000;
const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const DRIVE = join(ROOT, 'tests', 'pty', 'drive.sh');
const PROMPT = 'QQPTY> ';

interface PtyShell {
  name: 'zsh' | 'bash';
  bin: string | null;
  adapter: string;
}

const tmux = ciRequired(findBinary('tmux'), 'tmux');
const jq = ciRequired(findBinary('jq'), 'jq');

const PTY_SHELLS: PtyShell[] = [
  {
    name: 'zsh',
    bin: ciRequired(findShell('zsh', { min: [5, 0] }), 'zsh 5.0+'),
    adapter: 'shell/zsh/queque.zsh',
  },
  {
    name: 'bash',
    bin: ciRequired(findShell('bash', { min: [5, 0] }), 'bash 5.0+'),
    adapter: 'shell/bash/queque.bash',
  },
];

function runnable(row: PtyShell): boolean {
  return row.bin !== null && tmux !== null && jq !== null;
}

function baseConfig(): Options {
  const config: unknown = tsupConfig;
  if (Array.isArray(config) || typeof config === 'function' || config === null) {
    throw new Error('tsup.config.ts must export a single options object');
  }
  return config as Options;
}

const UTF8_LOCALE = process.platform === 'darwin' ? 'en_US.UTF-8' : 'C.UTF-8';

let scratch = '';
let home = '';
let serverCount = 0;
const servers: string[] = [];

function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

interface Session {
  server: string;
  env: NodeJS.ProcessEnv;
  log: string;
}

/**
 * Multi-line diagnostics (screens, logs) as one quote-free line joined by ` | `: a multi-line
 * or nested-quote error message makes vitest's TAP output malformed (cerebrum 2026-10-08).
 */
function oneLine(text: string, lastLines = 12): string {
  return text.trimEnd().split('\n').slice(-lastLines).join(' | ').replace(/["\\]/g, "'");
}

function drive(session: Session, ...args: string[]): string {
  const run = spawnSync('bash', [DRIVE, args[0] ?? '', session.server, ...args.slice(1)], {
    encoding: 'utf8',
    env: session.env,
    timeout: TEST_TIMEOUT_MS,
  });
  if (run.status !== 0) {
    throw new Error(`drive.sh ${args.join(' ')} failed (${run.status}): ${oneLine(run.stderr)}`);
  }
  return run.stdout;
}

function screenLines(session: Session): string[] {
  return drive(session, 'capture')
    .split('\n')
    .map((line) => line.trimEnd());
}

/** Polls the screen until a line satisfies `match`; returns the screen lines. */
function waitForLine(session: Session, match: (line: string) => boolean, seconds = 20): string[] {
  const deadline = Date.now() + seconds * 1000;
  let lines: string[] = [];
  while (Date.now() < deadline) {
    lines = screenLines(session);
    if (lines.some(match)) return lines;
    sleepMs(50);
  }
  throw new Error(`timed out waiting for a matching line; screen: ${oneLine(lines.join('\n'))}`);
}

interface StartOptions {
  mode?: 'replace-buffer-fixture' | 'cancel';
  rc?: string[];
}

/** Starts `row`'s shell with the adapter sourced from a fresh rc file. */
function startShell(row: PtyShell, opts: StartOptions = {}): Session {
  serverCount += 1;
  const server = `qq-pty-${process.pid}-${row.name}-${serverCount}`;
  const rcdir = mkdtempSync(join(scratch, `${row.name}-rc-`));
  const rc = [
    `PS1='${PROMPT}'`,
    'HISTFILE=/dev/null',
    ...(opts.rc ?? []),
    `source '${join(ROOT, row.adapter)}'`,
    '',
  ].join('\n');
  writeFileSync(join(rcdir, row.name === 'zsh' ? '.zshrc' : 'bashrc'), rc);
  const log = join(scratch, `${server}-debug.log`);
  const env: NodeJS.ProcessEnv = {
    PATH: `${dirname(process.execPath)}:${process.env.PATH ?? '/usr/bin:/bin'}`,
    HOME: home,
    TERM: 'xterm-256color',
    LANG: UTF8_LOCALE,
    LC_ALL: UTF8_LOCALE,
    QQ_DEV_ROOT: scratch,
    QQ_DAEMON_PREWARMED: '1',
    QQ_TELEMETRY: '0',
    QQ_INSTANT_FRAME: '0',
    QQ_TEST_RESULT_MODE: opts.mode ?? 'replace-buffer-fixture',
    QQ_DEBUG_LOG_FILE: log,
    QQ_PTY_SHELL_BIN: row.bin ?? '',
    BASH_SILENCE_DEPRECATION_WARNING: '1',
  };
  const session: Session = { server, env, log };
  servers.push(server);
  drive(session, 'start', row.name, rcdir);
  drive(session, 'wait', PROMPT);
  return session;
}

function readLog(session: Session): string {
  try {
    return readFileSync(session.log, 'utf8');
  } catch {
    return '';
  }
}

beforeAll(async () => {
  if (!PTY_SHELLS.some(runnable)) return;
  scratch = mkdtempSync(join(tmpdir(), 'qq-pty-'));
  home = join(scratch, 'home');
  mkdirSync(home, { recursive: true });
  await build({
    ...baseConfig(),
    config: false,
    outDir: join(scratch, 'dist', 'cli'),
    dts: false,
    sourcemap: false,
    clean: false,
    silent: true,
  });
}, BUILD_TIMEOUT_MS);

afterAll(() => {
  for (const server of servers) {
    spawnSync('bash', [DRIVE, 'stop', server], { encoding: 'utf8' });
  }
  if (scratch) rmSync(scratch, { recursive: true, force: true });
});

/** Polls the debug log until it contains `fixed` (the client has finished writing its result). */
function waitForLog(session: Session, fixed: string, seconds = 20): void {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (readLog(session).includes(fixed)) return;
    sleepMs(50);
  }
  throw new Error(
    `timed out waiting for '${fixed}' in the debug log: ${oneLine(readLog(session))}`,
  );
}

/** The last non-empty screen line (the prompt line once the shell is idle). */
function lastLine(lines: string[]): string {
  return lines.filter((line) => line !== '').at(-1) ?? '';
}

/** Polls the screen until the last non-empty line equals `expected`. */
function waitForPromptLine(session: Session, expected: string, seconds = 20): string[] {
  const deadline = Date.now() + seconds * 1000;
  let lines: string[] = [];
  while (Date.now() < deadline) {
    lines = screenLines(session);
    if (lastLine(lines) === expected) return lines;
    sleepMs(50);
  }
  throw new Error(
    `timed out waiting for prompt '${expected}'; screen: ${oneLine(lines.join('\n'))}`,
  );
}

/** No job-control notice (`[1] 12345`, `Done`) may reach the screen. */
function expectNoJobNotice(session: Session): void {
  const lines = screenLines(session);
  expect(lines.filter((line) => /^\[\d+\]/.test(line) || /\bDone\b/.test(line))).toEqual([]);
}

/**
 * The adapter started its tool scan (`tool handoff started`) and the session dir it logged
 * (`[bash] tmpdir=…`) is gone within 3 s: the two-flag cleanup ran on whichever side was last.
 */
function expectSessionDirGone(session: Session): void {
  const log = readLog(session);
  expect(log).toContain('tool handoff started');
  const dir = /\[bash\] tmpdir=(\S+)/.exec(log)?.[1] ?? '';
  expect(dir).not.toBe('');
  const deadline = Date.now() + 3000;
  while (existsSync(dir) && Date.now() < deadline) sleepMs(25);
  expect(existsSync(dir)).toBe(false);
}

const PASTE_SKIP_REASON = 'bracketed paste is off by default before 5.1';

describe.each(PTY_SHELLS)('$name ?? in a PTY', (row) => {
  const version = row.bin ? shellVersionOf(row.bin) : null;
  const pasteOk = version !== null && (version[0] > 5 || (version[0] === 5 && version[1] >= 1));
  const viRc = row.name === 'zsh' ? 'bindkey -v' : 'set -o vi';
  const title = `${row.name} (${row.bin ?? 'not found'})`;

  describe.skipIf(!runnable(row))(title, { timeout: TEST_TIMEOUT_MS }, () => {
    it('round-trip: echo qqtrace?? comes back into the line', () => {
      const session = startShell(row);
      drive(session, 'type', 'echo qqtrace??');
      drive(session, 'wait', 'queque › echo qqtrace');
      drive(session, 'key', 'Enter');
      const lines = waitForLine(session, (line) => line === 'qqtrace');
      expect(lines).toContain('qqtrace');
      expect(readLog(session)).toContain('wrote replace-buffer result');
      expectNoJobNotice(session);
    });

    it('cancel: echo keepme?? keeps the line and prints no summary', () => {
      const session = startShell(row, { mode: 'cancel' });
      drive(session, 'type', 'echo keepme??');
      waitForLog(session, 'wrote cancel result');
      const lines = waitForPromptLine(session, `${PROMPT}echo keepme`);
      expect(lines.some((line) => line.includes('queque ›'))).toBe(false);
      drive(session, 'key', 'Enter');
      waitForLine(session, (line) => line === 'keepme');
      expectNoJobNotice(session);
    });

    it('cancel mid-line: the cursor comes back to the split point', () => {
      const session = startShell(row, { mode: 'cancel' });
      drive(session, 'type', 'echo keepme tail');
      drive(session, 'key', 'Left', 'Left', 'Left', 'Left', 'Left');
      drive(session, 'type', '??');
      waitForLog(session, 'wrote cancel result');
      waitForPromptLine(session, `${PROMPT}echo keepme tail`);
      drive(session, 'type', 'X');
      drive(session, 'key', 'Enter');
      // Typed at the restored cursor, not at the end of the line.
      waitForLine(session, (line) => line === 'keepmeX tail');
      expectNoJobNotice(session);
    });

    it('empty: ?? on an empty line reaches the client with no lbuffer', () => {
      const session = startShell(row);
      drive(session, 'type', '??');
      // The fixture writes back `echo hello` only for an empty lbuffer.
      waitForPromptLine(session, `${PROMPT}echo hello`);
      expect(screenLines(session).some((line) => line.includes('queque ›'))).toBe(false);
      drive(session, 'key', 'Enter');
      waitForLine(session, (line) => line === 'hello');
      expectNoJobNotice(session);
    });

    it('empty cancel: ?? on an empty line leaves exactly the prompt', () => {
      const session = startShell(row, { mode: 'cancel' });
      drive(session, 'type', '??');
      waitForLog(session, 'wrote cancel result');
      const lines = waitForPromptLine(session, PROMPT.trimEnd());
      expect(lastLine(lines)).toBe('QQPTY>');
      expectNoJobNotice(session);
    });

    it('multibyte: text before and after the cursor round-trips', () => {
      const session = startShell(row);
      drive(session, 'type', 'echo é😀 tail');
      drive(session, 'key', 'Left', 'Left', 'Left', 'Left', 'Left');
      drive(session, 'type', '??');
      drive(session, 'wait', 'queque › echo é😀');
      waitForPromptLine(session, `${PROMPT}echo é😀 tail`);
      drive(session, 'type', 'X');
      drive(session, 'key', 'Enter');
      // The cursor sat at the character length of the new lbuffer.
      waitForLine(session, (line) => line === 'é😀X tail');
      expectNoJobNotice(session);
    });

    it('vi-insert: echo vimode?? round-trips in vi insert mode', () => {
      const session = startShell(row, { rc: [viRc] });
      drive(session, 'type', 'echo vimode??');
      drive(session, 'wait', 'queque › echo vimode');
      drive(session, 'key', 'Enter');
      waitForLine(session, (line) => line === 'vimode');
      expectNoJobNotice(session);
    });

    it('paste: a pasted echo pasted?? never fires the trigger', (ctx) => {
      ctx.skip(!pasteOk, `${PASTE_SKIP_REASON} (${row.name} ${version?.join('.') ?? '?'})`);
      const session = startShell(row);
      drive(session, 'paste', 'echo pasted??');
      drive(session, 'wait', 'echo pasted??');
      drive(session, 'key', 'C-u');
      drive(session, 'type', 'echo after');
      drive(session, 'key', 'Enter');
      waitForLine(session, (line) => line === 'after');
      expect(screenLines(session).some((line) => line.includes('queque ›'))).toBe(false);
      expect(readLog(session)).not.toContain('trigger fired');
      expectNoJobNotice(session);
    });

    // bash only: zsh repaints the whole prompt itself (zle reset-prompt) and has no set -e
    // hazard inside a widget, so these rows are not registered for zsh at all.
    if (row.name === 'bash') {
      it('prompt-multiline: the head of a two-line PS1 is reprinted', () => {
        const session = startShell(row, { rc: ["PS1=$'QQTOP\\nQQPTY> '"] });
        drive(session, 'type', 'echo multi??');
        drive(session, 'wait', 'queque › echo multi');
        const expected = ['queque › echo multi', 'echo multi', 'QQTOP', `${PROMPT}echo multi`];
        const deadline = Date.now() + 20_000;
        let tail: string[] = [];
        while (Date.now() < deadline) {
          tail = screenLines(session)
            .filter((line) => line !== '')
            .slice(-4);
          if (tail.join('\n') === expected.join('\n')) break;
          sleepMs(50);
        }
        expect(tail).toEqual(expected);
        expectNoJobNotice(session);
      });

      it('errexit: a user set -e survives the round trip', () => {
        const session = startShell(row, { rc: ['set -e'] });
        drive(session, 'type', 'echo errexit??');
        drive(session, 'wait', 'queque › echo errexit');
        drive(session, 'key', 'Enter');
        waitForLine(session, (line) => line === 'errexit');
        drive(session, 'type', 'echo alive');
        drive(session, 'key', 'Enter');
        waitForLine(session, (line) => line === 'alive');
        expectNoJobNotice(session);
      });

      // Plan 11-07 (D-05): the detached tool scan and the source-time prewarm (on here) must
      // print no job notice, and the session dir must still go once both sides are done.
      it('handoff-quiet: the background scan and prewarm print no job notice', () => {
        const session = startShell(row, { rc: ['QQ_DAEMON_PREWARMED=0'] });
        drive(session, 'type', 'echo quiet??');
        drive(session, 'wait', 'queque › echo quiet');
        drive(session, 'key', 'Enter');
        waitForLine(session, (line) => line === 'quiet');
        drive(session, 'type', 'echo next');
        drive(session, 'key', 'Enter');
        waitForLine(session, (line) => line === 'next');
        expectNoJobNotice(session);
        expectSessionDirGone(session);
      });

      it('hostile-env: grep and rm aliases and a jq function do not break the round trip', () => {
        const session = startShell(row, {
          rc: ["alias grep='grep --color=always'", "alias rm='rm -i'", 'jq() { echo broken; }'],
        });
        drive(session, 'type', 'echo hostile??');
        drive(session, 'wait', 'queque › echo hostile');
        drive(session, 'key', 'Enter');
        waitForLine(session, (line) => line === 'hostile');
        expect(screenLines(session).filter((line) => /\bremove\b/.test(line))).toEqual([]);
        expectNoJobNotice(session);
        expectSessionDirGone(session);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// bash below 5.0 (D-12 as amended in the 11-11 UAT): the startup line, then `??` warns and
// both `?` stay on the line. Needs a bash < 5 at /bin/bash or /usr/bin/bash (macOS 3.2); CI's
// Linux runners have none, and the `bash-versions` job checks 3.2 and 4.4 in Docker instead,
// so this skips there the way bash-widget b2 does.
// ---------------------------------------------------------------------------

const oldBash =
  ['/bin/bash', '/usr/bin/bash'].find((bin) => {
    if (!existsSync(bin)) return false;
    const version = shellVersionOf(bin);
    return version !== null && version[0] < 5;
  }) ?? null;

describe.skipIf(oldBash === null || tmux === null)(
  `bash below 5.0 ?? warning in a PTY (${oldBash ?? 'not found'})`,
  { timeout: TEST_TIMEOUT_MS },
  () => {
    const row: PtyShell = { name: 'bash', bin: oldBash, adapter: 'shell/bash/queque.bash' };
    const version = oldBash ? shellVersionOf(oldBash) : null;
    const fix =
      process.platform === 'darwin' ? ': brew install bash (or sudo port install bash)' : '';
    const warning =
      'queque: bash 5.0 or newer is needed for the ?? trigger ' +
      `(this is bash ${version?.[0]}.${version?.[1]})${fix}`;

    beforeAll(() => {
      // The PTY_SHELLS beforeAll sets these up only when a bash 5 or zsh row is runnable.
      if (scratch) return;
      scratch = mkdtempSync(join(tmpdir(), 'qq-pty-'));
      home = join(scratch, 'home');
      mkdirSync(home, { recursive: true });
    });

    for (const mode of ['emacs', 'vi-insert'] as const) {
      it(`${mode}: ?? prints the warning and keeps both ? on the line`, () => {
        const session = startShell(row, { rc: mode === 'emacs' ? [] : ['set -o vi'] });
        const startup = screenLines(session).filter((line) => line.includes('needs bash 5.0+'));
        expect(startup).toHaveLength(1);
        drive(session, 'type', "echo 'qq??");
        waitForLine(session, (line) => line === warning);
        waitForPromptLine(session, `${PROMPT}echo 'qq??`);
        // A lone `?` waits for the next key on 3.2 (keyseq-timeout on 4.4), then self-inserts.
        drive(session, 'type', "' 'x?y'");
        waitForPromptLine(session, `${PROMPT}echo 'qq??' 'x?y'`);
        drive(session, 'key', 'Enter');
        waitForLine(session, (line) => line === 'qq?? x?y');
        expect(screenLines(session).filter((line) => line === warning)).toHaveLength(1);
        expect(readLog(session)).not.toContain('trigger fired');
      });
    }
  },
);
