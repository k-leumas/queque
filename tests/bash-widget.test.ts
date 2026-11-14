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
 *
 * Every shell starts without ZELLIJ* or TMUX. A missing bash 5 or jq skips locally and fails
 * when CI is set.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
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
  delete env.QQ_DEBUG_LOG_FILE;
  return { ...env, ...extra };
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
  return spawnBash(
    bash5 ?? 'bash',
    ['--noprofile', '--norc', '-i', '-c', `source '${adapterPath}'\n${script}`],
    env,
  );
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
    // Both clear paths depend on a successful paint.
    const clears = body.split('\n').filter((line) => line.includes("printf '\\e8\\e[J'"));
    expect(clears).toHaveLength(2);
    expect(body.match(/QQ_INSTANT_FRAME_PAINTED == 1/g)).toHaveLength(2);
  });
});

describe.skipIf(bash5 === null || jq === null)('bash adapter: instant frame (bash 5)', () => {
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
});
