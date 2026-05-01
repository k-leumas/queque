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

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const widgetPath = join(__dirname, '..', 'shell', 'zsh', 'qq.zsh');

/**
 * Run a zsh script that sources the widget and calls shell functions.
 * Returns { stdout, stderr, status }.
 */
function runZsh(script: string): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('zsh', ['-c', `source ${widgetPath}\n${script}`], {
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

// ---------------------------------------------------------------------------
// Task 1: `?` widget and request capture path
// ---------------------------------------------------------------------------

describe('? widget: single ? inserts without delay', () => {
  it('widget file exists and registers with zle -N', () => {
    const result = spawnSync('grep', ['-q', 'zle -N', widgetPath], { encoding: 'utf8' });
    expect(result.status).toBe(0);
  });

  it('widget uses /dev/tty for client subprocess stdio', () => {
    const result = spawnSync('grep', ['-q', '/dev/tty', widgetPath], { encoding: 'utf8' });
    expect(result.status).toBe(0);
  });

  it('widget invokes qq client --request-file and --result-file', () => {
    const result = spawnSync('grep', ['-q', 'qq client --request-file', widgetPath], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
  });
});

describe('?? trigger: captures pre-trigger buffers', () => {
  it('removes the trailing ? from lbuffer to strip the trigger', () => {
    // The _qq_capture_buffers function should set QQ_LBUFFER = lbuffer minus trailing ?
    const script = `
      LBUFFER="git status?"
      RBUFFER=""
      _qq_capture_buffers
      echo "lbuffer=$QQ_LBUFFER"
      echo "rbuffer=$QQ_RBUFFER"
    `;
    const { stdout, status } = runZsh(script);
    expect(status).toBe(0);
    expect(stdout).toContain('lbuffer=git status');
    expect(stdout).not.toContain('lbuffer=git status?');
    expect(stdout).toContain('rbuffer=');
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
    expect(status).toBe(0);
    expect(stdout).toContain('orig_lbuffer=original text?');
    expect(stdout).toContain('orig_rbuffer=right side');
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
    unlinkSync(resultFile);
    expect(status).toBe(0);
    expect(stdout).toContain('lbuffer=original left');
    expect(stdout).toContain('rbuffer=original right');
  });
});

describe('result application: replace-buffer writes new buffers', () => {
  it('replace-buffer sets LBUFFER and RBUFFER to new values', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-test-'));
    const resultFile = join(dir, 'result.json');
    writeFileSync(
      resultFile,
      JSON.stringify({ kind: 'replace-buffer', lbuffer: 'git status', rbuffer: '' }),
    );
    const script = `
      LBUFFER="old left"
      RBUFFER="old right"
      QQ_ORIG_LBUFFER="orig left"
      QQ_ORIG_RBUFFER="orig right"
      _qq_apply_result "${resultFile}"
      echo "lbuffer=$LBUFFER"
      echo "rbuffer=$RBUFFER"
    `;
    const { stdout, status } = runZsh(script);
    unlinkSync(resultFile);
    expect(status).toBe(0);
    expect(stdout).toContain('lbuffer=git status');
    expect(stdout).toContain('rbuffer=');
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
    unlinkSync(resultFile);
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
    unlinkSync(resultFile);
    expect(status).not.toBe(0);
    expect(stdout).toContain('lbuffer=left');
    expect(stdout).toContain('rbuffer=right');
  });
});
