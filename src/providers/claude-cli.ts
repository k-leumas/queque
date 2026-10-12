import type { CandidateList } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { resolveEffort } from '../shared/qq-config.js';
import { buildPrompt, ensureSelectableCandidates, parseCandidates } from './claude.js';
import {
  type ClaudeTurnStage,
  type ClaudeTurnStageDetail,
  runClaudeTurn,
} from './claude-process.js';
import type { FetchOptions, LLMAdapter } from './provider.js';
import { buildSystemPrompt } from './steering.js';

const CLI_BUDGET_MS = 25_000;

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
 */
export async function fetchClaudeCliCandidates(
  envelope: ContextEnvelope,
  remainingBudgetMs: number,
  options: FetchOptions = {},
): Promise<CandidateList> {
  const startedAt = Date.now();
  const text = await runClaudeTurn({
    command: CLAUDE_COMMAND,
    argv: buildClaudeCliArgv(envelope),
    cwd: envelope.base.cwd,
    env: process.env,
    prompt: buildPrompt(envelope),
    budgetMs: remainingBudgetMs,
    signal: options.signal,
    onStage: (stage, detail) => {
      logTurnStage(stage, detail, Date.now() - startedAt);
    },
  });
  return ensureSelectableCandidates(parseCandidates(text));
}

const STAGE_LOG_NAMES: Record<ClaudeTurnStage, string> = {
  spawned: 'cli spawned',
  init: 'cli init',
  'first-delta': 'cli first delta',
  result: 'cli result',
  exit: 'cli exit',
  aborted: 'cli aborted',
  'timed-out': 'cli timed out',
};

/**
 * One debug line per turn stage with the ms since the turn started (D-04). Only `ms`,
 * plus `code` and `signal` on exit: never the prompt, argv, env, stdout or stderr.
 */
function logTurnStage(
  stage: ClaudeTurnStage,
  detail: ClaudeTurnStageDetail | undefined,
  ms: number,
): void {
  const fields: Record<string, unknown> =
    stage === 'exit' ? { ms, code: detail?.code ?? null, signal: detail?.signal ?? null } : { ms };
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
