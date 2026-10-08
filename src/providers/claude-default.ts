import type { CandidateList } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { readEnvValueFromDotEnvLocal, usableSecret } from '../shared/env-file.js';
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
    usableSecret(process.env.ANTHROPIC_API_KEY) ??
    usableSecret(readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY'))
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
 * Claude composite: SDK-first when a usable API key exists, otherwise
 * `claude -p` for `/login`-only users. Shared 25s budget under FIFO 30s.
 */
export const claudeDefaultAdapter: LLMAdapter = {
  async fetchCandidates(envelope: ContextEnvelope): Promise<CandidateList> {
    const deadline = Date.now() + TOTAL_BUDGET_MS;
    const apiKey = lookupApiKey();

    if (apiKey) {
      void appendDebugLog('provider', 'sdk path', {
        path: 'sdk',
      });
      return fetchSdkCandidates(envelope, '', remainingMs(deadline));
    }

    try {
      return await fetchClaudeCliCandidates(envelope, remainingMs(deadline));
    } catch (error) {
      void appendDebugLog('provider', 'claude-cli path', {
        path: 'claude-cli',
        exitCode: exitCodeDetail(error),
        authFailure: isAuthFailure(error),
      });
      throw hardError(error);
    }
  },
};
