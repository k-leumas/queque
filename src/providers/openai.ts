import type { CandidateList } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { readEnvValueFromDotEnvLocal, usableSecret } from '../shared/env-file.js';
import {
  buildPrompt,
  ensureSelectableCandidates,
  finalCandidateListWithoutProse,
  TRUNCATED_RESPONSE_MESSAGE,
  UNPARSEABLE_RESPONSE_MESSAGE,
} from './claude.js';
import {
  abortError,
  type FetchOptions,
  type LLMAdapter,
  stripTerminalControls,
} from './provider.js';
import { loadProviderPin } from './provider-pin.js';
import { buildSystemPrompt } from './steering.js';

/**
 * The only host an OpenAI key is ever sent to. A constant: never derived from the pin or
 * the environment, so provider.json cannot redirect the key (T-08-14).
 */
export const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

/** Default model when the pin has no `model` (current per the OpenAI API reference). */
export const OPENAI_DEFAULT_MODEL = 'gpt-5.5';

/** Same budget as Claude and Ollama: zsh reads the FIFO for 30s and the IPC client waits 26s. */
export const OPENAI_TIMEOUT_MS = 25_000;

export function resetOpenAiEffortCache(): void {
  // RED stub: no cache yet.
}

export interface OpenAiSettings {
  model: string;
}

/** Empty or whitespace-only values are missing, so an empty export never blocks ~/.env.local. */
function lookupOpenAiKey(): string | undefined {
  return (
    usableSecret(process.env.OPENAI_API_KEY) ??
    usableSecret(readEnvValueFromDotEnvLocal('OPENAI_API_KEY'))
  );
}

/**
 * Only codes shaped like OpenAI's own (`server_error`, `insufficient_quota`) reach the
 * user. `error.message` is never read: a 401 message can carry a masked key fragment.
 */
const SAFE_ERROR_CODE = /^[a-z0-9_]{1,64}$/;

const SWITCH_HINT = 'run `qq init provider` to switch providers';

/** Printable ASCII with no space: the only bytes a bearer token can carry in a header. */
const HEADER_SAFE_KEY = /^[\x21-\x7e]+$/;

function errorName(error: unknown): string | undefined {
  const name = (error as { name?: unknown } | null)?.name;
  return typeof name === 'string' ? name : undefined;
}

function unexpectedResponse(): Error {
  return new Error('QueQue: OpenAI returned an unexpected response.');
}

/** The pin's model name on one line: the FIFO error is a single shell line. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Reads `error.code` from an error body, keeping it only when it matches SAFE_ERROR_CODE. */
async function readSafeErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { error?: { code?: unknown } } | null;
    const code = body?.error?.code;
    return typeof code === 'string' && SAFE_ERROR_CODE.test(code) ? code : undefined;
  } catch {
    return undefined;
  }
}

/** Maps a non-2xx status to one static QueQue line naming the fix. */
function statusFailure(status: number, model: string, code: string | undefined): Error {
  switch (status) {
    case 401:
      return new Error(
        `QueQue: OpenAI rejected OPENAI_API_KEY (HTTP 401). Check the key, or ${SWITCH_HINT}.`,
      );
    case 403:
      return new Error(
        "QueQue: OpenAI refused the request (HTTP 403). Check the key's project access, or run `qq init provider`.",
      );
    case 404:
      return new Error(
        `QueQue: OpenAI model '${oneLine(model)}' is not available to this key (HTTP 404). Set "model" in ~/.config/qq/provider.json, or run \`qq init provider\`.`,
      );
    case 429:
      return new Error(
        `QueQue: OpenAI rate limit or quota reached (HTTP 429). Try again shortly, or ${SWITCH_HINT}.`,
      );
    default:
      return new Error(
        `QueQue: OpenAI request failed (HTTP ${status}${code ? `, code ${code}` : ''}).`,
      );
  }
}

/**
 * Maps a rejected fetch (or body read) to one static QueQue line. A user abort is
 * rethrown as QueQue's AbortError, unmapped (D-13 cancellation chain).
 */
function mapRequestFailure(
  error: unknown,
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Error {
  if (signal?.aborted) {
    return abortError();
  }
  const name = errorName(error);
  if (name === 'TimeoutError' || name === 'AbortError') {
    const seconds = Math.ceil(timeoutMs / 1000);
    return new Error(`QueQue: OpenAI did not answer within ${seconds}s. Try ?? again.`);
  }
  if (error instanceof TypeError) {
    return new Error(
      `QueQue: could not reach api.openai.com. Check your connection, or ${SWITCH_HINT}.`,
    );
  }
  return new Error('QueQue: OpenAI request failed.');
}

/**
 * Calls OpenAI's POST /v1/chat/completions and returns parsed candidates.
 *
 * The body carries only the model and the shared system (as `developer`) and
 * privacy-filtered user prompts: no sampling, token-limit, streaming or tool fields.
 * Debug lines carry model, status and duration only, never the key, the prompt, or the
 * response. Every failure is one static QueQue-prefixed line built from the status, the
 * model name and a safe `error.code` only, and nothing here falls back to another
 * provider (D-01, D-12). The final list follows finalCandidateListWithoutProse (WR-05)
 * with `finish_reason` `stop` as the only normal stop: neither a cut-off fragment nor a
 * prose-wrapped answer ever becomes a command by itself.
 */
export async function fetchOpenAiCandidates(
  envelope: ContextEnvelope,
  settings: OpenAiSettings,
  timeoutMs: number = OPENAI_TIMEOUT_MS,
  options: FetchOptions = {},
): Promise<CandidateList> {
  const { signal } = options;
  if (signal?.aborted) {
    throw abortError();
  }

  const apiKey = lookupOpenAiKey();
  if (!apiKey) {
    throw new Error(
      'QueQue: OpenAI is pinned but OPENAI_API_KEY is not set for QueQue. Export it (or add it to ~/.env.local), then run `qq init provider` to refresh the background daemon.',
    );
  }

  if (!HEADER_SAFE_KEY.test(apiKey)) {
    // IN-05: fetch would throw a TypeError for the header before any I/O, which reads as
    // "could not reach api.openai.com". The value itself is never echoed.
    throw new Error(
      'QueQue: OPENAI_API_KEY contains invalid characters (spaces, line breaks or non-ASCII). Check the key in your environment or ~/.env.local.',
    );
  }

  const timeout = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const started = Date.now();
  const logRequest = (status: number | null) => {
    void appendDebugLog('provider', 'openai request', {
      model: settings.model,
      status,
      durationMs: Date.now() - started,
    });
  };

  let response: Response;
  try {
    response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'developer', content: buildSystemPrompt(envelope) },
          { role: 'user', content: buildPrompt(envelope) },
        ],
      }),
      signal: requestSignal,
    });
  } catch (error) {
    logRequest(null);
    throw mapRequestFailure(error, timeoutMs, signal);
  }

  logRequest(response.status);

  if (!response.ok) {
    throw statusFailure(response.status, settings.model, await readSafeErrorCode(response));
  }

  let raw: string;
  try {
    raw = await response.text();
  } catch (error) {
    throw mapRequestFailure(error, timeoutMs, signal);
  }

  let body: {
    choices?: Array<{
      message?: { content?: unknown; refusal?: unknown };
      finish_reason?: unknown;
    }>;
  } | null;
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    throw unexpectedResponse();
  }
  const choice = Array.isArray(body?.choices) ? body.choices[0] : undefined;
  const message = choice?.message;
  if (!message || typeof message !== 'object') {
    throw unexpectedResponse();
  }
  const { content, refusal } = message;
  if (typeof content !== 'string') {
    if (typeof refusal === 'string' && refusal.trim() !== '') {
      throw new Error('QueQue: OpenAI declined this query. Rephrase it and press ?? again.');
    }
    throw unexpectedResponse();
  }

  try {
    return ensureSelectableCandidates(
      stripTerminalControls(
        finalCandidateListWithoutProse(content, choice?.finish_reason === 'stop', {
          model: settings.model,
        }),
      ),
    );
  } catch (error) {
    if (error instanceof Error && error.message === TRUNCATED_RESPONSE_MESSAGE) {
      throw new Error(
        'QueQue: OpenAI response was cut off before a full command. Try ?? again, or run `qq init provider` to pick another model.',
      );
    }
    if (error instanceof Error && error.message === UNPARSEABLE_RESPONSE_MESSAGE) {
      throw unexpectedResponse();
    }
    throw error;
  }
}

/**
 * The `openai` registry backend. It runs only for an OpenAI pin and never calls a Claude
 * or Ollama adapter on failure (D-01, D-12).
 */
export const openaiAdapter: LLMAdapter = {
  fetchCandidates(envelope, options) {
    const state = loadProviderPin();
    if (state.kind !== 'pinned' || state.pin.provider !== 'openai') {
      return Promise.reject(
        new Error('QueQue: OpenAI is not the pinned provider. Run `qq init provider`.'),
      );
    }
    return fetchOpenAiCandidates(
      envelope,
      { model: state.pin.model ?? OPENAI_DEFAULT_MODEL },
      OPENAI_TIMEOUT_MS,
      options,
    );
  },
};
