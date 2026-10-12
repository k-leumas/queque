import type { CandidateList, CommandCandidate } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { resolveEffort } from '../shared/qq-config.js';
import { createCandidateScanner, parseStrictCandidateList } from './candidate-stream.js';
import { buildPrompt, ensureSelectableCandidates, parseCandidates } from './claude.js';
import { type PrewarmSpec, schedulePrewarm, takePrewarmed } from './claude-prewarm.js';
import {
  type ClaudeChild,
  type ClaudeTurnStage,
  type ClaudeTurnStageDetail,
  runClaudeTurn,
} from './claude-process.js';
import type { FetchOptions, LLMAdapter } from './provider.js';
import { buildSystemPrompt } from './steering.js';

const CLI_BUDGET_MS = 25_000;

/**
 * How long a prewarmed child may take from the user-line write to `init` before it counts
 * as stale and the turn is retried cold (WR-02). A healthy idle child answers in 29-52 ms
 * (RESEARCH Probe 5); a stall after a long idle or laptop sleep otherwise uses the whole
 * 25 s budget and ends as a timeout, which is never retried.
 */
export const WARM_INIT_DEADLINE_MS = 1500;

/**
 * Extra init time for a child taken while it may still be booting: cold boot to `init` is
 * 954-1003 ms even at load 6 (RESEARCH). A child younger than this gets the rest of it on
 * top of WARM_INIT_DEADLINE_MS, so a healthy fresh prewarm is never cut off.
 */
export const PREWARM_BOOT_ALLOWANCE_MS = 3000;

/** The init deadline for a prewarmed child spawned at `spawnedAt`. */
export function warmInitDeadlineMs(spawnedAt: number, now: number = Date.now()): number {
  const ageMs = Math.max(0, now - spawnedAt);
  return WARM_INIT_DEADLINE_MS + Math.max(0, PREWARM_BOOT_ALLOWANCE_MS - ageMs);
}

/** The Claude Code binary, resolved on PATH. */
export const CLAUDE_COMMAND = 'claude';

/**
 * `claude -p` argv for one QueQue turn (Phase 09.1, D-04).
 *
 * stream-json in and out (`--output-format stream-json` requires `--verbose` in print
 * mode, Probe 1). No positional prompt: the prompt goes over stdin. `--effort` comes from
 * config.json, default `low` (D-01). No model flag (D-02) and never `--bare` (it skips
 * Keychain/OAuth for `/login` users).
 */
export function buildClaudeCliArgv(envelope: ContextEnvelope): string[] {
  return [
    '-p',
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--effort',
    resolveEffort(),
    '--safe-mode',
    '--tools',
    '',
    '--no-session-persistence',
    '--system-prompt',
    buildSystemPrompt(envelope),
  ];
}

/**
 * Runs one `claude -p` stream-json turn and parses the `result` text with the shared
 * candidate contract. Throws on spawn failure, an is_error result, exit without a result,
 * timeout or abort. Does not rescue via the SDK.
 *
 * With `options.onCandidate`, each candidate is scanned out of the text deltas and handed
 * over as soon as its object closes (D-05), never after `options.signal` aborts. The final
 * list is the strict parse of the result text; if that fails after rows streamed, the
 * streamed (already validated) rows; only when nothing streamed, parseCandidates' fallback.
 *
 * Prewarm (D-11, D-12, D-13): the turn runs on the pool's idle child when its cwd and argv
 * match this query, otherwise cold. A warm turn whose child ended without a `result`, or
 * sent no `init` within warmInitDeadlineMs, and streamed no row is retried once cold within
 * the remaining budget (a stale prewarm after a long idle or laptop sleep, RESEARCH A3);
 * is_error, timeout and abort never are. A warm child that stalls after `init` (a request
 * stuck on a dead connection) is not detected and still ends as a timeout. Once
 * the last attempt settled, the slot is refilled for this query's cwd and argv, so the
 * next boot does not compete with the turn. The pool is only enabled in the daemon.
 */
export async function fetchClaudeCliCandidates(
  envelope: ContextEnvelope,
  remainingBudgetMs: number,
  options: FetchOptions = {},
): Promise<CandidateList> {
  const startedAt = Date.now();
  const deadline = startedAt + remainingBudgetMs;
  const streamed: CommandCandidate[] = [];
  const { onCandidate, signal } = options;
  const spec: PrewarmSpec = {
    command: CLAUDE_COMMAND,
    argv: buildClaudeCliArgv(envelope),
    cwd: envelope.base.cwd,
  };
  const prompt = buildPrompt(envelope);

  // A fresh scanner per attempt: a failed attempt's half-scanned text must not leak into
  // the retry. Rows already handed over are never re-sent (no retry once one streamed).
  const createTextDeltaHandler = (): ((text: string) => void) | undefined =>
    onCandidate
      ? createCandidateScanner((candidate) => {
          streamed.push(candidate);
          if (streamed.length === 1) {
            void appendDebugLog('provider', 'cli first candidate', { ms: Date.now() - startedAt });
          }
          if (!signal?.aborted) {
            onCandidate(candidate);
          }
        })
      : undefined;

  const runTurn = (
    child: ClaudeChild | undefined,
    budgetMs: number,
    initDeadlineMs?: number,
  ): Promise<string> =>
    runClaudeTurn({
      command: spec.command,
      argv: spec.argv,
      cwd: spec.cwd,
      env: process.env,
      prompt,
      budgetMs,
      signal,
      onTextDelta: createTextDeltaHandler(),
      onStage: (stage, detail) => {
        logTurnStage(stage, detail, Date.now() - startedAt, child !== undefined);
      },
      ...(child ? { child } : {}),
      ...(initDeadlineMs === undefined ? {} : { initDeadlineMs }),
    });

  try {
    const take = takePrewarmed(spec);
    let text: string;
    if ('child' in take) {
      void appendDebugLog('provider', 'prewarm hit');
      try {
        text = await runTurn(take.child, remainingBudgetMs, warmInitDeadlineMs(take.spawnedAt));
      } catch (error) {
        const leftMs = deadline - Date.now();
        if (
          !isStalePrewarmFailure(error) ||
          streamed.length > 0 ||
          signal?.aborted ||
          leftMs <= 0
        ) {
          throw error;
        }
        void appendDebugLog('provider', 'prewarm retry cold', { ms: Date.now() - startedAt });
        text = await runTurn(undefined, leftMs);
      }
    } else {
      void appendDebugLog('provider', 'prewarm miss', { reason: take.miss });
      text = await runTurn(undefined, remainingBudgetMs);
    }
    const finalList =
      parseStrictCandidateList(text) ?? (streamed.length > 0 ? streamed : parseCandidates(text));
    return ensureSelectableCandidates(finalList);
  } finally {
    // D-11/D-13: refill after every settle (success, error or abort), in this query's cwd
    // with this query's argv. A no-op outside the daemon.
    schedulePrewarm(spec);
  }
}

/**
 * A warm child that ended without a `result` (died before init, or no result line), or one
 * that sent no `init` within its deadline (`stale-prewarm`, WR-02).
 */
function isStalePrewarmFailure(error: unknown): boolean {
  if (error === null || typeof error !== 'object') {
    return false;
  }
  const reason = (error as { reason?: unknown }).reason;
  return reason === 'exit-without-result' || reason === 'stale-prewarm';
}

const STAGE_LOG_NAMES: Record<ClaudeTurnStage, string> = {
  spawned: 'cli spawned',
  init: 'cli init',
  'first-delta': 'cli first delta',
  result: 'cli result',
  exit: 'cli exit',
  aborted: 'cli aborted',
  'timed-out': 'cli timed out',
  'init-timed-out': 'cli init timed out',
};

/**
 * One debug line per turn stage with the ms since the turn started (D-04). Only `ms` and
 * `warm` (prewarmed child or not), plus `code` and `signal` on exit: never the prompt,
 * argv, env, stdout or stderr.
 */
function logTurnStage(
  stage: ClaudeTurnStage,
  detail: ClaudeTurnStageDetail | undefined,
  ms: number,
  warm: boolean,
): void {
  const fields: Record<string, unknown> =
    stage === 'exit'
      ? { ms, warm, code: detail?.code ?? null, signal: detail?.signal ?? null }
      : { ms, warm };
  void appendDebugLog('provider', STAGE_LOG_NAMES[stage], fields);
}

/**
 * Raw CLI-only adapter. Unregistered — isolation and tests only.
 */
export const claudeCliAdapter: LLMAdapter = {
  async fetchCandidates(envelope: ContextEnvelope, options?: FetchOptions): Promise<CandidateList> {
    return fetchClaudeCliCandidates(envelope, CLI_BUDGET_MS, options);
  },
};
