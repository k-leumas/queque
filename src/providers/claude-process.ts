import { type ChildProcess, type ChildProcessByStdio, spawn } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { abortError } from './provider.js';
import {
  buildStreamJsonUserLine,
  createLineParser,
  isInitEvent,
  streamJsonResultSchema,
  textDeltaOf,
} from './stream-json.js';

/**
 * One `claude -p` stream-json turn on a child process (Phase 09.1, D-04, D-13).
 *
 * The prompt goes to the child as one stream-json user line on stdin, then stdin is
 * closed (the prompt never appears in argv, so `ps` cannot show it). The turn settles on
 * the zod-validated `result` event, not on process exit. Aborts and the budget timer
 * SIGTERM the child, then SIGKILL it after SIGKILL_GRACE_MS.
 *
 * Bounds (D-04): stdout's unfinished line is capped at STREAM_JSON_CARRY_CAP_BYTES (an
 * overflow kills the child and fails as `invalid-result`), collected stderr at
 * STDERR_CAP_BYTES. After a `result` the child is left to exit on its own (an immediate
 * SIGTERM could cut off Claude Code's credential writes); one still running
 * POST_RESULT_BACKSTOP_MS later is terminated.
 *
 * Claude Code catches SIGTERM and exits with code 143 and a null signal (Probe 8), so
 * timeout and abort are decided by QueQue's own flags, never by the exit code or signal.
 *
 * argv stays an opaque list here: the claude flags live in claude-cli.ts.
 */

/** SIGTERM → SIGKILL grace: 2.6x the slowest measured SIGTERM exit (583 ms, Probe 8). */
export const SIGKILL_GRACE_MS = 1500;
/** Post-result backstop: ~4x the slowest measured result → exit (540 ms, Probe 4). */
export const POST_RESULT_BACKSTOP_MS = 2000;
/** Most stderr kept for the failure's `stderr` field, in UTF-8 bytes; the rest is dropped. */
export const STDERR_CAP_BYTES = 64 * 1024;

export type ClaudeTurnStage =
  | 'spawned'
  | 'init'
  | 'first-delta'
  | 'result'
  | 'exit'
  | 'aborted'
  | 'timed-out';

export interface ClaudeTurnStageDetail {
  pid?: number;
  code?: number | null;
  signal?: NodeJS.Signals | null;
}

export type ClaudeTurnFailureReason =
  | 'is-error'
  | 'exit-without-result'
  | 'timeout'
  | 'spawn-error'
  | 'invalid-result';

/** Same fields as the old claude-exec SpawnFailure, so claude-default maps it unchanged. */
export interface ClaudeTurnFailure extends Error {
  code?: string | number | null;
  killed?: boolean;
  signal?: NodeJS.Signals | string | null;
  stdout?: string;
  stderr?: string;
  reason: ClaudeTurnFailureReason;
  sawInit: boolean;
}

export interface ClaudeTurnOptions {
  command: string;
  argv: readonly string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  prompt: string;
  budgetMs: number;
  signal?: AbortSignal;
  onTextDelta?: (text: string) => void;
  onStage?: (stage: ClaudeTurnStage, detail?: ClaudeTurnStageDetail) => void;
  /** Delay after a `result` before a still-running child is terminated. */
  backstopMs?: number;
  /** SIGTERM → SIGKILL grace for every kill this turn makes. */
  killGraceMs?: number;
  /**
   * An idle prewarmed child (claude-prewarm.ts) to run the turn on instead of spawning
   * one; `command`, `argv` and `cwd` are then only what it was spawned with (D-11).
   */
  child?: ClaudeChild;
}

export type ClaudeChild = ChildProcessByStdio<Writable, Readable, Readable>;

type FailureFields = Omit<ClaudeTurnFailure, keyof Error | 'reason' | 'sawInit'>;

function turnFailure(
  message: string,
  reason: ClaudeTurnFailureReason,
  sawInit: boolean,
  fields: FailureFields,
): ClaudeTurnFailure {
  return Object.assign(new Error(message), { ...fields, reason, sawInit });
}

function timeoutFailure(stderr: string, sawInit: boolean): ClaudeTurnFailure {
  return turnFailure('Command timed out: claude', 'timeout', sawInit, {
    killed: true,
    signal: 'SIGTERM',
    code: null,
    stdout: '',
    stderr,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

/** Spawns a child with all three stdio pipes, no shell. */
export function spawnClaudeChild(
  command: string,
  argv: readonly string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
): ClaudeChild {
  return spawn(command, [...argv], {
    cwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
  });
}

/**
 * SIGTERM a still-running child, then SIGKILL it after `graceMs` if it has not exited.
 *
 * Only ChildProcess handles this process spawned are ever signalled; no pid lookup.
 */
export function terminateChild(child: ChildProcess, graceMs: number = SIGKILL_GRACE_MS): void {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  child.kill('SIGTERM');
  const killTimer = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }
  }, graceMs);
  killTimer.unref();
  child.once('exit', () => {
    clearTimeout(killTimer);
  });
}

/**
 * Runs one turn and resolves with the `result` text.
 *
 * Rejects with abortError() on abort, a `timeout` failure past `budgetMs` (at kill time,
 * not at exit), an `is-error` failure carrying the result text as `stdout` (the auth
 * message, so it never reaches parseCandidates), a `spawn-error` (ENOENT), an
 * `invalid-result` (also a stdout line past the carry cap), or `exit-without-result`.
 * The turn settles exactly once: nothing the child writes after it settles reaches
 * `onTextDelta` or `onStage`, except the final `exit` stage, and a later kill, `exit` or
 * `close` never re-settles it.
 */
export function runClaudeTurn(options: ClaudeTurnOptions): Promise<string> {
  const { command, argv, cwd, env, prompt, budgetMs, signal, onTextDelta, onStage } = options;
  const backstopMs = options.backstopMs ?? POST_RESULT_BACKSTOP_MS;
  const killGraceMs = options.killGraceMs ?? SIGKILL_GRACE_MS;

  if (signal?.aborted) {
    return Promise.reject(abortError());
  }
  if (budgetMs <= 0) {
    return Promise.reject(timeoutFailure('', false));
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let sawInit = false;
    let sawDelta = false;
    let stderr = '';
    let stderrBytes = 0;
    let budgetTimer: ReturnType<typeof setTimeout> | undefined;
    let backstopArmed = false;

    const child = spawnClaudeChild(command, argv, cwd, env);

    const onAbort = (): void => {
      if (settled) {
        return;
      }
      onStage?.('aborted');
      terminateChild(child, killGraceMs);
      finish(() => reject(abortError()));
    };

    // Keeps at most STDERR_CAP_BYTES of stderr (running count, whole characters only).
    const collectStderr = (chunk: string): void => {
      if (stderrBytes >= STDERR_CAP_BYTES) {
        return;
      }
      const bytes = Buffer.byteLength(chunk, 'utf8');
      if (stderrBytes + bytes <= STDERR_CAP_BYTES) {
        stderr += chunk;
        stderrBytes += bytes;
        return;
      }
      const room = STDERR_CAP_BYTES - stderrBytes;
      stderr += new StringDecoder('utf8').write(Buffer.from(chunk, 'utf8').subarray(0, room));
      stderrBytes = STDERR_CAP_BYTES;
    };

    // After a `result` the child is left to exit on its own first (an immediate SIGTERM
    // could cut off Claude Code's credential writes); one still running `backstopMs`
    // later is terminated. The turn has already settled, so this never re-settles it.
    const armBackstop = (): void => {
      if (backstopArmed) {
        return;
      }
      backstopArmed = true;
      const backstopTimer = setTimeout(() => {
        terminateChild(child, killGraceMs);
      }, backstopMs);
      backstopTimer.unref();
      child.once('exit', () => {
        clearTimeout(backstopTimer);
      });
    };

    // A stdout line past the carry cap: kill the child and fail with the shape
    // claude-default maps to the D13 copy (`killed: false`, so never the timeout copy).
    const onOverflow = (): void => {
      if (settled) {
        return;
      }
      terminateChild(child, killGraceMs);
      finish(() =>
        reject(
          turnFailure('Command failed: claude', 'invalid-result', sawInit, {
            code: null,
            killed: false,
            signal: null,
            stdout: '',
            stderr,
          }),
        ),
      );
    };

    function finish(callback: () => void): void {
      if (settled) {
        return;
      }
      settled = true;
      if (budgetTimer) {
        clearTimeout(budgetTimer);
      }
      signal?.removeEventListener('abort', onAbort);
      callback();
    }

    const handleEvent = (event: unknown): void => {
      if (settled) {
        return;
      }
      if (isInitEvent(event)) {
        if (!sawInit) {
          sawInit = true;
          onStage?.('init');
        }
        return;
      }
      const text = textDeltaOf(event);
      if (text !== undefined) {
        if (!sawDelta) {
          sawDelta = true;
          onStage?.('first-delta');
        }
        if (!settled) {
          onTextDelta?.(text);
        }
        return;
      }
      if (!isRecord(event) || event.type !== 'result') {
        return;
      }
      // Every `result` ends the turn; a child that then never exits is reaped.
      armBackstop();
      const parsed = streamJsonResultSchema.safeParse(event);
      if (!parsed.success) {
        finish(() =>
          reject(
            turnFailure('Command failed: claude', 'invalid-result', sawInit, {
              code: null,
              killed: false,
              signal: null,
              stdout: '',
              stderr,
            }),
          ),
        );
        return;
      }
      if (parsed.data.is_error) {
        // Never branch on subtype: the auth failure is subtype "success" (Probe 3).
        finish(() =>
          reject(
            turnFailure('Command failed: claude', 'is-error', sawInit, {
              code: 1,
              killed: false,
              signal: null,
              stdout: parsed.data.result ?? '',
              stderr,
            }),
          ),
        );
        return;
      }
      onStage?.('result');
      finish(() => resolve(parsed.data.result ?? ''));
    };

    if (child.pid !== undefined) {
      onStage?.('spawned', { pid: child.pid });
    }

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', createLineParser(handleEvent, { onOverflow }));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', collectStderr);

    child.on('error', (error: NodeJS.ErrnoException) => {
      finish(() => reject(Object.assign(error, { reason: 'spawn-error' as const, sawInit })));
    });
    child.on('exit', (code, exitSignal) => {
      onStage?.('exit', { code, signal: exitSignal });
    });
    child.on('close', (code, closeSignal) => {
      finish(() =>
        reject(
          turnFailure('Command failed: claude', 'exit-without-result', sawInit, {
            code,
            killed: false,
            signal: closeSignal,
            stdout: '',
            stderr,
          }),
        ),
      );
    });

    budgetTimer = setTimeout(() => {
      if (settled) {
        return;
      }
      onStage?.('timed-out');
      terminateChild(child, killGraceMs);
      finish(() => reject(timeoutFailure(stderr, sawInit)));
    }, budgetMs);
    budgetTimer.unref();

    signal?.addEventListener('abort', onAbort, { once: true });

    // An early-dying child closes stdin under us: EPIPE must not crash the daemon.
    child.stdin.on('error', () => {});
    child.stdin.write(buildStreamJsonUserLine(prompt));
    child.stdin.end();
  });
}
