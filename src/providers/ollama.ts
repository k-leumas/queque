import type { CandidateList } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import { appendDebugLog } from '../shared/debug-log.js';
import {
  buildPrompt,
  ensureSelectableCandidates,
  finalCandidateList,
  TRUNCATED_RESPONSE_MESSAGE,
} from './claude.js';
import { abortError, type FetchOptions, type LLMAdapter } from './provider.js';
import { loadProviderPin, OLLAMA_DEFAULT_BASE_URL } from './provider-pin.js';
import { buildSystemPrompt } from './steering.js';

/** Same budget as Claude: zsh reads the FIFO for 30s and the IPC client waits 26s. */
export const OLLAMA_TIMEOUT_MS = 25_000;

/** Ollama's `error` field is local and carries no secrets; it is still capped. */
const MAX_ERROR_DETAIL = 160;

const SWITCH_HINT = 'Run `qq init provider` to switch providers.';
const UNREACHABLE_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH']);

export interface OllamaSettings {
  baseUrl: string;
  model: string;
}

function errorCode(error: unknown): string | undefined {
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause;
  return typeof cause?.code === 'string' ? cause.code : undefined;
}

function errorName(error: unknown): string | undefined {
  const name = (error as { name?: unknown } | null)?.name;
  return typeof name === 'string' ? name : undefined;
}

/** One line, capped: the FIFO error is a single shell line. */
function oneLine(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > MAX_ERROR_DETAIL ? `${flat.slice(0, MAX_ERROR_DETAIL)}…` : flat;
}

function unexpectedResponse(): Error {
  return new Error(`QueQue: Ollama returned an unexpected response. ${SWITCH_HINT}`);
}

/**
 * Maps a rejected fetch (or body read) to one actionable QueQue line. A user abort is
 * rethrown as QueQue's AbortError, unmapped (D-13 cancellation chain).
 */
function mapRequestFailure(
  error: unknown,
  origin: string,
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Error {
  if (signal?.aborted) {
    return abortError();
  }
  const name = errorName(error);
  if (name === 'TimeoutError' || name === 'AbortError') {
    const seconds = Math.ceil(timeoutMs / 1000);
    return new Error(
      `QueQue: Ollama did not answer within ${seconds}s (the model may still be loading). Try ?? again.`,
    );
  }
  const code = errorCode(error);
  if (code && UNREACHABLE_CODES.has(code)) {
    return new Error(
      `QueQue: Ollama is not reachable at ${origin}. Start it with \`ollama serve\`, or run \`qq init provider\` to switch providers.`,
    );
  }
  return new Error(
    `QueQue: Ollama request to ${origin} failed (${code ?? name ?? 'error'}). ${SWITCH_HINT}`,
  );
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error.trim() !== '') {
      return oneLine(body.error);
    }
  } catch {
    // Not JSON — fall back to the status text.
  }
  return oneLine(response.statusText) || 'no detail';
}

/**
 * Calls Ollama's POST {baseUrl}/api/chat (non-streaming) and returns parsed candidates.
 *
 * The body carries only the model, `stream: false`, and the shared system and
 * privacy-filtered user prompts. No Authorization header is sent. Debug lines carry
 * model, status and duration only, never the base URL, the prompt, or the response.
 *
 * Every failure is one QueQue-prefixed line naming the fix; nothing here falls back to
 * another provider (D-01, D-12). The final list follows finalCandidateList: an answer
 * that did not stop normally (`done_reason` other than `stop`) never reaches the prose
 * fallback, so a cut-off fragment never becomes a command.
 */
export async function fetchOllamaCandidates(
  envelope: ContextEnvelope,
  settings: OllamaSettings,
  timeoutMs: number = OLLAMA_TIMEOUT_MS,
  options: FetchOptions = {},
): Promise<CandidateList> {
  const { signal } = options;
  if (signal?.aborted) {
    throw abortError();
  }

  const url = new URL('/api/chat', settings.baseUrl);
  const { origin } = url;
  const timeout = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const started = Date.now();
  const logRequest = (status: number | null) => {
    void appendDebugLog('provider', 'ollama request', {
      model: settings.model,
      status,
      durationMs: Date.now() - started,
    });
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: settings.model,
        stream: false,
        messages: [
          { role: 'system', content: buildSystemPrompt(envelope) },
          { role: 'user', content: buildPrompt(envelope) },
        ],
      }),
      signal: requestSignal,
    });
  } catch (error) {
    logRequest(null);
    throw mapRequestFailure(error, origin, timeoutMs, signal);
  }

  logRequest(response.status);

  if (response.status === 404) {
    throw new Error(
      `QueQue: Ollama model '${settings.model}' is not installed. Run \`ollama pull ${settings.model}\`, or run \`qq init provider\` to pick another model.`,
    );
  }
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`QueQue: Ollama returned HTTP ${response.status}: ${detail}. ${SWITCH_HINT}`);
  }

  let raw: string;
  try {
    raw = await response.text();
  } catch (error) {
    throw mapRequestFailure(error, origin, timeoutMs, signal);
  }

  let body: { message?: { content?: unknown }; done_reason?: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    throw unexpectedResponse();
  }
  const content = body?.message?.content;
  if (typeof content !== 'string') {
    throw unexpectedResponse();
  }

  try {
    return ensureSelectableCandidates(
      finalCandidateList(content, [], body.done_reason === 'stop', { model: settings.model }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === TRUNCATED_RESPONSE_MESSAGE) {
      throw new Error(
        'QueQue: Ollama response was cut off before a full command. Try ?? again, or run `qq init provider` to pick another model.',
      );
    }
    throw error;
  }
}

/**
 * The `ollama` registry backend. It runs only for an Ollama pin and never calls a Claude
 * adapter on failure (D-01, D-12).
 */
export const ollamaAdapter: LLMAdapter = {
  fetchCandidates(envelope, options) {
    const state = loadProviderPin();
    if (state.kind !== 'pinned' || state.pin.provider !== 'ollama') {
      return Promise.reject(
        new Error('QueQue: Ollama is not the pinned provider. Run `qq init provider`.'),
      );
    }
    return fetchOllamaCandidates(
      envelope,
      { baseUrl: state.pin.baseUrl ?? OLLAMA_DEFAULT_BASE_URL, model: state.pin.model },
      OLLAMA_TIMEOUT_MS,
      options,
    );
  },
};
