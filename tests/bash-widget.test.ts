/**
 * Helper tests for the bash readline adapter (`shell/bash/queque.bash`, Phase 11 BASH-01).
 *
 * Strategy: mirror tests/zsh-widget.test.ts. Spawn a real bash with the adapter sourced and
 * call its functions directly with READLINE_LINE / READLINE_POINT set by hand, so no TTY is
 * needed. The adapter returns at once in a non-interactive shell, so every case that needs
 * the functions runs `bash -i -c`. The key bindings, readline redraws and the terminal are
 * covered by the PTY harness (tests/shell-pty.test.ts).
 *
 *   b1  non-interactive shells print nothing (bash 3.2 and 5)
 *   b2  bash below 5.0 refuses with one line and leaves `?` alone
 *   b3  replace-buffer: line, cursor, summary, query in history (D-13)
 *   b4  cancel / error / malformed / empty lbuffer restore the line and the cursor
 *   b5  insertion only (the bash mirror of the zsh CMD-04 checks)
 *   b6  a user's `set -e` survives the trigger
 *   b7  qq missing: one message, line restored
 *   b8  instant frame placement: lookup, paint (outside Zellij), then mktemp (mirrors zsh z10)
 *   b9  instant frame kill switch, no paint without a terminal, pane file, the two clears
 *   b10 tool handoff files: PATH tools, builtins, public functions and aliases (D-05)
 *   b11 compgen landmine: no aliases and only `_` functions still give all three files
 *   b12 a binary created after the hash table was primed is listed (SC-1 mirror)
 *   b13 the writer runs detached: tools.pending at once, files and no marker later
 *   b14 two-flag cleanup: whichever side finishes last removes the session dir once
 *   b15 QQ_TOOL_AWARENESS=0 writes no marker and no files
 *   b16 hostile aliases and a jq function corrupt neither the handoff nor the round trip
 *   b17 sourcing prewarms the daemon once, quietly; QQ_DAEMON_PREWARMED=1 skips it
 *   b21 the session dir is removed after a cancel result and after a client crash
 *   b18 Zellij: the floating-pane argv (frame wrapper, never the query); inline without ZELLIJ
 *   b19 Zellij: the FIFO line is applied, QQ_RESULT_FILE and the pane size are exported
 *   b20 Zellij: a pane that never answers gives the prompt back after the read timeout
 *   b22 Zellij: a failed mkfifo restores the line at once and launches nothing
 *   b23 Zellij: a zellij run that exits non-zero restores the line at once (sentinel line)
 *
 * Every shell starts without ZELLIJ* or TMUX, and with QQ_DAEMON_PREWARMED=1 so sourcing never
 * starts a real daemon (b17 clears it). A missing bash 5 or jq skips locally and fails when CI
 * is set.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { paneInstantFrameBytes } from '../src/shared/instant-frame-spec.js';
import { ciRequired, findBinary, findShell, shellVersionOf } from './helpers/shells.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const adapterPath = join(__dirname, '..', 'shell', 'bash', 'queque.bash');

const bash5 = ciRequired(findShell('bash', { min: [5, 0] }), 'bash 5.0+');
const jq = ciRequired(findBinary('jq'), 'jq');

/** A bash older than 5.0 for the refusal case (macOS /bin/bash is 3.2); CI covers it in Docker. */
const oldBash =
  ['/bin/bash', '/usr/bin/bash'].find((bin) => {
    if (!existsSync(bin)) return false;
    const version = shellVersionOf(bin);
    return version !== null && version[0] < 5;
  }) ?? null;

/** Job-control notices bash -i prints itself when stdin is not a terminal (not the adapter). */
const JOB_CONTROL_NOISE = /^bash: (no job control in this shell|cannot set terminal process group)/;

const scratch = mkdtempSync(join(tmpdir(), 'qq-bash-widget-'));

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

interface Run {
  stdout: string;
  stderr: string;
  status: number;
}

function cleanEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, BASH_SILENCE_DEPRECATION_WARNING: '1' };
  for (const key of ['ZELLIJ', 'ZELLIJ_PANE_ID', 'ZELLIJ_SESSION_NAME', 'TMUX', 'QQ_DEV_ROOT']) {
    delete env[key];
  }
  // Adapter knobs a developer may export: every case starts from the defaults.
  for (const key of [
    'QQ_DEBUG_LOG_FILE',
    'QQ_TOOL_AWARENESS',
    'QQ_INSTANT_FRAME',
    'QQ_PANE_WIDTH',
    'QQ_PANE_HEIGHT',
    'QQ_RESULT_FILE',
  ]) {
    delete env[key];
  }
  return { ...env, QQ_DAEMON_PREWARMED: '1', ...extra };
}

function spawnBash(bin: string, args: string[], env: NodeJS.ProcessEnv): Run {
  const result = spawnSync(bin, args, {
    encoding: 'utf8',
    timeout: 10_000,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    stdout: result.stdout ?? '',
    stderr: (result.stderr ?? '')
      .split('\n')
      .filter((line) => !JOB_CONTROL_NOISE.test(line))
      .join('\n'),
    status: result.status ?? 1,
  };
}

/** `bash -c` (non-interactive: the adapter must stay silent and define nothing). */
function runBash(bin: string, script: string, env: NodeJS.ProcessEnv = cleanEnv()): Run {
  return spawnBash(bin, ['--noprofile', '--norc', '-c', script], env);
}

/** `bash -i -c` with the adapter sourced first. */
function runInteractiveBash(script: string, env: NodeJS.ProcessEnv = cleanEnv()): Run {
  return runRawInteractiveBash(`source '${adapterPath}'\n${script}`, env);
}

/** `bash -i -c` that sources nothing itself (the script decides where the adapter is sourced). */
function runRawInteractiveBash(script: string, env: NodeJS.ProcessEnv = cleanEnv()): Run {
  return spawnBash(bash5 ?? 'bash', ['--noprofile', '--norc', '-i', '-c', script], env);
}

/** Prints the line state the way every case asserts it. */
const SHOW = 'echo "status=$st"; echo "line=[$READLINE_LINE]"; echo "point=$READLINE_POINT"';

/** Mid-line originals: `abc|def` with the cursor at 3. */
const MID_LINE = `QQ_ORIG_LBUFFER='abc'; QQ_ORIG_RBUFFER=' def'; QQ_ORIG_POINT=3
READLINE_LINE='mutated'; READLINE_POINT=0`;

describe('bash adapter: shells that must not see the trigger', () => {
  it('b1: a non-interactive shell prints nothing and exits 0 (bash 3.2 and 5)', () => {
    const shells = [oldBash, bash5].filter((bin): bin is string => bin !== null);
    expect(shells.length).toBeGreaterThan(0);
    for (const bin of shells) {
      const run = runBash(bin, `source '${adapterPath}'; echo ok`);
      expect(run.status, bin).toBe(0);
      expect(run.stdout, bin).toBe('ok\n');
      expect(run.stderr, bin).toBe('');
    }
  });

  it.skipIf(oldBash === null)('b2: bash below 5.0 refuses with one line, ? untouched', () => {
    const run = spawnBash(
      oldBash ?? 'bash',
      [
        '--noprofile',
        '--norc',
        '-i',
        '-c',
        `source '${adapterPath}'; type -t _qq_question || echo none`,
      ],
      cleanEnv(),
    );
    expect(run.status).toBe(0);
    expect(run.stdout).toBe('none\n');
    const lines = run.stderr.split('\n').filter((line) => line !== '');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('needs bash 5.0+');
  });
});

describe.skipIf(bash5 === null || jq === null)('bash adapter helpers (bash 5)', () => {
  it('b3: replace-buffer sets the line and cursor, prints the summary, records the query', () => {
    const json = JSON.stringify({
      kind: 'replace-buffer',
      lbuffer: 'du -ah . | sort -rh | head',
      rbuffer: '',
    });
    const run = runInteractiveBash(
      `QQ_ORIG_LBUFFER='find big files'; QQ_ORIG_RBUFFER=''; QQ_ORIG_POINT=14
READLINE_LINE='find big files'; READLINE_POINT=14
_qq_apply_result_str "$QQ_T_JSON"; st=$?
${SHOW}
history 1`,
      cleanEnv({ QQ_T_JSON: json }),
    );
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('status=0');
    expect(run.stdout).toContain('line=[du -ah . | sort -rh | head]');
    expect(run.stdout).toContain(`point=${'du -ah . | sort -rh | head'.length}`);
    expect(run.stdout).toContain('queque › find big files');
    expect(run.stdout).toContain('du -ah . | sort -rh | head\n');
    // D-13: the query is in history; the command only once the user runs it.
    const historyLine = run.stdout.trimEnd().split('\n').at(-1) ?? '';
    expect(historyLine).toMatch(/^\s*\d+\s+find big files$/);
  });

  it.each([
    ['cancel', JSON.stringify({ kind: 'cancel' }), 0, ''],
    ['error', JSON.stringify({ kind: 'error', message: 'queque: boom' }), 0, 'queque: boom'],
    ['malformed JSON', 'not json {', 1, ''],
    [
      'empty replace lbuffer',
      JSON.stringify({ kind: 'replace-buffer', lbuffer: '', rbuffer: 'x' }),
      1,
      '',
    ],
    ['unknown kind', JSON.stringify({ kind: 'surprise' }), 1, ''],
  ])('b4: %s restores the line and the cursor', (_name, json, status, message) => {
    const run = runInteractiveBash(
      `${MID_LINE}
_qq_apply_result_str "$QQ_T_JSON"; st=$?
${SHOW}`,
      cleanEnv({ QQ_T_JSON: json }),
    );
    expect(run.stdout).toContain(`status=${status}`);
    expect(run.stdout).toContain('line=[abc def]');
    expect(run.stdout).toContain('point=3');
    expect(run.stdout).not.toContain('queque ›');
    if (message) expect(run.stdout).toContain(message);
  });

  it('b4: a missing result file restores the line and the cursor', () => {
    const run = runInteractiveBash(`${MID_LINE}
_qq_apply_result '${join(scratch, 'no-such-result.json')}'; st=$?
${SHOW}`);
    expect(run.stdout).toContain('status=1');
    expect(run.stdout).toContain('line=[abc def]');
    expect(run.stdout).toContain('point=3');
  });

  it('b5: insertion only: the adapter never executes the line or a result field', () => {
    const source = readFileSync(adapterPath, 'utf8');
    const code = source
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');
    // No eval, no accept-line, no pushing input back into readline.
    expect(code).not.toMatch(/\beval\b/);
    expect(code).not.toMatch(/accept-line/);
    expect(code).not.toMatch(/\bbind\b[^\n]*(accept|\\C-m|\\n|\\r)/);
    // No line or result variable is ever run as a command or sourced.
    expect(code).not.toMatch(
      /^\s*(command\s+|builtin\s+|source\s+|\.\s+)?"?\$\{?(READLINE_LINE|new_l|new_r|json|message)\b/m,
    );
    // Only the query (never the command) is added to history.
    const historyCalls = code.split('\n').filter((line) => /\bhistory\s+-s\b/.test(line));
    expect(historyCalls).toHaveLength(1);
    expect(historyCalls[0]).toContain('"$QQ_ORIG_LBUFFER"');
    // The only bindings are `?` in emacs and vi-insert.
    const binds = code.split('\n').filter((line) => /^\s*bind\b/.test(line));
    expect(binds).toEqual([
      `bind -m emacs -x '"?": _qq_question'`,
      `bind -m vi-insert -x '"?": _qq_question'`,
    ]);
  });

  it('b5: replace-buffer puts a command into the line without running it', () => {
    const marker = join(scratch, 'ran-marker');
    const json = JSON.stringify({
      kind: 'replace-buffer',
      lbuffer: `touch '${marker}'`,
      rbuffer: '',
    });
    const run = runInteractiveBash(
      `QQ_ORIG_LBUFFER='make a file'; QQ_ORIG_RBUFFER=''; QQ_ORIG_POINT=11
_qq_apply_result_str "$QQ_T_JSON"; st=$?
${SHOW}`,
      cleanEnv({ QQ_T_JSON: json }),
    );
    expect(run.stdout).toContain(`line=[touch '${marker}']`);
    expect(existsSync(marker)).toBe(false);
  });

  it('b6: a user set -e survives the first ? and stays on', () => {
    const run = runInteractiveBash(`set -e
READLINE_LINE=x; READLINE_POINT=1
_qq_question
[[ $- == *e* ]] && echo survived
echo "line=[$READLINE_LINE] point=$READLINE_POINT"`);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('survived');
    expect(run.stdout).toContain('line=[x?] point=2');
  });

  it('b7: qq missing: the second ? prints the qq not found copy and restores the line', () => {
    // A PATH with jq but no qq (and no QQ_DEV_ROOT).
    const bin = mkdtempSync(join(scratch, 'bin-'));
    if (jq) symlinkSync(jq, join(bin, 'jq'));
    const run = runInteractiveBash(
      `READLINE_LINE='ask me? tail'; READLINE_POINT=7
_qq_question
echo "line=[$READLINE_LINE] point=$READLINE_POINT"`,
      cleanEnv({ PATH: `${bin}:/usr/bin:/bin` }),
    );
    expect(run.status).toBe(0);
    expect(run.stderr).toContain('queque: qq not found — run: qq init bash && source ~/.bashrc');
    expect(run.stdout).toContain('line=[ask me tail] point=6');
  });
});

// ---------------------------------------------------------------------------
// Plan 11-06 (D-04): the instant frame. The bytes are pinned against the TS reference by
// tests/instant-frame-parity.test.ts; these cases pin where and when bash paints and clears.
// ---------------------------------------------------------------------------

/** `ESC 8` + `CSI J`: back to the paint's own save on the reserve top, erase below. */
const FRAME_CLEAR = '\u001B8\u001B[J';

/** The `_qq_question` function body. */
function questionBody(): string {
  const source = readFileSync(adapterPath, 'utf8');
  const start = source.indexOf('_qq_question() {');
  const end = source.indexOf('\n}\n', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

/** A PATH dir with jq and the given fake tools (`#!/bin/sh` bodies). */
function fakeBin(tools: Record<string, string>): string {
  const bin = mkdtempSync(join(scratch, 'bin-'));
  if (jq) symlinkSync(jq, join(bin, 'jq'));
  for (const [name, body] of Object.entries(tools)) {
    writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  }
  return bin;
}

/**
 * Replaces the painter with one that records the call and marks the frame painted: without a
 * terminal on stdout the real painter (rightly) paints nothing, so the clear paths after it
 * could not be reached. The bytes of the real painter are covered by the parity test.
 */
const PAINT_PROBE = `_qq_paint_inline_instant_frame() { QQ_INSTANT_FRAME_PAINTED=1; printf 'PAINT[%s]' "$1"; return 0; }`;

describe('bash adapter: instant frame placement', () => {
  it('b8: lookup, then the inline paint (outside Zellij), then mktemp', () => {
    const body = questionBody();
    const lookup = body.indexOf('type -P qq');
    const notFound = body.indexOf('queque: qq not found');
    const paint = body.indexOf('_qq_paint_inline_instant_frame "$QQ_ORIG_LBUFFER"');
    const mktemp = body.indexOf('mktemp -d');
    expect(lookup).toBeGreaterThan(0);
    expect(notFound).toBeGreaterThan(lookup);
    expect(paint).toBeGreaterThan(notFound);
    expect(mktemp).toBeGreaterThan(paint);
    // Painted only when ZELLIJ is empty (the Zellij pane gets its frame through a file).
    expect(body).toMatch(
      /if \[\[ -z \$\{ZELLIJ:-\} \]\]; then\n\s+_qq_paint_inline_instant_frame "\$QQ_ORIG_LBUFFER"/,
    );
    // Every early stop after the paint clears it: mktemp failure, request.json failure, and a
    // non-zero client exit (a client that exits 0 clears its own frame in its first write).
    const clearAt = (from: number): number => body.indexOf('_qq_clear_instant_frame', from);
    const mktempFailed = body.indexOf('mktemp -d failed');
    const requestFailed = body.indexOf('request.json could not be written');
    const clientFailed = body.indexOf('qq_client_status != 0');
    expect(body.match(/_qq_clear_instant_frame/g)).toHaveLength(3);
    expect(clearAt(mktemp)).toBeLessThan(mktempFailed);
    expect(clearAt(mktempFailed)).toBeLessThan(requestFailed);
    expect(clearAt(clientFailed)).toBeGreaterThan(clientFailed);
    // The clear only restores a save the paint itself made.
    const source = readFileSync(adapterPath, 'utf8');
    const helper = source.slice(source.indexOf('_qq_clear_instant_frame() {'));
    expect(helper.slice(0, helper.indexOf('\n}\n'))).toMatch(
      /if \[\[ \$QQ_INSTANT_FRAME_PAINTED == 1 \]\]; then\n\s+printf '\\e8\\e\[J'/,
    );
  });
});

/** The trigger cases run jq, mktemp and the fake client in a `bash -i`: about 1 s each locally. */
const TRIGGER_TIMEOUT_MS = 20_000;

describe.skipIf(bash5 === null || jq === null)(
  'bash adapter: instant frame (bash 5)',
  {
    timeout: TRIGGER_TIMEOUT_MS,
  },
  () => {
    it('b9: QQ_INSTANT_FRAME=0 leaves REPLY empty, writes no file and returns 0 everywhere', () => {
      const dir = mkdtempSync(join(scratch, 'frame-off-'));
      const run = runInteractiveBash(
        `QQ_INSTANT_FRAME=0
trap 'echo TRAPPED' ERR
_qq_instant_frame 'echo hi' 78; s1=$?; f=$REPLY
_qq_inline_instant_frame_bytes 'echo hi' 78; s2=$?; b=$REPLY
_qq_paint_inline_instant_frame 'echo hi'; s3=$?
_qq_write_pane_instant_frame '${dir}' 'echo hi' 78; s4=$?
echo "frame=[$f] bytes=[$b] status=$s1$s2$s3$s4 painted=$QQ_INSTANT_FRAME_PAINTED"`,
      );
      expect(run.stdout).toContain('frame=[] bytes=[] status=0000 painted=0\n');
      expect(run.stdout).not.toContain('TRAPPED');
      expect(run.stderr.trim()).toBe('');
      expect(readdirSync(dir)).toEqual([]);
    });

    it('b9: the painter writes nothing when stdout is not a terminal or is closed', () => {
      const run = runInteractiveBash(`trap 'echo TRAPPED' ERR
printf 'A'; _qq_paint_inline_instant_frame 'echo hi'; s1=$?; printf 'B\\n'
_qq_paint_inline_instant_frame 'echo hi' >&-; s2=$?
echo "status=$s1$s2 painted=$QQ_INSTANT_FRAME_PAINTED"`);
      expect(run.stdout).toContain('AB\n');
      expect(run.stdout).toContain('status=00 painted=0\n');
      expect(run.stdout).not.toContain('TRAPPED');
      expect(run.stderr.trim()).toBe('');
    });

    it('b9: the pane writer writes the frame file and is silent for a missing dir', () => {
      const dir = mkdtempSync(join(scratch, 'frame-pane-'));
      const run = runInteractiveBash(`trap 'echo TRAPPED' ERR
_qq_write_pane_instant_frame '${dir}' 'echo hi' 78; s1=$?
_qq_write_pane_instant_frame /nonexistent/qq-instant-probe 'echo hi' 78; s2=$?
echo "status=$s1$s2"`);
      expect(run.stdout).toContain('status=00\n');
      expect(run.stdout).not.toContain('TRAPPED');
      expect(run.stderr.trim()).toBe('');
      expect(readdirSync(dir)).toEqual(['instant-frame.txt']);
      expect(readFileSync(join(dir, 'instant-frame.txt'), 'utf8').endsWith('\u001B[H')).toBe(true);
      expect(existsSync('/nonexistent/qq-instant-probe')).toBe(false);
    });

    it('b9: a non-zero client exit after a paint clears the frame', () => {
      const bin = fakeBin({ qq: 'exit 3' });
      const run = runInteractiveBash(
        `${PAINT_PROBE}
READLINE_LINE='ask?'; READLINE_POINT=4
_qq_question
echo "line=[$READLINE_LINE] point=$READLINE_POINT"`,
        cleanEnv({ PATH: `${bin}:/usr/bin:/bin`, QQ_DEBUG_LOG_FILE: join(scratch, 'b9.log') }),
      );
      expect(run.status).toBe(0);
      const paint = run.stdout.indexOf('PAINT[ask]');
      expect(paint).toBeGreaterThanOrEqual(0);
      expect(run.stdout.indexOf(FRAME_CLEAR)).toBeGreaterThan(paint);
      expect(run.stdout).toContain('line=[ask] point=3');
    });

    it('b9: a client that exits 0 clears its own frame; the adapter prints no clear', () => {
      const bin = fakeBin({ qq: 'exit 0' });
      const run = runInteractiveBash(
        `${PAINT_PROBE}
READLINE_LINE='ask?'; READLINE_POINT=4
_qq_question`,
        cleanEnv({ PATH: `${bin}:/usr/bin:/bin`, QQ_DEBUG_LOG_FILE: join(scratch, 'b9.log') }),
      );
      expect(run.stdout).toContain('PAINT[ask]');
      expect(run.stdout).not.toContain(FRAME_CLEAR);
    });

    it('b9: a failed mktemp after a paint clears the frame and keeps the line', () => {
      const bin = fakeBin({ qq: 'exit 0', mktemp: 'exit 1' });
      const run = runInteractiveBash(
        `${PAINT_PROBE}
READLINE_LINE='ask? tail'; READLINE_POINT=4
_qq_question
echo "line=[$READLINE_LINE] point=$READLINE_POINT"`,
        cleanEnv({ PATH: `${bin}:/usr/bin:/bin`, QQ_DEBUG_LOG_FILE: join(scratch, 'b9.log') }),
      );
      const paint = run.stdout.indexOf('PAINT[ask]');
      expect(paint).toBeGreaterThanOrEqual(0);
      expect(run.stdout.indexOf(FRAME_CLEAR)).toBeGreaterThan(paint);
      expect(run.stderr).toContain('queque: cannot create a temp dir in /tmp');
      expect(run.stdout).toContain('line=[ask tail] point=3');
    });
  },
);

// ---------------------------------------------------------------------------
// Plan 11-07 (D-05): the installed-tool handoff, the two-flag cleanup, the daemon prewarm and
// hostile shells. The client half (the tools.pending wait) is tests/tool-handoff.test.ts.
// ---------------------------------------------------------------------------

function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Polls `check` every 25 ms until it is true or `ms` has passed; returns the last result. */
function pollUntil(check: () => boolean, ms: number): boolean {
  const deadline = Date.now() + ms;
  for (;;) {
    if (check()) return true;
    if (Date.now() >= deadline) return false;
    sleepMs(25);
  }
}

/** The non-empty lines of a handoff file, or null when the file does not exist. */
function fileLines(path: string): string[] | null {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line !== '');
}

/** The session dir the adapter logged (`[bash] tmpdir=…`), or '' when it logged none. */
function sessionDirFromLog(log: string): string {
  const text = existsSync(log) ? readFileSync(log, 'utf8') : '';
  return /\[bash\] tmpdir=(\S+)/.exec(text)?.[1] ?? '';
}

const HANDOFF_FILES = ['commands.txt', 'builtins.txt', 'functions.txt'];

/**
 * Renames the real writer and wraps it with a delay, so a case can look at the session dir
 * while the detached writer is certainly still running. The wrapper still runs the real scan.
 */
const SLOW_WRITER = (seconds: number): string =>
  `source <(declare -f _qq_write_tool_handoff | command sed '1s/^_qq_write_tool_handoff/_qq_real_writer/')
_qq_write_tool_handoff() { command sleep ${seconds}; _qq_real_writer "$@"; }`;

/** The PATH every trigger case uses: fake tools, jq, node for a QQ_DEV_ROOT client, the system. */
function triggerPath(bin: string): string {
  return `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`;
}

/**
 * A QQ_DEV_ROOT whose dist/cli/main.js stands in for the client: QQ_T_MODE=crash exits 3
 * without a result, anything else writes `{"kind":"cancel"}` to --result-file.
 */
function fakeDevRoot(): string {
  const root = mkdtempSync(join(scratch, 'devroot-'));
  mkdirSync(join(root, 'dist', 'cli'), { recursive: true });
  writeFileSync(
    join(root, 'dist', 'cli', 'main.js'),
    `const args = process.argv.slice(2);
if (process.env.QQ_T_MODE === 'crash') process.exit(3);
require('node:fs').writeFileSync(args[args.indexOf('--result-file') + 1], '{"kind":"cancel"}\\n');
`,
  );
  return root;
}

/** A fake `qq` client that checks request.json with the real jq and writes a replace-buffer. */
const REPLACE_CLIENT = `while [ $# -gt 0 ]; do
  case "$1" in --request-file) req=$2; shift ;; --result-file) res=$2; shift ;; esac
  shift
done
jq -e '.lbuffer == "list files"' "$req" >/dev/null || exit 9
printf '%s\\n' '{"kind":"replace-buffer","lbuffer":"ls -la","rbuffer":""}' > "$res"`;

describe.skipIf(bash5 === null || jq === null)(
  'bash adapter: tool handoff, cleanup and prewarm (bash 5)',
  { timeout: TRIGGER_TIMEOUT_MS },
  () => {
    it('b10: the writer lists PATH tools, builtins, public functions and aliases', () => {
      const dir = mkdtempSync(join(scratch, 'handoff-'));
      const bin = fakeBin({ qqprobe10: 'exit 0' });
      const run = runInteractiveBash(
        `alias ll='ls -l'
myfn() { :; }
_private() { :; }
_qq_write_tool_handoff '${dir}'; echo "status=$?"`,
        cleanEnv({ PATH: triggerPath(bin) }),
      );
      expect(run.stdout).toContain('status=0');
      expect(run.stderr.trim()).toBe('');
      expect(fileLines(join(dir, 'commands.txt'))).toContain('qqprobe10');
      expect(fileLines(join(dir, 'builtins.txt'))).toContain('cd');
      const functions = fileLines(join(dir, 'functions.txt'));
      expect(functions).toContain('myfn');
      expect(functions).toContain('ll');
      expect(functions).not.toContain('_private');
    });

    it('b11: no aliases and only _ functions still give all three files', () => {
      const dir = mkdtempSync(join(scratch, 'handoff-landmine-'));
      const run = runInteractiveBash(
        `unalias -a
_only_private() { :; }
_qq_write_tool_handoff '${dir}'; echo "status=$?"`,
      );
      expect(run.stdout).toContain('status=0');
      expect(fileLines(join(dir, 'commands.txt'))?.length ?? 0).toBeGreaterThan(0);
      expect(fileLines(join(dir, 'builtins.txt'))?.length ?? 0).toBeGreaterThan(0);
      expect(fileLines(join(dir, 'functions.txt'))).toEqual([]);
    });

    it('b12: a binary created after the hash table was primed is listed', () => {
      const dir = mkdtempSync(join(scratch, 'handoff-fresh-'));
      const bin = fakeBin({ qqold12: 'exit 0' });
      const run = runInteractiveBash(
        `qqold12
echo "hashed=$(hash | command grep -c qqold12)"
command printf '#!/bin/sh\\nexit 0\\n' > '${bin}/qqnew12'
command chmod 755 '${bin}/qqnew12'
_qq_write_tool_handoff '${dir}'`,
        cleanEnv({ PATH: triggerPath(bin) }),
      );
      // The hash table really held the older probe before the new binary appeared.
      expect(run.stdout).toContain('hashed=1\n');
      expect(fileLines(join(dir, 'commands.txt'))).toContain('qqnew12');
    });

    it('b13: the writer runs detached: tools.pending at once, then the files and no marker', () => {
      const dir = mkdtempSync(join(scratch, 'handoff-async-'));
      const run = runInteractiveBash(
        `${SLOW_WRITER(1)}
t0=$EPOCHREALTIME
_qq_start_tool_handoff '${dir}'; st=$?
t1=$EPOCHREALTIME
[[ -e '${dir}/tools.pending' ]] && echo pending=yes
echo "status=$st ms=$(( (\${t1/./} - \${t0/./}) / 1000 ))"`,
      );
      // A scalar on one line (not a multi-line toContain diff), so the TAP report stays valid.
      const marker = /^pending=yes$/m.exec(run.stdout)?.[0] ?? run.stdout.trim();
      expect(marker).toBe('pending=yes');
      expect(run.stdout).toMatch(/status=0 ms=\d+/);
      // The writer sleeps 1 s before it scans: a synchronous start would take at least that.
      const ms = Number(/ms=(\d+)/.exec(run.stdout)?.[1] ?? '99999');
      expect(ms).toBeLessThan(500);
      expect(run.stderr.trim()).toBe('');
      const done = pollUntil(
        () =>
          !existsSync(join(dir, 'tools.pending')) &&
          HANDOFF_FILES.every((name) => existsSync(join(dir, name))),
        3000,
      );
      expect(done).toBe(true);
      // Nobody wrote `closed`, so the writer left the dir in place.
      expect(existsSync(dir)).toBe(true);
    });

    it('b14: cleanup during the scan leaves the dir to the writer, which removes it', () => {
      const dir = mkdtempSync(join(scratch, 'handoff-close-early-'));
      const run = runInteractiveBash(
        `${SLOW_WRITER(1)}
_qq_start_tool_handoff '${dir}'
_qq_cleanup '${dir}'
[[ -d '${dir}' ]] && echo kept=yes
[[ -e '${dir}/closed' ]] && echo closed=yes`,
      );
      expect(run.stdout).toContain('kept=yes');
      expect(run.stdout).toContain('closed=yes');
      expect(pollUntil(() => !existsSync(dir), 4000)).toBe(true);
    });

    it('b14: cleanup after the scan removes the dir at once', () => {
      const dir = mkdtempSync(join(scratch, 'handoff-close-late-'));
      const run = runInteractiveBash(
        `_qq_start_tool_handoff '${dir}'
for (( i = 0; i < 300; i++ )); do [[ -e '${dir}/tools.pending' ]] || break; command sleep 0.01; done
[[ -e '${dir}/commands.txt' ]] && echo scanned=yes
_qq_cleanup '${dir}'
[[ -e '${dir}' ]] || echo gone=yes`,
      );
      expect(run.stdout).toContain('scanned=yes');
      expect(run.stdout).toContain('gone=yes');
    });

    it('b15: QQ_TOOL_AWARENESS=0 writes no marker and no files', () => {
      const dir = mkdtempSync(join(scratch, 'handoff-off-'));
      const run = runInteractiveBash(
        `QQ_TOOL_AWARENESS=0
_qq_start_tool_handoff '${dir}'; s1=$?
_qq_write_tool_handoff '${dir}'; s2=$?
command sleep 0.3
echo "status=$s1$s2"`,
      );
      expect(run.stdout).toContain('status=00');
      expect(readdirSync(dir)).toEqual([]);
    });

    it('b16: hostile aliases and a jq function corrupt neither the handoff nor the round trip', () => {
      const dir = mkdtempSync(join(scratch, 'handoff-hostile-'));
      const bin = fakeBin({ qq: REPLACE_CLIENT });
      const log = join(scratch, 'b16.log');
      const run = runRawInteractiveBash(
        `alias grep='grep --color=always'
alias rm='rm -i'
jq() { echo broken; }
myfn() { :; }
source '${adapterPath}'
_qq_write_tool_handoff '${dir}'
READLINE_LINE='list files?'; READLINE_POINT=11
_qq_question
echo "line=[$READLINE_LINE] point=$READLINE_POINT"`,
        cleanEnv({ PATH: triggerPath(bin), QQ_DEBUG_LOG_FILE: log }),
      );
      for (const name of HANDOFF_FILES) {
        expect(existsSync(join(dir, name)), name).toBe(true);
        expect(readFileSync(join(dir, name), 'utf8').includes('\u001B'), name).toBe(false);
      }
      expect(fileLines(join(dir, 'functions.txt'))).toContain('myfn');
      // The fake client exits 9 without a result unless request.json parsed with the real jq.
      expect(run.stdout).toContain('line=[ls -la] point=6');
      expect(run.stdout).not.toContain('remove');
      expect(run.stderr).not.toContain('remove');
      const session = sessionDirFromLog(log);
      expect(session).not.toBe('');
      expect(readFileSync(log, 'utf8')).toContain('tool handoff started');
      expect(pollUntil(() => !existsSync(session), 3000)).toBe(true);
    });

    it('b17: sourcing prewarms the daemon once, prints nothing, and a second source does not', () => {
      const marker = join(scratch, 'b17-prewarm.log');
      const bin = fakeBin({ qq: `printf '%s\\n' "$*" >> '${marker}'` });
      const env = cleanEnv({ PATH: triggerPath(bin) });
      delete env.QQ_DAEMON_PREWARMED;
      const run = runRawInteractiveBash(
        `source '${adapterPath}'
source '${adapterPath}'
for (( i = 0; i < 100; i++ )); do [[ -s '${marker}' ]] && break; command sleep 0.05; done
command sleep 0.5`,
        env,
      );
      expect(run.stdout).toBe('');
      expect(run.stderr.trim()).toBe('');
      expect(fileLines(marker)).toEqual(['daemon --ensure']);
    });

    it('b17: QQ_DAEMON_PREWARMED=1 skips the prewarm', () => {
      const marker = join(scratch, 'b17-skip.log');
      const bin = fakeBin({ qq: `printf '%s\\n' "$*" >> '${marker}'` });
      const run = runRawInteractiveBash(
        `source '${adapterPath}'
command sleep 0.5`,
        cleanEnv({ PATH: triggerPath(bin), QQ_DAEMON_PREWARMED: '1' }),
      );
      expect(run.stdout).toBe('');
      expect(existsSync(marker)).toBe(false);
    });

    it('b21: after a cancel result the line is restored and the session dir is removed', () => {
      expectCleanExit('cancel');
    });

    it('b21: after a client crash (exit 3, no result) the line is restored, the dir removed', () => {
      expectCleanExit('crash');
    });

    /** b21: one trigger with the writer active and the QQ_DEV_ROOT client in `mode`. */
    function expectCleanExit(mode: 'cancel' | 'crash'): void {
      const root = fakeDevRoot();
      const log = join(scratch, `b21-${mode}.log`);
      const run = runInteractiveBash(
        `READLINE_LINE='ask? tail'; READLINE_POINT=4
_qq_question
echo "line=[$READLINE_LINE] point=$READLINE_POINT"`,
        cleanEnv({
          PATH: triggerPath(fakeBin({})),
          QQ_DEV_ROOT: root,
          QQ_T_MODE: mode,
          QQ_DEBUG_LOG_FILE: log,
        }),
      );
      expect(run.stdout).toContain('line=[ask tail] point=3');
      const text = readFileSync(log, 'utf8');
      expect(text).toContain('tool handoff started');
      expect(text).toContain(`client status=${mode === 'crash' ? 3 : 0}`);
      const session = sessionDirFromLog(log);
      expect(session).not.toBe('');
      expect(pollUntil(() => !existsSync(session), 3000)).toBe(true);
    }
  },
);

// ---------------------------------------------------------------------------
// Plan 11-07 (D-07): inside Zellij the unchanged client runs in a floating pane and the result
// comes back through a FIFO. `zellij` is always a shell function here, checked with
// `type -t zellij`, so no case can open a pane in a real session (cerebrum 2026-11-13).
// ---------------------------------------------------------------------------

/** The query every Zellij case types (its text must never reach the zellij argv). */
const ZELLIJ_QUERY = 'find qqsecret files';

/**
 * The fake `zellij`: records its argv, the pane env and the pane frame file into $QQ_T_OUT,
 * then acts per $QQ_T_ZMODE: `reply` writes a replace-buffer line into the --result-file FIFO
 * from a background subshell, `silent` writes nothing (a dead pane), `fail` returns 1 at once.
 */
const ZELLIJ_FAKE = `zellij() {
  local a prev='' res='' frame=''
  printf '%s\\n' "$@" >"$QQ_T_OUT/argv"
  command printenv QQ_RESULT_FILE >"$QQ_T_OUT/result-file-env"
  # One name per printenv: BSD printenv (macOS) prints only the first of several.
  { command printenv QQ_PANE_WIDTH; command printenv QQ_PANE_HEIGHT; } >"$QQ_T_OUT/pane-env"
  for a in "$@"; do
    [[ $prev == --result-file ]] && res=$a
    [[ $prev == queque-instant-frame ]] && frame=$a
    prev=$a
  done
  [[ -n $frame ]] && command cp -f "$frame" "$QQ_T_OUT/frame.txt"
  case $QQ_T_ZMODE in
    reply) ( printf '%s\\n' '{"kind":"replace-buffer","lbuffer":"ls -la","rbuffer":""}' >"$res" & ) ;;
    fail) return 1 ;;
  esac
  return 0
}
echo "zellij=$(type -t zellij)"`;

interface ZellijRun {
  run: Run;
  out: string;
  root: string;
  log: string;
  session: string;
  ms: number;
}

/** One `??` on `find qqsecret files?` with the fake zellij, ZELLIJ=0 unless `env` unsets it. */
function runZellijTrigger(
  mode: 'reply' | 'silent' | 'fail',
  opts: { bin?: string; env?: NodeJS.ProcessEnv; before?: string } = {},
): ZellijRun {
  const out = mkdtempSync(join(scratch, 'zellij-out-'));
  const root = fakeDevRoot();
  const log = join(out, 'debug.log');
  const run = runInteractiveBash(
    `${ZELLIJ_FAKE}
${opts.before ?? ''}
READLINE_LINE='${ZELLIJ_QUERY}?'; READLINE_POINT=${ZELLIJ_QUERY.length + 1}
t0=$EPOCHREALTIME
_qq_question
t1=$EPOCHREALTIME
echo "line=[$READLINE_LINE] point=$READLINE_POINT"
echo "ms=$(( (\${t1/./} - \${t0/./}) / 1000 ))"
history 1`,
    cleanEnv({
      PATH: triggerPath(opts.bin ?? fakeBin({})),
      ZELLIJ: '0',
      QQ_DEV_ROOT: root,
      QQ_DEBUG_LOG_FILE: log,
      QQ_T_OUT: out,
      QQ_T_ZMODE: mode,
      ...opts.env,
    }),
  );
  const ms = Number(/^ms=(\d+)$/m.exec(run.stdout)?.[1] ?? '99999');
  return { run, out, root, log, session: sessionDirFromLog(log), ms };
}

const RESTORED = `line=[${ZELLIJ_QUERY}] point=${ZELLIJ_QUERY.length}`;

describe.skipIf(bash5 === null || jq === null)(
  'bash adapter: Zellij floating pane (bash 5)',
  { timeout: TRIGGER_TIMEOUT_MS },
  () => {
    it('b18: zellij run gets the pane argv with the frame wrapper and never the query', () => {
      const z = runZellijTrigger('reply');
      expect(z.run.stdout).toContain('zellij=function\n');
      expect(existsSync(join(z.out, 'argv'))).toBe(true);
      const argv = fileLines(join(z.out, 'argv'));
      expect(argv).toEqual([
        'run',
        '--floating',
        '--close-on-exit',
        '--width',
        '80',
        '--height',
        '24',
        '--name',
        'qq',
        '--',
        '/bin/sh',
        '-c',
        'cat "$1" 2>/dev/null; shift; exec "$@"',
        'queque-instant-frame',
        `${z.session}/instant-frame.txt`,
        'node',
        `${z.root}/dist/cli/main.js`,
        'client',
        '--request-file',
        `${z.session}/request.json`,
        '--result-file',
        `${z.session}/result.fifo`,
      ]);
      expect(argv?.some((arg) => arg.includes('qqsecret'))).toBe(false);
    });

    it('b18: with ZELLIJ unset the inline path runs and zellij is never called', () => {
      // spawnSync drops undefined values, so this shell starts with no ZELLIJ at all.
      const z = runZellijTrigger('reply', { env: { ZELLIJ: undefined } });
      expect(z.run.stdout).toContain('zellij=function\n');
      expect(existsSync(join(z.out, 'argv'))).toBe(false);
      // The QQ_DEV_ROOT client answered cancel on the inline path.
      expect(readFileSync(z.log, 'utf8')).toContain('client status=0');
      expect(z.run.stdout).toContain(RESTORED);
    });

    it('b19: the FIFO line is applied, QQ_RESULT_FILE is the FIFO, the pane size is exported', () => {
      const z = runZellijTrigger('reply');
      expect(z.run.stdout).toContain('line=[ls -la] point=6');
      expect(z.run.stdout).toContain(`queque › ${ZELLIJ_QUERY}`);
      expect(z.run.stdout).toContain('ls -la\n');
      const historyLine = z.run.stdout.trimEnd().split('\n').at(-1) ?? '';
      expect(historyLine).toMatch(new RegExp(`^\\s*\\d+\\s+${ZELLIJ_QUERY}$`));
      expect(fileLines(join(z.out, 'result-file-env'))).toEqual([`${z.session}/result.fifo`]);
      expect(fileLines(join(z.out, 'pane-env'))).toEqual(['80', '24']);
      expect(pollUntil(() => !existsSync(z.session), 3000)).toBe(true);
    });

    it('b19: QQ_PANE_WIDTH=100 gives --width 100 and a 98-column pane frame', () => {
      const z = runZellijTrigger('reply', { env: { QQ_PANE_WIDTH: '100' } });
      const argv = fileLines(join(z.out, 'argv')) ?? [];
      expect(argv.slice(3, 7)).toEqual(['--width', '100', '--height', '24']);
      expect(fileLines(join(z.out, 'pane-env'))).toEqual(['100', '24']);
      const frame = readFileSync(join(z.out, 'frame.txt'), 'utf8');
      expect(frame).toBe(paneInstantFrameBytes(ZELLIJ_QUERY, '98'));
    });

    it('b20: a pane that never answers gives the prompt back after the read timeout', () => {
      const z = runZellijTrigger('silent', { before: 'QQ_RESULT_READ_TIMEOUT_S=1' });
      expect(existsSync(join(z.out, 'argv'))).toBe(true);
      expect(z.ms).toBeLessThan(5000);
      expect(z.run.stdout).toContain(RESTORED);
      expect(z.run.stdout).not.toContain('queque ›');
      expect(z.session).not.toBe('');
      expect(pollUntil(() => !existsSync(z.session), 3000)).toBe(true);
    });

    it('b22: a failed mkfifo restores the line, logs the reason and launches nothing', () => {
      const z = runZellijTrigger('reply', { bin: fakeBin({ mkfifo: 'exit 1' }) });
      expect(z.ms).toBeLessThan(2000);
      expect(z.run.stdout).toContain(RESTORED);
      expect(readFileSync(z.log, 'utf8')).toContain('mkfifo failed');
      expect(existsSync(join(z.out, 'argv'))).toBe(false);
      expect(z.session).not.toBe('');
      expect(pollUntil(() => !existsSync(z.session), 3000)).toBe(true);
    });

    it('b23: a zellij run that fails at once restores the line well before the timeout', () => {
      const z = runZellijTrigger('fail');
      expect(z.run.stdout).toContain('zellij=function\n');
      expect(existsSync(join(z.out, 'argv'))).toBe(true);
      expect(z.ms).toBeLessThan(5000);
      expect(z.run.stdout).toContain(RESTORED);
      expect(z.run.stdout).not.toContain('queque ›');
      expect(readFileSync(z.log, 'utf8')).toContain('zellij run failed');
      expect(z.session).not.toBe('');
      expect(pollUntil(() => !existsSync(z.session), 3000)).toBe(true);
    });
  },
);
