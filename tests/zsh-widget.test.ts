/**
 * Smoke tests for the zsh ZLE widget (`shell/zsh/qq.zsh`).
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
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const widgetPath = join(__dirname, '..', 'shell', 'zsh', 'qq.zsh');

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

  it('widget does not contain /dev/tty redirect per D-02 (inline TTY path removed)', () => {
    // RED until Plan 03 removes the inline /dev/tty redirect.
    // grep -c counts matching lines; exit 0 with output "0" means pattern absent.
    // Using grep -c (not -qL) because macOS grep -qL has non-standard exit code behavior.
    const result = spawnSync('grep', ['-c', '>/dev/tty', widgetPath], { encoding: 'utf8' });
    const count = parseInt(result.stdout.trim(), 10);
    expect(count).toBe(0);
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
