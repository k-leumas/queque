/**
 * Smoke tests for the zsh ZLE widget (`shell/zsh/queque.zsh`).
 *
 * Strategy: spawn a real zsh process with the widget sourced and exercise
 * single-`?` insertion, `??`-trigger capture, and result application through
 * helper shell functions that mirror what the widget does. The tests do NOT
 * require an interactive TTY — they call the internal shell functions directly.
 *
 * Coverage:
 *   Task 1:
 *     - Single `?` inserts without a KEYTIMEOUT delay.
 *     - `??` removes the trigger from lbuffer and preserves rbuffer.
 *     - Launch command uses /dev/tty for stdin/stdout.
 *   Task 2:
 *     - `{kind: cancel}` restores original buffers.
 *     - `{kind: replace-buffer}` writes new lbuffer/rbuffer.
 *     - Malformed JSON leaves original buffers intact and exits nonzero.
 */

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { inlineScrollReserve } from '../src/client/instant-frame.js';
import { MODAL_VIEWPORT_LINES } from '../src/ui/modal-layout.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const widgetPath = join(__dirname, '..', 'shell', 'zsh', 'queque.zsh');

/**
 * Run a zsh script that sources the widget and calls shell functions.
 * Returns { stdout, stderr, status }.
 */
function runZsh(script: string): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('zsh', ['-f', '-c', `source ${widgetPath}\n${script}`], {
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, PATH: process.env.PATH },
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
  };
}

function runInteractiveZsh(script: string): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('zsh', ['-fi', '-c', script], {
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, PATH: process.env.PATH },
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
  };
}

/**
 * Run a zsh script with the widget sourced, but with ZELLIJ removed from the
 * environment. Used to test the Zellij detection guard (D-01) which must exit
 * with a message when ZELLIJ is unset.
 */
function _runZshWithoutZellij(script: string): { stdout: string; stderr: string; status: number } {
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: process.env.PATH };
  delete env.ZELLIJ;
  const result = spawnSync('zsh', ['-f', '-c', `source ${widgetPath}\n${script}`], {
    encoding: 'utf8',
    timeout: 5000,
    env,
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
  };
}

// ---------------------------------------------------------------------------
// Task 1: `?` widget and request capture path
// ---------------------------------------------------------------------------

describe('? widget: single ? inserts without delay', () => {
  it('widget file exists and registers with zle -N', () => {
    const result = spawnSync('grep', ['-q', 'zle -N', widgetPath], { encoding: 'utf8' });
    expect(result.status).toBe(0);
  });

  it('widget launches floating pane via zellij run per D-06', () => {
    const result = spawnSync('grep', ['-q', 'zellij run', widgetPath], { encoding: 'utf8' });
    expect(result.status).toBe(0);
  });

  it('widget invokes qq client --request-file and --result-file', () => {
    // The widget resolves qq to a full path stored in $qq_bin, then invokes
    // "$qq_bin" client --request-file, so match on the argument rather than the binary name.
    const result = spawnSync('grep', ['-q', 'client --request-file', widgetPath], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
  });

  it('leaves logging disabled unless QQ_DEBUG_LOG_FILE is set', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-log-test-'));
    const logFile = join(dir, 'debug.log');
    const script = `
      QQ_DEBUG_LOG_FILE=""
      _qq_log "hello"
      [[ -e "${logFile}" ]] && echo "log-created" || :
    `;
    const { stdout, status } = runZsh(script);
    rmSync(dir, { recursive: true, force: true });
    expect(status).toBe(0);
    expect(stdout).not.toContain('log-created');
  });
});

describe('?? trigger: captures pre-trigger buffers', () => {
  it('removes the trailing ? from lbuffer when the trigger fires', () => {
    // The widget sees the previously inserted `?` in LBUFFER on the second keypress.
    // _qq_capture_buffers should remove that trailing `?` so cancel restores the
    // buffer before the trigger sequence began.
    const script = `
      LBUFFER="git status?"
      RBUFFER=""
      _qq_capture_buffers
      echo "lbuffer=$QQ_LBUFFER"
      echo "orig_lbuffer=$QQ_ORIG_LBUFFER"
      echo "rbuffer=$QQ_RBUFFER"
    `;
    const { stdout, status } = runZsh(script);
    const lines = stdout.trim().split('\n').filter(Boolean);
    expect(status).toBe(0);
    expect(lines).toContain('lbuffer=git status');
    expect(lines).toContain('orig_lbuffer=git status');
    expect(lines).toContain('rbuffer=');
    expect(lines).not.toContain('lbuffer=git status?');
  });

  it('preserves rbuffer content across trigger capture', () => {
    const script = `
      LBUFFER="find ?"
      RBUFFER=" -type f"
      _qq_capture_buffers
      echo "rbuffer=$QQ_RBUFFER"
    `;
    const { stdout, status } = runZsh(script);
    expect(status).toBe(0);
    expect(stdout).toContain('rbuffer= -type f');
  });

  it('saves original lbuffer before any mutation', () => {
    const script = `
      LBUFFER="original text?"
      RBUFFER="right side"
      _qq_capture_buffers
      echo "orig_lbuffer=$QQ_ORIG_LBUFFER"
      echo "orig_rbuffer=$QQ_ORIG_RBUFFER"
    `;
    const { stdout, status } = runZsh(script);
    const lines = stdout.trim().split('\n').filter(Boolean);
    expect(status).toBe(0);
    expect(lines).toContain('orig_lbuffer=original text');
    expect(lines).toContain('orig_rbuffer=right side');
  });
});

describe('?? trigger: cancel restores pre-trigger buffer', () => {
  it('restores the buffer without leaving a trailing ? behind', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-test-'));
    const resultFile = join(dir, 'result.json');
    writeFileSync(resultFile, JSON.stringify({ kind: 'cancel' }));
    const script = `
      LBUFFER="git stat?"
      RBUFFER=""
      _qq_capture_buffers
      _qq_apply_result "${resultFile}"
      echo "lbuffer=$LBUFFER"
      echo "rbuffer=$RBUFFER"
    `;
    const { stdout, status } = runZsh(script);
    const lines = stdout.trim().split('\n').filter(Boolean);
    rmSync(dir, { recursive: true, force: true });
    expect(status).toBe(0);
    expect(lines).toContain('lbuffer=git stat');
    expect(lines).toContain('rbuffer=');
    expect(lines).not.toContain('lbuffer=git stat?');
  });
});

describe('daemon prewarm', () => {
  it('starts a background ensure call once in interactive shells', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-prewarm-'));
    const devRoot = join(dir, 'repo');
    const cliDir = join(devRoot, 'dist', 'cli');
    const binDir = join(dir, 'bin');
    const marker = join(dir, 'node-invoked');
    mkdirSync(cliDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(cliDir, 'main.js'), '');
    writeFileSync(
      join(binDir, 'node'),
      `#!/bin/sh
printf '%s\n' "$*" > "${marker}"
`,
      { encoding: 'utf8' },
    );
    chmodSync(join(binDir, 'node'), 0o755);

    const script = `
      QQ_DEV_ROOT="${devRoot}"
      PATH="${binDir}:$PATH"
      source ${widgetPath}
      for i in {1..50}; do
        [[ -f "${marker}" ]] && break
        sleep 0.05
      done
      [[ -f "${marker}" ]] && cat "${marker}"
    `;
    const { stdout, status } = runInteractiveZsh(script);
    rmSync(dir, { recursive: true, force: true });
    expect(status).toBe(0);
    expect(stdout).toContain('daemon --ensure');
  });

  it('prewarms via qq on PATH when QQ_DEV_ROOT is unset', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-prewarm-qq-'));
    const binDir = join(dir, 'bin');
    const marker = join(dir, 'qq-invoked');
    mkdirSync(binDir, { recursive: true });
    writeFileSync(
      join(binDir, 'qq'),
      `#!/bin/sh
printf '%s\n' "$*" > "${marker}"
`,
      { encoding: 'utf8' },
    );
    chmodSync(join(binDir, 'qq'), 0o755);

    const script = `
      unset QQ_DEV_ROOT
      PATH="${binDir}:$PATH"
      source ${widgetPath}
      for i in {1..50}; do
        [[ -f "${marker}" ]] && break
        sleep 0.05
      done
      [[ -f "${marker}" ]] && cat "${marker}"
    `;
    const { stdout, status } = runInteractiveZsh(script);
    rmSync(dir, { recursive: true, force: true });
    expect(status).toBe(0);
    expect(stdout).toContain('daemon --ensure');
  });
});

// ---------------------------------------------------------------------------
// Task 2: Result application — cancel, replace-buffer, and malformed JSON
// ---------------------------------------------------------------------------

describe('result application: cancel restores buffers', () => {
  it('cancel restores QQ_ORIG_LBUFFER and QQ_ORIG_RBUFFER to LBUFFER/RBUFFER', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-test-'));
    const resultFile = join(dir, 'result.json');
    writeFileSync(resultFile, JSON.stringify({ kind: 'cancel' }));
    const script = `
      LBUFFER="mutated"
      RBUFFER="mutated right"
      QQ_ORIG_LBUFFER="original left"
      QQ_ORIG_RBUFFER="original right"
      _qq_apply_result "${resultFile}"
      echo "lbuffer=$LBUFFER"
      echo "rbuffer=$RBUFFER"
    `;
    const { stdout, status } = runZsh(script);
    rmSync(dir, { recursive: true, force: true });
    expect(status).toBe(0);
    expect(stdout).toContain('lbuffer=original left');
    expect(stdout).toContain('rbuffer=original right');
  });
});

describe('result application: replace-buffer writes new buffers', () => {
  it('sets LBUFFER to selected command, prints summary lines, adds query to history', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-test-'));
    const resultFile = join(dir, 'result.json');
    writeFileSync(
      resultFile,
      JSON.stringify({
        kind: 'replace-buffer',
        lbuffer: 'git status',
        rbuffer: '  # show repo status',
      }),
    );
    const script = `
      LBUFFER="old left"
      RBUFFER="old right"
      QQ_ORIG_LBUFFER="list changed files"
      QQ_ORIG_RBUFFER="orig right"
      _qq_apply_result "${resultFile}"
      echo "lbuffer=$LBUFFER"
      echo "rbuffer=$RBUFFER"
    `;
    const { stdout, status } = runZsh(script);
    rmSync(dir, { recursive: true, force: true });
    expect(status).toBe(0);
    // LBUFFER is the selected command so it appears in the new PS1 ready to run
    expect(stdout).toContain('lbuffer=git status');
    // RBUFFER holds the explanation; cursor sits between command and comment
    expect(stdout).toContain('rbuffer=  # show repo status');
    // Summary line 1: queque label with original query
    expect(stdout).toContain('queque › list changed files');
    // Summary line 2: selected command + explanation
    expect(stdout).toContain('git status  # show repo status');
  });
});

describe('result application: error kind restores buffers and returns 0', () => {
  it('_qq_apply_result exits 0 and leaves buffers unchanged on error kind', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-test-'));
    const resultFile = join(dir, 'result.json');
    writeFileSync(
      resultFile,
      JSON.stringify({ kind: 'error', message: 'QueQue: API timeout — press any key' }),
    );
    const script = `
      LBUFFER="mutated"
      RBUFFER="mutated right"
      QQ_ORIG_LBUFFER="original left"
      QQ_ORIG_RBUFFER="original right"
      _qq_apply_result "${resultFile}"
      echo "exit=$?"
      echo "lbuffer=$LBUFFER"
      echo "rbuffer=$RBUFFER"
    `;
    const { stdout, status } = runZsh(script);
    rmSync(dir, { recursive: true, force: true });
    expect(status).toBe(0);
    expect(stdout).toContain('exit=0');
    expect(stdout).toContain('lbuffer=original left');
    expect(stdout).toContain('rbuffer=original right');
  });
});

describe('result application: malformed JSON leaves buffers intact', () => {
  it('malformed JSON returns nonzero and leaves LBUFFER/RBUFFER unchanged', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-test-'));
    const resultFile = join(dir, 'result.json');
    writeFileSync(resultFile, 'not valid json {{{');
    const script = `
      LBUFFER="safe left"
      RBUFFER="safe right"
      QQ_ORIG_LBUFFER="safe left"
      QQ_ORIG_RBUFFER="safe right"
      _qq_apply_result "${resultFile}"
      result_status=$?
      echo "lbuffer=$LBUFFER"
      echo "rbuffer=$RBUFFER"
      exit $result_status
    `;
    const { stdout, status } = runZsh(script);
    rmSync(dir, { recursive: true, force: true });
    expect(status).not.toBe(0);
    expect(stdout).toContain('lbuffer=safe left');
    expect(stdout).toContain('rbuffer=safe right');
  });

  it('unknown kind leaves buffers intact and returns nonzero', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-test-'));
    const resultFile = join(dir, 'result.json');
    writeFileSync(resultFile, JSON.stringify({ kind: 'unknown-future-kind' }));
    const script = `
      LBUFFER="left"
      RBUFFER="right"
      QQ_ORIG_LBUFFER="left"
      QQ_ORIG_RBUFFER="right"
      _qq_apply_result "${resultFile}"
      result_status=$?
      echo "lbuffer=$LBUFFER"
      echo "rbuffer=$RBUFFER"
      exit $result_status
    `;
    const { stdout, status } = runZsh(script);
    rmSync(dir, { recursive: true, force: true });
    expect(status).not.toBe(0);
    expect(stdout).toContain('lbuffer=left');
    expect(stdout).toContain('rbuffer=right');
  });
});

// ---------------------------------------------------------------------------
// Prompt context: replace-buffer with query + explanation
// RED until the widget and result contract implement the context line feature.
// ---------------------------------------------------------------------------

describe('result application: replace-buffer with query context line', () => {
  it('prints a dimmed queque context line to stdout when query field is present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-test-'));
    const resultFile = join(dir, 'result.json');
    writeFileSync(
      resultFile,
      JSON.stringify({
        kind: 'replace-buffer',
        lbuffer: 'git status  # show working tree status',
        rbuffer: '',
        query: 'git stat',
      }),
    );
    const script = `
      LBUFFER="old"
      RBUFFER=""
      QQ_ORIG_LBUFFER="old"
      QQ_ORIG_RBUFFER=""
      _qq_apply_result "${resultFile}"
      echo "lbuffer=$LBUFFER"
    `;
    const { stdout, status } = runZsh(script);
    rmSync(dir, { recursive: true, force: true });
    expect(status).toBe(0);
    expect(stdout).toMatch(/queque/i);
    expect(stdout).toContain('git stat');
  });

  it('sets LBUFFER to selected command (original query goes to history, not LBUFFER)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-test-'));
    const resultFile = join(dir, 'result.json');
    writeFileSync(
      resultFile,
      JSON.stringify({
        kind: 'replace-buffer',
        lbuffer: 'git status  # show working tree status',
        rbuffer: '',
        query: 'git stat',
      }),
    );
    const script = `
      LBUFFER="old"
      RBUFFER=""
      QQ_ORIG_LBUFFER="git stat"
      QQ_ORIG_RBUFFER=""
      _qq_apply_result "${resultFile}"
      echo "lbuffer=$LBUFFER"
      echo "rbuffer=$RBUFFER"
    `;
    const { stdout, status } = runZsh(script);
    rmSync(dir, { recursive: true, force: true });
    expect(status).toBe(0);
    // LBUFFER is the selected command so it appears in the new PS1 ready to run
    expect(stdout).toContain('lbuffer=git status  # show working tree status');
    // RBUFFER is empty (explanation was folded into lbuffer by the provider here)
    expect(stdout).toContain('rbuffer=');
    // The selected command is also shown as a summary line above PS1
    expect(stdout).toContain('git status  # show working tree status');
  });

  it('selected command appears in the new PS1 (LBUFFER) and also as a summary line above it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-test-'));
    const resultFile = join(dir, 'result.json');
    writeFileSync(
      resultFile,
      JSON.stringify({
        kind: 'replace-buffer',
        lbuffer: 'echo hello',
        rbuffer: '  # prints hello to stdout',
      }),
    );
    const script = `
      LBUFFER="old"
      RBUFFER=""
      QQ_ORIG_LBUFFER="print hello"
      QQ_ORIG_RBUFFER=""
      _qq_apply_result "${resultFile}"
      echo "lbuffer=$LBUFFER"
      echo "rbuffer=$RBUFFER"
    `;
    const { stdout, status } = runZsh(script);
    rmSync(dir, { recursive: true, force: true });
    expect(status).toBe(0);
    // The command + explanation appear as a summary line above the new PS1
    expect(stdout).toContain('echo hello  # prints hello to stdout');
    // LBUFFER is the command — the user can execute it with Enter or edit it
    expect(stdout).toContain('lbuffer=echo hello');
    // RBUFFER is the explanation, cursor sits between command and comment
    expect(stdout).toContain('rbuffer=  # prints hello to stdout');
  });

  it('queque label is omitted when original query is empty', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-test-'));
    const resultFile = join(dir, 'result.json');
    writeFileSync(
      resultFile,
      JSON.stringify({ kind: 'replace-buffer', lbuffer: 'git status', rbuffer: '' }),
    );
    const script = `
      LBUFFER=""
      RBUFFER=""
      QQ_ORIG_LBUFFER=""
      QQ_ORIG_RBUFFER=""
      _qq_apply_result "${resultFile}"
      echo "lbuffer=$LBUFFER"
    `;
    const { stdout, status } = runZsh(script);
    rmSync(dir, { recursive: true, force: true });
    expect(status).toBe(0);
    // No queque label when there was no original query
    expect(stdout).not.toMatch(/queque/i);
  });
});

// ---------------------------------------------------------------------------
// Phase 3.2 Wave 1 tests: Zellij detection and static content assertions
// These tests go RED until Plan 03 rewrites the widget (intentional TDD RED).
// ---------------------------------------------------------------------------

describe('Zellij detection: inline path used when ZELLIJ is unset', () => {
  it('widget source no longer contains a hard-exit Zellij error message', () => {
    // The old guard hard-exited with "QueQue requires Zellij".
    // Now the widget uses the inline foreground path when ZELLIJ is absent.
    const result = spawnSync('grep', ['-q', 'QueQue requires Zellij', widgetPath], {
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
  });

  it('widget source contains inline fallback (_qq_apply_result call outside Zellij branch)', () => {
    const result = spawnSync('grep', ['-c', '_qq_apply_result', widgetPath], { encoding: 'utf8' });
    // At least 2 occurrences: function definition + inline call
    expect(parseInt(result.stdout.trim(), 10)).toBeGreaterThanOrEqual(2);
  });
});

describe('Zellij widget static content', () => {
  it('widget sources without error and registers qq-question-widget', () => {
    // Verify zle -N is present (widget is properly registered).
    const result = spawnSync('grep', ['-q', 'zle -N', widgetPath], { encoding: 'utf8' });
    expect(result.status).toBe(0);
  });

  it('widget contains mkfifo for FIFO creation per D-03', () => {
    // RED until Plan 03 rewrites the widget to use a FIFO.
    const result = spawnSync('grep', ['-q', 'mkfifo', widgetPath], { encoding: 'utf8' });
    expect(result.status).toBe(0);
  });

  it('widget launches with zellij run per D-06', () => {
    // RED until Plan 03 rewrites the widget to use zellij run.
    const result = spawnSync('grep', ['-q', 'zellij run', widgetPath], { encoding: 'utf8' });
    expect(result.status).toBe(0);
  });

  it('error handler uses plain print (no >/dev/tty) so ZLE positions the message above the next prompt', () => {
    // >/dev/tty bypasses ZLE's output tracking — zle reset-prompt then draws
    // from its saved start position right over the raw write, causing a flash.
    // Plain print goes through ZLE's I/O so reset-prompt draws below it.
    const ttyCount = spawnSync('grep', ['-c', '>/dev/tty', widgetPath], { encoding: 'utf8' });
    expect(parseInt(ttyCount.stdout.trim(), 10)).toBe(0);
    const printLine = spawnSync('grep', ['print -r.*err_message', widgetPath], {
      encoding: 'utf8',
    });
    expect(printLine.stdout).toContain('print -r -- "$err_message"');
  });
});

// ---------------------------------------------------------------------------
// _qq_apply_result_str: shared implementation called by BOTH the inline
// (non-Zellij) path and the Zellij FIFO path.  Testing this function once
// covers requirement 1–3 for both execution paths.
// ---------------------------------------------------------------------------

describe('_qq_apply_result_str: LBUFFER is set to selected command (new PS1 content)', () => {
  it('sets LBUFFER to the selected command — not the original query', () => {
    // After selection the user should see the command in their shell prompt so
    // they can inspect, edit, or execute it with Enter.
    const script = `
      QQ_ORIG_LBUFFER="list changed files"
      QQ_ORIG_RBUFFER=""
      LBUFFER="old"
      RBUFFER="old right"
      _qq_apply_result_str '{"kind":"replace-buffer","lbuffer":"git status","rbuffer":"  # show working tree status"}'
      echo "lbuffer=$LBUFFER"
      echo "rbuffer=$RBUFFER"
    `;
    const { stdout, status } = runZsh(script);
    expect(status).toBe(0);
    // LBUFFER = selected command (cursor sits after the command, before the comment)
    expect(stdout).toContain('lbuffer=git status');
    // RBUFFER = explanation so the comment appears to the right of the cursor
    expect(stdout).toContain('rbuffer=  # show working tree status');
    // Original query must NOT end up in LBUFFER
    expect(stdout).not.toContain('lbuffer=list changed files');
  });

  it('sets RBUFFER to the explanation so the cursor lands between command and comment', () => {
    const script = `
      QQ_ORIG_LBUFFER="find large files"
      QQ_ORIG_RBUFFER="orig right"
      LBUFFER="old"
      RBUFFER="old right"
      _qq_apply_result_str '{"kind":"replace-buffer","lbuffer":"find . -size +100M","rbuffer":"  # files larger than 100 MB"}'
      echo "lbuffer=$LBUFFER"
      echo "rbuffer=$RBUFFER"
    `;
    const { stdout, status } = runZsh(script);
    expect(status).toBe(0);
    expect(stdout).toContain('lbuffer=find . -size +100M');
    expect(stdout).toContain('rbuffer=  # files larger than 100 MB');
    expect(stdout).not.toContain('rbuffer=orig right');
  });
});

describe('_qq_apply_result_str: original query added to zsh history after selection', () => {
  it('adds QQ_ORIG_LBUFFER to shell history so the user can recall and refine it', () => {
    const script = `
      typeset HISTSIZE=100
      QQ_ORIG_LBUFFER="list changed files"
      QQ_ORIG_RBUFFER=""
      LBUFFER="old"
      RBUFFER=""
      _qq_apply_result_str '{"kind":"replace-buffer","lbuffer":"git status","rbuffer":"  # show working tree status"}' >/dev/null
      fc -l 1
    `;
    const { stdout, status } = runZsh(script);
    expect(status).toBe(0);
    expect(stdout).toContain('list changed files');
  });

  it('does not add anything to history when QQ_ORIG_LBUFFER is empty', () => {
    const script = `
      typeset HISTSIZE=100
      QQ_ORIG_LBUFFER=""
      QQ_ORIG_RBUFFER=""
      LBUFFER=""
      RBUFFER=""
      _qq_apply_result_str '{"kind":"replace-buffer","lbuffer":"git status","rbuffer":""}' >/dev/null
      fc -l 1 2>/dev/null | wc -l | tr -d ' '
    `;
    const { stdout, status } = runZsh(script);
    expect(status).toBe(0);
    // No history entries should be present
    expect(stdout.trim()).toBe('0');
  });
});

describe('_qq_apply_result_str: summary lines printed above the new PS1', () => {
  it('first summary line shows "queque ›" prefix followed by the original query', () => {
    const script = `
      QQ_ORIG_LBUFFER="list changed files"
      QQ_ORIG_RBUFFER=""
      LBUFFER="old"
      RBUFFER=""
      _qq_apply_result_str '{"kind":"replace-buffer","lbuffer":"git status","rbuffer":"  # show working tree status"}'
    `;
    const { stdout, status } = runZsh(script);
    expect(status).toBe(0);
    expect(stdout).toContain('queque');
    expect(stdout).toContain('list changed files');
  });

  it('second summary line shows the selected command and explanation verbatim', () => {
    const script = `
      QQ_ORIG_LBUFFER="show working tree"
      QQ_ORIG_RBUFFER=""
      LBUFFER="old"
      RBUFFER=""
      _qq_apply_result_str '{"kind":"replace-buffer","lbuffer":"git status","rbuffer":"  # show working tree status"}'
    `;
    const { stdout, status } = runZsh(script);
    expect(status).toBe(0);
    expect(stdout).toContain('git status  # show working tree status');
  });

  it('omits the queque label line when QQ_ORIG_LBUFFER is empty', () => {
    const script = `
      QQ_ORIG_LBUFFER=""
      QQ_ORIG_RBUFFER=""
      LBUFFER=""
      RBUFFER=""
      _qq_apply_result_str '{"kind":"replace-buffer","lbuffer":"git status","rbuffer":""}'
    `;
    const { stdout, status } = runZsh(script);
    expect(status).toBe(0);
    expect(stdout).not.toMatch(/queque/i);
  });
});

describe('coverage: both paths call _qq_apply_result_str', () => {
  it('_qq_apply_result (inline path) delegates to _qq_apply_result_str', () => {
    // The delegate call is: _qq_apply_result_str "$json_str"
    const result = spawnSync('grep', ['-q', '_qq_apply_result_str "\\$json_str"', widgetPath], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
  });

  it('Zellij branch in qq-question-widget calls _qq_apply_result_str with the FIFO result', () => {
    // At least 3 occurrences: function definition, _qq_apply_result call site, Zellij call site
    const result = spawnSync('grep', ['-c', '_qq_apply_result_str', widgetPath], {
      encoding: 'utf8',
    });
    expect(parseInt(result.stdout.trim(), 10)).toBeGreaterThanOrEqual(3);
  });
});

describe('CMD-04: insertion-only shell contract', () => {
  it('widget does not eval or zle-push selected commands', () => {
    const evalHits = spawnSync('grep', ['-E', '\\beval\\b|zle -s', widgetPath], {
      encoding: 'utf8',
    });
    expect(evalHits.status).not.toBe(0);
  });

  it('widget does not auto-execute selected commands via zle accept-line', () => {
    const acceptLineHits = spawnSync('grep', ['-E', 'zle accept-line|\\beval\\b', widgetPath], {
      encoding: 'utf8',
    });
    expect(acceptLineHits.status).not.toBe(0);
  });

  it('replace-buffer sets LBUFFER without executing the command', () => {
    const script = `
      source "${widgetPath}"
      QQ_ORIG_LBUFFER="list changed files"
      QQ_ORIG_RBUFFER=""
      LBUFFER="old"
      RBUFFER=""
      _qq_apply_result_str '{"kind":"replace-buffer","lbuffer":"git status","rbuffer":"  # show working tree status"}'
      echo "lbuffer=$LBUFFER"
      echo "rbuffer=$RBUFFER"
    `;
    const result = runZsh(script);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('lbuffer=git status');
    expect(result.stdout).toContain('rbuffer=  # show working tree status');
  });
});

// ---------------------------------------------------------------------------
// Phase 9: installed-tool handoff (_qq_write_tool_handoff). Every case runs the
// real helper under `zsh -f` against real directories — no stubbed binaries.
// ---------------------------------------------------------------------------

/** Error text that must never reach the ZLE line. */
const HANDOFF_ERROR_TEXT = /permission denied|is a directory|no such file/i;

/** Body of `_qq_write_tool_handoff` from the widget source (up to its closing `}` line). */
function handoffHelperBody(): string {
  const source = readFileSync(widgetPath, 'utf8');
  const start = source.indexOf('_qq_write_tool_handoff() {');
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf('\n}\n', start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end + 2);
}

describe('tool handoff', () => {
  it('SC-1: lists a tool created after the hash table was primed, and builtins include cd', () => {
    const result = runZsh(`
      d=$(mktemp -d)
      mkdir -p "$d/bin"
      path=("$d/bin" $path)
      zmodload zsh/parameter
      : $(( \${#commands} ))
      print -r -- '#!/bin/sh' > "$d/bin/qqfreshtool"
      chmod +x "$d/bin/qqfreshtool"
      _qq_write_tool_handoff "$d"
      grep -qx qqfreshtool "$d/commands.txt" && print -r -- 'fresh=found' || print -r -- 'fresh=absent'
      grep -qx cd "$d/builtins.txt" && print -r -- 'cd=found' || print -r -- 'cd=absent'
      rm -rf "$d"
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('fresh=found');
    expect(result.stdout).toContain('cd=found');
  });

  it('D-01 amended: functions.txt lists function and alias names, not _-prefixed functions', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-handoff-fn-'));
    try {
      const result = runZsh(`
        qqfnsample() { :; }
        _qqprivatefn() { :; }
        alias qqalsample=ls
        _qq_write_tool_handoff '${dir}'
      `);
      expect(result.status).toBe(0);
      const names = readFileSync(join(dir, 'functions.txt'), 'utf8').split('\n');
      expect(names).toContain('qqfnsample');
      expect(names).toContain('qqalsample');
      expect(names).not.toContain('_qqprivatefn');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ERR-trap safety: a partial write returns 0, never trips ERR, and leaves no files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-handoff-partial-'));
    try {
      // A directory named functions.txt makes the third write fail even when run as root.
      mkdirSync(join(dir, 'functions.txt'));
      const result = runZsh(`
        trap 'print -r -- TRAPPED' ERR
        _qq_write_tool_handoff '${dir}'
        print -r -- "status=$?"
        [[ -e '${dir}/commands.txt' ]] && print -r -- 'commands=present' || print -r -- 'commands=absent'
        [[ -e '${dir}/builtins.txt' ]] && print -r -- 'builtins=present' || print -r -- 'builtins=absent'
      `);
      expect(result.stdout).toContain('status=0');
      expect(result.stdout).not.toContain('TRAPPED');
      expect(result.stdout).toContain('commands=absent');
      expect(result.stdout).toContain('builtins=absent');
      expect(result.stderr).not.toMatch(HANDOFF_ERROR_TEXT);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(process.getuid?.() === 0)(
    'ERR-trap safety: an unwritable session dir returns 0, never trips ERR, writes nothing',
    () => {
      const dir = mkdtempSync(join(tmpdir(), 'qq-handoff-ro-'));
      chmodSync(dir, 0o500);
      try {
        const result = runZsh(`
          trap 'print -r -- TRAPPED' ERR
          _qq_write_tool_handoff '${dir}'
          print -r -- "status=$?"
        `);
        expect(result.stdout).toContain('status=0');
        expect(result.stdout).not.toContain('TRAPPED');
        expect(result.stderr).not.toMatch(HANDOFF_ERROR_TEXT);
        expect(readdirSync(dir)).toEqual([]);
      } finally {
        chmodSync(dir, 0o700);
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it('ERR-trap safety: a missing session dir returns 0, never trips ERR, prints nothing', () => {
    const result = runZsh(`
      trap 'print -r -- TRAPPED' ERR
      _qq_write_tool_handoff /nonexistent/qq-handoff-probe
      print -r -- "status=$?"
    `);
    expect(result.stdout).toContain('status=0');
    expect(result.stdout).not.toContain('TRAPPED');
    expect(result.stderr).not.toMatch(HANDOFF_ERROR_TEXT);
    expect(existsSync('/nonexistent/qq-handoff-probe')).toBe(false);
  });

  it('kill switch: QQ_TOOL_AWARENESS=0 as a shell parameter writes no files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-handoff-off-'));
    try {
      const result = runZsh(`
        QQ_TOOL_AWARENESS=0
        _qq_write_tool_handoff '${dir}'
        print -r -- "status=$?"
      `);
      expect(result.stdout).toContain('status=0');
      expect(readdirSync(dir).filter((name) => name.endsWith('.txt'))).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('placement: the widget writes the handoff after request.json and before both launches', () => {
    const source = readFileSync(widgetPath, 'utf8');
    const handoff = source.indexOf('_qq_write_tool_handoff "$tmpdir"');
    const requestHeredoc = source.indexOf('cat > "$req_file" <<JSON');
    // Match the launch lines themselves, not the header comment that mentions zellij run.
    const zellijLaunch = source.search(/^\s+zellij run --floating/m);
    const inlineLaunch = source.indexOf(
      'client --request-file "$req_file" --result-file "$result_file"',
    );
    expect(requestHeredoc).toBeGreaterThan(0);
    expect(handoff).toBeGreaterThan(requestHeredoc);
    expect(zellijLaunch).toBeGreaterThan(handoff);
    expect(inlineLaunch).toBeGreaterThan(zellijLaunch);
    expect(inlineLaunch).toBeGreaterThan(handoff);
  });

  it('shape guard (D-01, D-19): guarded, unconditional rehash, three print -rl, no loop/sort/background', () => {
    const body = handoffHelperBody();
    expect(body).toMatch(/\brehash\b/);
    expect(body).toContain('QQ_TOOL_AWARENESS');
    expect(body.match(/print -rl --/g) ?? []).toHaveLength(3);
    expect(body).not.toMatch(/\b(for|while)\b/);
    // No ordering or key-value flag inside any expansion flag group.
    expect(body).not.toMatch(/\$\{\([^)]*[oOv][^)]*\)/);
    expect(body).not.toContain('zstat');
    // No lone background `&` at a line end (the `&&` chain is allowed).
    expect(body).not.toMatch(/(^|[^&])&[ \t]*$/m);
    expect(body).not.toContain('&!');
    expect(body).not.toContain('&|');
  });
});

describe('handoff timing', () => {
  it('median of 5 handoffs under zsh -f stays below the 25 ms guard (D-19)', () => {
    // Inherited PATH: a realistic ~2k-command table. `zsh -f` has almost no functions or
    // aliases, so this understates the real interactive shell; 09-05's human check records
    // the real-shell number. This is a regression guard, not the SC-2 evidence itself.
    const medianOfFive = (): number => {
      const result = runZsh(`
        zmodload zsh/datetime
        d=$(mktemp -d)
        typeset -F start
        repeat 5; do
          start=$EPOCHREALTIME
          _qq_write_tool_handoff "$d"
          print -r -- "ms=$(( (EPOCHREALTIME - start) * 1000 ))"
        done
        rm -rf "$d"
      `);
      expect(result.status).toBe(0);
      const samples = result.stdout
        .split('\n')
        .filter((line) => line.startsWith('ms='))
        .map((line) => Number.parseFloat(line.slice(3)))
        .sort((a, b) => a - b);
      expect(samples).toHaveLength(5);
      return samples[2];
    };
    // WR-03: parallel vitest workers (spawn-heavy fuzz children) can stall one batch. Up to
    // 3 batches; the best median must meet the guard. A real regression fails every batch.
    const medians: number[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      medians.push(medianOfFive());
      if (Math.min(...medians) < 25) break;
    }
    console.log(`handoff median ms per batch: ${medians.map((m) => m.toFixed(2)).join(', ')}`);
    expect(Math.min(...medians)).toBeLessThan(25);
  });
});

// ---------------------------------------------------------------------------
// Instant frame (quick 261011-jbh, LD-1): the widget paints the queque header and a
// loading row before Node starts — inline into the modal area, or into a session-dir
// file the Zellij pane wrapper cats before it execs the client.
// ---------------------------------------------------------------------------

/** Every SGR sequence (the frame dims its header and loading rows). */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching terminal SGR sequences is the point
const SGR_SEQUENCE = /\u001B\[\d+m/g;

const INSTANT_FRAME_LBUFFER = 'show me how to use z3';

/**
 * Runs a script with the widget sourced and `args` as positional parameters, so user text
 * reaches zsh as `$1`, `$2`, ... and is never interpolated into the script.
 */
function runZshArgs(
  script: string,
  args: readonly string[],
): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('zsh', ['-f', '-c', `source "$0"\n${script}`, widgetPath, ...args], {
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, PATH: process.env.PATH },
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
  };
}

/** `_qq_instant_frame "$lbuffer" "$columns"`'s REPLY. */
function instantFrame(lbuffer: string, columns: string): string {
  return runZshArgs('_qq_instant_frame "$1" "$2"; print -rn -- "$REPLY"', [lbuffer, columns])
    .stdout;
}

/** The frame's rows: split on CR LF with every SGR sequence removed. */
function frameRows(reply: string): string[] {
  return reply.replace(SGR_SEQUENCE, '').split('\r\n');
}

/** The qq-question-widget function body (up to its closing redraw; the heredoc has a `}`). */
function questionWidgetBody(): string {
  const source = readFileSync(widgetPath, 'utf8');
  const start = source.indexOf('qq-question-widget() {');
  const end = source.indexOf('\n  zle -R\n  return 0\n}\n', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('instant frame', () => {
  it('z1: the frame is the header, two blank rows, then the loading row', () => {
    const rows = frameRows(instantFrame(INSTANT_FRAME_LBUFFER, '78'));
    expect(rows.length).toBe(4);
    expect(rows).toEqual([` queque › ${INSTANT_FRAME_LBUFFER}`, '', '', ' thinking…']);
  });

  it('z2: an empty lbuffer draws no header row, as in CandidateSelect', () => {
    expect(frameRows(instantFrame('', '78'))).toEqual(['', '', ' thinking…']);
  });

  it('z3: control characters in the lbuffer are stripped before they reach the terminal', () => {
    const reply = instantFrame('\u001B[31mred\nline\tTAB', '78');
    expect(frameRows(reply)).toEqual([' queque › [31mredlineTAB', '', '', ' thinking…']);
    // Only the frame's own four SGR sequences (dim on/off for the header and loading rows).
    expect(reply.split('\u001B').length - 1).toBe(4);
    expect(reply.match(SGR_SEQUENCE)).toHaveLength(4);
  });

  it('z4: a long lbuffer is truncated to the modal content width with a trailing …', () => {
    const long = 'a'.repeat(200);
    const header = (columns: string): string => frameRows(instantFrame(long, columns))[0] ?? '';
    expect([...header('78')]).toHaveLength(1 + 76);
    expect(header('78').endsWith('…')).toBe(true);
    expect([...header('40')]).toHaveLength(1 + 38);
    expect(header('40').endsWith('…')).toBe(true);
    // Non-numeric or zero columns fall back to 80 (content width 78).
    expect([...header('wide')]).toHaveLength(1 + 78);
    expect([...header('0')]).toHaveLength(1 + 78);
  });

  it('z5: the inline bytes start with the client reserve, byte for byte (drift guard)', () => {
    const frame = instantFrame(INSTANT_FRAME_LBUFFER, '78');
    const result = runZshArgs('_qq_inline_instant_frame_bytes "$1" "$2"; print -rn -- "$REPLY"', [
      INSTANT_FRAME_LBUFFER,
      '78',
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      `${inlineScrollReserve(MODAL_VIEWPORT_LINES)}\u001B[J${frame}\u001B8`,
    );
  });

  it('z6: QQ_INSTANT_FRAME=0 paints nothing, writes no pane file and returns 0 everywhere', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-instant-off-'));
    try {
      const result = runZshArgs(
        `
        QQ_INSTANT_FRAME=0
        trap 'print -r -- TRAPPED' ERR
        _qq_instant_frame "$1" 78; s1=$?; f=$REPLY
        _qq_inline_instant_frame_bytes "$1" 78; s2=$?; b=$REPLY
        _qq_paint_inline_instant_frame "$1"; s3=$?
        _qq_write_pane_instant_frame "$2" "$1" 78; s4=$?
        print -r -- "frame=[$f] bytes=[$b] status=$s1$s2$s3$s4 painted=$QQ_INSTANT_FRAME_PAINTED"
        `,
        [INSTANT_FRAME_LBUFFER, dir],
      );
      expect(result.stdout).toBe('frame=[] bytes=[] status=0000 painted=0\n');
      expect(result.stderr).toBe('');
      expect(readdirSync(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('z7: the painter writes nothing when stdout is not a terminal, and never trips ERR', () => {
    const piped = runZshArgs(
      `
      trap 'print -r -- TRAPPED' ERR
      _qq_paint_inline_instant_frame "$1"
      print -r -- "status=$? painted=$QQ_INSTANT_FRAME_PAINTED"
      `,
      [INSTANT_FRAME_LBUFFER],
    );
    expect(piped.stdout).toBe('status=0 painted=0\n');
    expect(piped.stderr).toBe('');

    const closed = runZshArgs(
      `
      trap 'print -r -- TRAPPED' ERR
      _qq_paint_inline_instant_frame "$1" >&-
      print -r -- "status=$?"
      `,
      [INSTANT_FRAME_LBUFFER],
    );
    expect(closed.stdout).toBe('status=0\n');
    expect(closed.stderr).toBe('');
  });

  it('z8: the pane frame file is the frame plus a cursor home; a missing dir is silent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-instant-pane-'));
    try {
      const frame = instantFrame(INSTANT_FRAME_LBUFFER, '78');
      const written = runZshArgs(
        `
        trap 'print -r -- TRAPPED' ERR
        _qq_write_pane_instant_frame "$1" "$2" 78
        print -r -- "status=$?"
        `,
        [dir, INSTANT_FRAME_LBUFFER],
      );
      expect(written.stdout).toBe('status=0\n');
      expect(readFileSync(join(dir, 'instant-frame.txt'), 'utf8')).toBe(`${frame}\u001B[H`);

      const missing = runZshArgs(
        `
        trap 'print -r -- TRAPPED' ERR
        _qq_write_pane_instant_frame /nonexistent/qq-instant-probe "$1" 78
        print -r -- "status=$?"
        `,
        [INSTANT_FRAME_LBUFFER],
      );
      expect(missing.stdout).toBe('status=0\n');
      expect(missing.stderr).toBe('');
      expect(existsSync('/nonexistent/qq-instant-probe')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('z9: the pane wrapper cats the frame file, then execs the client argv unchanged', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-instant-sh-'));
    try {
      const script = runZshArgs('print -rn -- "$QQ_PANE_PAINT_SCRIPT"', []).stdout;
      expect(script).not.toBe('');
      const file = join(dir, 'instant-frame.txt');
      writeFileSync(file, 'FRAME\u001B[H');
      const wrapped = spawnSync('/bin/sh', ['-c', script, 'x', file, 'printf', '%s', 'EXEC-OK'], {
        encoding: 'utf8',
        timeout: 5000,
      });
      expect(wrapped.stdout).toBe('FRAME\u001B[HEXEC-OK');
      expect(wrapped.status).toBe(0);

      const absent = spawnSync(
        '/bin/sh',
        ['-c', script, 'x', join(dir, 'missing.txt'), 'printf', '%s', 'EXEC-OK'],
        { encoding: 'utf8', timeout: 5000 },
      );
      expect(absent.stdout).toBe('EXEC-OK');
      expect(absent.stderr).toBe('');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('z10: placement — lookup, then the inline paint, then mktemp; pane frame before the pane', () => {
    const body = questionWidgetBody();
    const lookup = body.indexOf('whence -p qq');
    const notFound = body.indexOf('zle -M "queque: qq not found');
    const paint = body.indexOf('_qq_paint_inline_instant_frame "$QQ_LBUFFER"');
    const mktemp = body.indexOf('mktemp -d');
    const mkfifo = body.indexOf('mkfifo "$fifo_path"');
    const paneFrame = body.indexOf('_qq_write_pane_instant_frame "$tmpdir"');
    const zellijLaunch = body.search(/^\s+zellij run --floating/m);
    expect(lookup).toBeGreaterThan(0);
    expect(notFound).toBeGreaterThan(lookup);
    expect(paint).toBeGreaterThan(notFound);
    expect(mktemp).toBeGreaterThan(paint);
    expect(paneFrame).toBeGreaterThan(mkfifo);
    expect(zellijLaunch).toBeGreaterThan(paneFrame);

    // The pane gets the frame through a file path; the lbuffer never reaches the argv.
    const launchLine = body.slice(zellijLaunch, body.indexOf('&!', zellijLaunch));
    expect(launchLine).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: zsh source text, not a JS template
      '"${pane_cmd[@]}" client --request-file "$req_file" --result-file "$fifo_path"',
    );
    expect(launchLine).not.toMatch(/LBUFFER/);

    // The inline launch keeps its exact string and captures the client status.
    expect(body).toMatch(
      /client --request-file "\$req_file" --result-file "\$result_file" \\\n\s+2>>[^\n]*\|\| qq_client_status=\$\?/,
    );
  });
});
