import type { ChildProcess, ChildProcessByStdio } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';

/** SIGTERM → SIGKILL grace: 2.6x the slowest measured SIGTERM exit (583 ms, Probe 8). */
export const SIGKILL_GRACE_MS = 1500;
/** Post-result backstop kill, armed in plan 06. */
export const POST_RESULT_BACKSTOP_MS = 2000;
/** stderr cap, enforced in plan 06. */
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
}

export type ClaudeChild = ChildProcessByStdio<Writable, Readable, Readable>;

export function spawnClaudeChild(
  _command: string,
  _argv: readonly string[],
  _cwd: string,
  _env?: NodeJS.ProcessEnv,
): ClaudeChild {
  throw new Error('spawnClaudeChild: not implemented');
}

export function terminateChild(_child: ChildProcess, _graceMs: number = SIGKILL_GRACE_MS): void {
  throw new Error('terminateChild: not implemented');
}

export function runClaudeTurn(_options: ClaudeTurnOptions): Promise<string> {
  throw new Error('runClaudeTurn: not implemented');
}
