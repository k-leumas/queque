import type { CandidateList } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { readEnvValueFromDotEnvLocal } from '../shared/env-file.js';
import { fetchCandidates as fetchSdkCandidates } from './claude.js';
import { fetchClaudeCliCandidates } from './claude-cli.js';
import type { LLMAdapter } from './provider.js';

const TOTAL_BUDGET_MS = 25_000;

const AUTH_FAILURE_RE =
  /not logged in|login expired|please run \/login|failed to authenticate|oauth (token|session)/i;

const D13_MESSAGE =
  'QueQue: Claude is not authenticated. Run `claude /login`, or set ANTHROPIC_API_KEY in the environment or .env.local.';

const ENOENT_MESSAGE =
  'QueQue: Claude is not authenticated. Install Claude Code, run `claude /login`, or set ANTHROPIC_API_KEY in the environment or .env.local.';

const TIMEOUT_MESSAGE =
  'QueQue: Claude timed out. Run `claude /login`, or set ANTHROPIC_API_KEY in the environment or .env.local.';

/** Minimum remaining budget required to start an SDK rescue after CLI failure. */
export const MIN_SDK_RESCUE_MS = 1000;

/**
 * Returns milliseconds left before `deadline`, floored at zero.
 */
export function remainingMs(deadline: number): number {
  return Math.max(0, deadline - Date.now());
}

function errorField(error: unknown, field: string): unknown {
  if (error !== null && typeof error === 'object' && field in error) {
    return (error as Record<string, unknown>)[field];
  }
  return undefined;
}

function streamText(error: unknown, field: 'stdout' | 'stderr'): string {
  const value = errorField(error, field);
  return typeof value === 'string' ? value : '';
}

function isAuthFailure(error: unknown): boolean {
  return AUTH_FAILURE_RE.test(`${streamText(error, 'stdout')}\n${streamText(error, 'stderr')}`);
}

function isEnoent(error: unknown): boolean {
  return errorField(error, 'code') === 'ENOENT';
}

function isTimeoutOrKilled(error: unknown): boolean {
  const killed = errorField(error, 'killed') === true;
  const signal = errorField(error, 'signal');
  const message = error instanceof Error ? error.message : String(error);
  return killed || signal === 'SIGTERM' || /timed out|ETIMEDOUT/i.test(message);
}

function exitCodeDetail(error: unknown): boolean {
  const code = errorField(error, 'code');
  return code !== 0 && code !== null && code !== undefined;
}

function lookupApiKey(): string | undefined {
  return (
    process.env.ANTHROPIC_API_KEY ?? readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY') ?? undefined
  );
}

function hardError(error: unknown): Error {
  if (isEnoent(error)) {
    return new Error(ENOENT_MESSAGE);
  }
  if (isTimeoutOrKilled(error)) {
    return new Error(TIMEOUT_MESSAGE);
  }
  if (isAuthFailure(error)) {
    return new Error(D13_MESSAGE);
  }
  return new Error(D13_MESSAGE);
}

/**
 * CLI-first composite: spawn `claude -p`, then rescue with the Anthropic SDK
 * when a key exists and enough of the shared 25s budget remains.
 */
export const claudeDefaultAdapter: LLMAdapter = {
  async fetchCandidates(envelope: ContextEnvelope): Promise<CandidateList> {
    const deadline = Date.now() + TOTAL_BUDGET_MS;

    try {
      return await fetchClaudeCliCandidates(envelope, remainingMs(deadline));
    } catch (error) {
      const authFailure = isAuthFailure(error);
      void appendDebugLog('provider', 'claude-cli path', {
        path: 'claude-cli',
        exitCode: exitCodeDetail(error),
        authFailure,
      });

      const remaining = remainingMs(deadline);
      const apiKey = lookupApiKey();

      if (apiKey && remaining >= MIN_SDK_RESCUE_MS) {
        void appendDebugLog('provider', 'sdk-rescue path', {
          path: 'sdk-rescue',
          exitCode: exitCodeDetail(error),
          authFailure,
        });
        return fetchSdkCandidates(envelope, '', remaining);
      }

      if (remaining < MIN_SDK_RESCUE_MS) {
        throw new Error(TIMEOUT_MESSAGE);
      }

      throw hardError(error);
    }
  },
};
