import { createHash } from 'node:crypto';
import { appendDebugLog } from '../shared/debug-log.js';
import {
  type ClaudeChild,
  isRunning,
  SIGKILL_GRACE_MS,
  spawnClaudeChild,
} from './claude-process.js';

/**
 * One-slot prewarm pool for `claude -p` (Phase 09.1, D-11, D-12, RESEARCH Pattern 8).
 *
 * The daemon keeps one idle `claude -p --input-format stream-json` child ready, so a query
 * skips Claude Code's ~0.9 s boot. Its argv (system prompt, effort) and cwd are fixed at
 * spawn, so a child is handed out only to a query with the same key; anything else retires
 * it and runs cold. The slot is refilled by the caller after each query settles, never at
 * take time, so the next boot does not compete with the streaming turn.
 *
 * The pool is off by default and only the daemon command enables it, so the client's
 * in-process fallback never leaves an idle `claude` behind. Nothing here respawns on its
 * own: a child that fails to spawn or dies while idle only clears the slot (Pitfall 11).
 *
 * argv stays an opaque list here: the claude flags live in claude-cli.ts. Only children
 * this module spawned are ever signalled; no pid lookup.
 */

export interface PrewarmSpec {
  command: string;
  argv: readonly string[];
  cwd: string;
}

export type PrewarmMissReason = 'disabled' | 'empty' | 'dead' | 'cwd' | 'prompt';

export type PrewarmTake = { child: ClaudeChild } | { miss: PrewarmMissReason };

export interface PrewarmSnapshot {
  enabled: boolean;
  state: 'empty' | 'idle';
  pid?: number;
}

type EntryState = 'idle' | 'taken' | 'retired';

interface SlotEntry {
  child: ClaudeChild;
  cwd: string;
  key: string;
  state: EntryState;
}

let enabled = false;
let slot: SlotEntry | undefined;
/** Set when the idle child died on its own; the next take reports `dead` once. */
let diedIdle = false;

/**
 * The pool key: sha256 hex of `{ command, cwd, argv }`.
 *
 * D-12 asks for the cwd plus a hash of the system prompt. Hashing the whole argv is
 * equivalent, because the steered system prompt (buildSystemPrompt of the envelope) is an
 * argv element after `--system-prompt`. The key also covers `--effort` and the fixed flags
 * on purpose: they are fixed when the process boots, so a child booted with other flags
 * or another effort must never answer. A change in the installed-tools list changes the
 * system prompt, so it is a `prompt` miss by design.
 */
export function prewarmKey(spec: PrewarmSpec): string {
  return createHash('sha256')
    .update(JSON.stringify({ command: spec.command, cwd: spec.cwd, argv: spec.argv }))
    .digest('hex');
}

/** Turns the pool on. Called by the daemon command only, after its server started. */
export function enablePrewarm(): void {
  enabled = true;
}

/** Retires any idle child and turns the pool off (tests, and symmetry with enable). */
export function disablePrewarm(): void {
  retirePrewarmed();
  enabled = false;
  diedIdle = false;
}

/** Ends an idle child with stdin EOF (exit 0 in ~0.4 s, Probe 5), SIGKILL after `graceMs`. */
function retireChild(child: ClaudeChild, graceMs: number): void {
  if (!isRunning(child)) {
    return;
  }
  child.stdin.end();
  const killTimer = setTimeout(() => {
    if (isRunning(child)) {
      child.kill('SIGKILL');
    }
  }, graceMs);
  killTimer.unref();
  child.once('exit', () => {
    clearTimeout(killTimer);
  });
}

/** Empties the slot and retires its child, if any. */
function retireSlot(graceMs: number): void {
  const entry = slot;
  if (!entry) {
    return;
  }
  slot = undefined;
  entry.state = 'retired';
  void appendDebugLog('provider', 'prewarm retired', { pid: entry.child.pid ?? null });
  retireChild(entry.child, graceMs);
}

/**
 * Makes sure one idle child is ready for `spec`. No-op while disabled, or when the slot
 * already holds a live child with the same key; otherwise retires the current child and
 * spawns a new one in `spec.cwd`. Never throws.
 */
export function schedulePrewarm(spec: PrewarmSpec): void {
  if (!enabled) {
    return;
  }
  const key = prewarmKey(spec);
  if (slot && slot.key === key && isRunning(slot.child)) {
    return;
  }
  retireSlot(SIGKILL_GRACE_MS);
  diedIdle = false;

  let child: ClaudeChild;
  try {
    child = spawnClaudeChild(spec.command, spec.argv, spec.cwd, process.env);
  } catch (error) {
    void appendDebugLog('provider', 'prewarm spawn failed', {
      code: (error as NodeJS.ErrnoException).code ?? null,
    });
    return;
  }

  const entry: SlotEntry = { child, cwd: spec.cwd, key, state: 'idle' };
  slot = entry;

  // An unhandled `error` event would crash the daemon. Neither handler respawns.
  const clearIfIdle = (): void => {
    if (slot === entry) {
      slot = undefined;
      diedIdle = true;
    }
  };
  child.on('error', (error: NodeJS.ErrnoException) => {
    const wasIdle = entry.state === 'idle';
    clearIfIdle();
    if (wasIdle) {
      void appendDebugLog('provider', 'prewarm error', { code: error.code ?? null });
    }
  });
  // A child that dies while idle closes its stdin under us: EPIPE must not crash the daemon.
  child.stdin.on('error', () => {});
  child.on('exit', (code, signal) => {
    clearIfIdle();
    // A taken child's exit belongs to the turn, which logs its own `cli exit`.
    if (entry.state !== 'taken') {
      void appendDebugLog('provider', 'prewarm exit', {
        pid: child.pid ?? null,
        code,
        signal,
        retired: entry.state === 'retired',
      });
    }
  });

  if (child.pid !== undefined) {
    void appendDebugLog('provider', 'prewarm spawned', { pid: child.pid });
  }
}

/**
 * Hands out the idle child when its cwd and argv match `spec` (D-12), and empties the slot
 * either way. A mismatched child is retired; the caller then runs cold.
 */
export function takePrewarmed(spec: PrewarmSpec): PrewarmTake {
  if (!enabled) {
    return { miss: 'disabled' };
  }
  const entry = slot;
  if (!entry) {
    const reason: PrewarmMissReason = diedIdle ? 'dead' : 'empty';
    diedIdle = false;
    return { miss: reason };
  }
  if (!isRunning(entry.child)) {
    slot = undefined;
    entry.state = 'retired';
    diedIdle = false;
    return { miss: 'dead' };
  }
  if (entry.cwd !== spec.cwd) {
    retireSlot(SIGKILL_GRACE_MS);
    return { miss: 'cwd' };
  }
  if (entry.key !== prewarmKey(spec)) {
    retireSlot(SIGKILL_GRACE_MS);
    return { miss: 'prompt' };
  }
  slot = undefined;
  entry.state = 'taken';
  return { child: entry.child };
}

/**
 * Empties the slot and retires its child: stdin EOF, then SIGKILL after `graceMs` if it
 * is still running (unref'd timer, so it never holds the daemon open). Daemon shutdown.
 */
export function retirePrewarmed(graceMs: number = SIGKILL_GRACE_MS): void {
  retireSlot(graceMs);
}

/** The slot's state for tests and logs. */
export function prewarmSnapshot(): PrewarmSnapshot {
  if (!slot) {
    return { enabled, state: 'empty' };
  }
  return slot.child.pid === undefined
    ? { enabled, state: 'idle' }
    : { enabled, state: 'idle', pid: slot.child.pid };
}
