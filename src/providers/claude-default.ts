import type { CandidateList } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { readEnvValueFromDotEnvLocal, usableSecret } from '../shared/env-file.js';
import { fetchCandidates as fetchSdkCandidates, TRUNCATED_RESPONSE_MESSAGE } from './claude.js';
import { fetchClaudeCliCandidates } from './claude-cli.js';
import { type FetchOptions, isAbortError, type LLMAdapter } from './provider.js';

const TOTAL_BUDGET_MS = 25_000;

const AUTH_FAILURE_RE =
  /not logged in|login expired|please run \/login|failed to authenticate|oauth (token|session)/i;

// D-02 step 3 / D-13: `claude /login` first, the key second, then the path into the
// provider picker. The hint is static copy only; nothing here prompts or probes (D-03).
const D13_MESSAGE =
  'QueQue: Claude is not authenticated. Run `claude /login`, or set ANTHROPIC_API_KEY in the environment or ~/.env.local. To use OpenAI or Ollama instead, run `qq init provider`.';

const ENOENT_MESSAGE =
  'QueQue: No AI provider is ready. Install Claude Code and run `claude /login`, or set ANTHROPIC_API_KEY in the environment or ~/.env.local. To use OpenAI or Ollama instead, run `qq init provider`.';

// WR-01: any other `claude -p` failure (an `is-error` result such as an overload, a usage
// limit or a network error, `invalid-result`, `exit-without-result`). Static copy that
// names the failure class only, never the raw stdout, and does not send the user to
// `qq init provider` for what is usually a transient problem.
const CLI_FAILED_MESSAGE =
  'QueQue: Claude Code could not answer (claude -p failed). Try ?? again; run `claude -p "hi"` to see the error.';

// IN-07: the Anthropic API rejected the key (SDK APIError status 401) or refused it (403).
// Static copy naming the key and the ways out, never the raw SDK error text.
const SDK_KEY_REJECTED_MESSAGE =
  'QueQue: Anthropic rejected ANTHROPIC_API_KEY (HTTP 401). Check the key in your environment or ~/.env.local, remove it to use your Claude Code login, or run `qq init provider` to switch providers.';

const SDK_KEY_REFUSED_MESSAGE =
  "QueQue: Anthropic refused the request for ANTHROPIC_API_KEY (HTTP 403). Check the key's permissions, remove it to use your Claude Code login, or run `qq init provider` to switch providers.";

const TIMEOUT_MESSAGE =
  'QueQue: Claude timed out. Run `claude /login`, or set ANTHROPIC_API_KEY in the environment or ~/.env.local.';

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

/** The usable ANTHROPIC_API_KEY (env first, then ~/.env.local): set means the SDK path. */
export function lookupApiKey(): string | undefined {
  return (
    usableSecret(process.env.ANTHROPIC_API_KEY) ??
    usableSecret(readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY'))
  );
}

function hardError(error: unknown): Error {
  // WR-01-r2: a cut-off answer shows the same copy as the SDK path, never the D13 login copy.
  if (error instanceof Error && error.message === TRUNCATED_RESPONSE_MESSAGE) {
    return error;
  }
  if (isEnoent(error)) {
    return new Error(ENOENT_MESSAGE);
  }
  if (isTimeoutOrKilled(error)) {
    return new Error(TIMEOUT_MESSAGE);
  }
  if (isAuthFailure(error)) {
    return new Error(D13_MESSAGE);
  }
  return new Error(CLI_FAILED_MESSAGE);
}

/**
 * Maps an SDK auth failure (APIError status 401 or 403) to static copy (IN-07). Every
 * other error, AbortError included, is returned unchanged.
 */
function sdkError(error: unknown): unknown {
  if (isAbortError(error)) {
    return error;
  }
  const status = errorField(error, 'status');
  if (status === 401) {
    return new Error(SDK_KEY_REJECTED_MESSAGE);
  }
  if (status === 403) {
    return new Error(SDK_KEY_REFUSED_MESSAGE);
  }
  return error;
}

/**
 * Claude composite: SDK-first when a usable API key exists, otherwise
 * `claude -p` for `/login`-only users. Shared 25s budget under FIFO 30s.
 */
export const claudeDefaultAdapter: LLMAdapter = {
  async fetchCandidates(envelope: ContextEnvelope, options?: FetchOptions): Promise<CandidateList> {
    const deadline = Date.now() + TOTAL_BUDGET_MS;
    const apiKey = lookupApiKey();

    if (apiKey) {
      void appendDebugLog('provider', 'sdk path', {
        path: 'sdk',
      });
      // Outside the CLI try/catch: hardError never sees an SDK error. sdkError maps only a
      // 401/403 to static copy, so an SDK AbortError reaches the daemon unmapped (D-13), like
      // the CLI branch's re-throw.
      try {
        return await fetchSdkCandidates(envelope, '', remainingMs(deadline), options);
      } catch (error) {
        throw sdkError(error);
      }
    }

    try {
      return await fetchClaudeCliCandidates(envelope, remainingMs(deadline), options);
    } catch (error) {
      if (isAbortError(error)) {
        // D-13: an aborted turn is not a failure; the daemon writes nothing for it.
        void appendDebugLog('provider', 'claude-cli aborted');
        throw error;
      }
      void appendDebugLog('provider', 'claude-cli path', {
        path: 'claude-cli',
        exitCode: exitCodeDetail(error),
        authFailure: isAuthFailure(error),
      });
      throw hardError(error);
    }
  },
};
