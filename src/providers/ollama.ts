import type { CandidateList } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import { appendDebugLog } from '../shared/debug-log.js';
import {
  buildPrompt,
  ensureSelectableCandidates,
  TRUNCATED_RESPONSE_MESSAGE,
  UNPARSEABLE_RESPONSE_MESSAGE,
} from './claude.js';
import {
  abortError,
  type FetchOptions,
  type LLMAdapter,
  replaceUnsafeLineChars,
  stripTerminalControls,
} from './provider.js';
import { loadProviderPin, OLLAMA_DEFAULT_BASE_URL } from './provider-pin.js';
import { buildSystemPrompt } from './steering.js';
import {
  CANDIDATE_LIST_JSON_SCHEMA,
  candidatesWithCutOffRetry,
  type ModelTurn,
} from './structured-output.js';

/** Same budget as Claude: zsh reads the FIFO for 30s and the IPC client waits 26s. */
export const OLLAMA_TIMEOUT_MS = 25_000;

/**
 * Output ceiling (`options.num_predict`), sized to the 25 s budget (WR-15): with
 * `think: false` the whole answer is a few hundred tokens, and no local model writes more
 * than ~2k tokens inside the budget, so a larger cap is never reached before the timeout.
 * (MAX_OUTPUT_TOKENS is for OpenAI, where reasoning tokens count against the cap.)
 */
export const OLLAMA_NUM_PREDICT = 2048;

/**
 * Context window (`options.num_ctx`): OLLAMA_NUM_PREDICT output tokens plus ~6k for the
 * ~4.5k-token prompt (WR-15). Kept small because the KV cache grows with num_ctx (a 20k
 * window costs an 8B model ~2.5 GB more than Ollama's default) and Ollama reloads the model
 * whenever num_ctx differs from the loaded instance, including another client's. It is
 * fixed, not sized per prompt, so QueQue's own requests never force a reload.
 */
export const OLLAMA_NUM_CTX = 8192;

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

/**
 * One line, capped: the FIFO error is a single shell line. Control bytes (C0, DEL, C1) and
 * format characters (bidi overrides, IN-15) become spaces first, so a remote server's
 * `error` text cannot carry terminal escape sequences (WR-04) or reorder the line on the
 * widget's `print -r`.
 */
function oneLine(text: string): string {
  const flat = replaceUnsafeLineChars(text).replace(/\s+/g, ' ').trim();
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

/**
 * Joins an Ollama API path onto `baseUrl`, keeping the base's own path (WR-06): a
 * reverse-proxied `https://gpu.lan/ollama` becomes `https://gpu.lan/ollama/api/chat`, not
 * `https://gpu.lan/api/chat` (an absolute `/api/chat` would drop the prefix).
 *
 * The URL is built from its parts (IN-11): appending `/` to the whole string would put it
 * inside a query or fragment (`…/ollama?x=1/`), and the relative join would then drop
 * the last path segment. A query or fragment in `baseUrl` is not sent.
 */
export function ollamaApiUrl(baseUrl: string, path: 'api/chat' | 'api/tags'): URL {
  const url = new URL(baseUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/${path}`;
  url.search = '';
  url.hash = '';
  return url;
}

/** The body's non-empty `error` string, or undefined (not JSON, or no such field). */
async function readErrorField(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { error?: unknown } | null;
    if (typeof body?.error === 'string' && body.error.trim() !== '') {
      return body.error;
    }
  } catch {
    // Not JSON.
  }
  return undefined;
}

async function readErrorDetail(response: Response): Promise<string> {
  const error = await readErrorField(response);
  if (error !== undefined) {
    return oneLine(error);
  }
  return oneLine(response.statusText) || 'no detail';
}

/**
 * Calls Ollama's POST {baseUrl}/api/chat (non-streaming) and returns parsed candidates.
 *
 * The body carries the model, `stream: false`, `think: false` (no thinking output when the
 * model allows it), `format` (CANDIDATE_LIST_JSON_SCHEMA, the same array the system prompt
 * asks for), `options` (OLLAMA_NUM_PREDICT output tokens in an OLLAMA_NUM_CTX window), and
 * the shared system and privacy-filtered user prompts. A reply that was cut off (see
 * candidatesWithCutOffRetry) is re-sent once, silently, with the same body on the same
 * signal, so the whole call stays inside one `timeoutMs` budget; only a second cut-off
 * shows the "cut off" line. No Authorization header is sent. Each `ollama request` debug
 * line carries model, status and duration only, never the prompt or the response. Error messages name the server's origin (scheme, host and port: never the
 * path, query or credentials) so the user can act on them, and the daemon logs each error
 * message in its `replied fetch-error` line, so that origin can appear in the debug log
 * (IN-04).
 *
 * Every failure is one QueQue-prefixed line naming the fix; nothing here falls back to
 * another provider (D-01, D-12). Every reply goes through finalCandidateListWithoutProse
 * (WR-05), the hidden safety net: the model's text never becomes a command by itself,
 * whether it was cut off (`done_reason` other than `stop`) or wrapped the array in prose or
 * a `<think>` block.
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

  const url = ollamaApiUrl(settings.baseUrl, 'api/chat');
  const { origin } = url;
  const timeout = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const requestBody = JSON.stringify({
    model: settings.model,
    stream: false,
    think: false,
    format: CANDIDATE_LIST_JSON_SCHEMA,
    options: { num_predict: OLLAMA_NUM_PREDICT, num_ctx: OLLAMA_NUM_CTX },
    messages: [
      { role: 'system', content: buildSystemPrompt(envelope) },
      { role: 'user', content: buildPrompt(envelope) },
    ],
  });

  /** One POST of the same body on the shared signal; every failure is already mapped. */
  const postChat = async (): Promise<ModelTurn> => {
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
        body: requestBody,
        signal: requestSignal,
      });
    } catch (error) {
      logRequest(null);
      throw mapRequestFailure(error, origin, timeoutMs, signal);
    }

    logRequest(response.status);

    if (response.status === 404) {
      // WR-06: only Ollama's own "model … not found" body means the model is missing; any
      // other 404 (a proxy, or a wrong baseUrl path) points at the URL instead.
      const error = await readErrorField(response);
      if (error !== undefined && /\bmodel\b/i.test(error)) {
        throw new Error(
          `QueQue: Ollama model '${settings.model}' is not installed. Run \`ollama pull ${settings.model}\`, or run \`qq init provider\` to pick another model.`,
        );
      }
      throw new Error(
        `QueQue: Ollama returned HTTP 404 from ${origin}. Check "baseUrl" in provider.json, or run \`qq init provider\`.`,
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
    return { content, finishedNormally: body.done_reason === 'stop' };
  };

  const first = await postChat();
  try {
    return ensureSelectableCandidates(
      stripTerminalControls(
        await candidatesWithCutOffRetry(first, postChat, { model: settings.model }),
      ),
    );
  } catch (error) {
    if (error instanceof Error && error.message === TRUNCATED_RESPONSE_MESSAGE) {
      throw new Error(
        'QueQue: Ollama response was cut off before a full command. Try ?? again, or run `qq init provider` to pick another model.',
      );
    }
    if (error instanceof Error && error.message === UNPARSEABLE_RESPONSE_MESSAGE) {
      throw unexpectedResponse();
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

/** Budget for the picker's one GET /api/tags (it must not eat the 60s setup budget). */
export const OLLAMA_LIST_TIMEOUT_MS = 2000;

export type OllamaModelList =
  | { ok: true; models: string[] }
  | { ok: false; reason: 'unreachable' | 'http'; status?: number };

/** Terminal control bytes (C0, DEL, C1): a listed name is printed on the user's tty. */
const CONTROL_BYTES = /[\p{Cc}]/u;

/** A model name the pin schema accepts and that is safe to print on a terminal. */
function listableModelName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 200 &&
    !CONTROL_BYTES.test(value)
  );
}

/**
 * Lists the locally installed models for `qq init provider` via GET {baseUrl}/api/tags,
 * in the server's order. Never throws: a refused connection or a timeout is
 * `unreachable`; a non-2xx status or a body that is not an Ollama tag list is `http`.
 */
export async function listOllamaModels(
  baseUrl: string = OLLAMA_DEFAULT_BASE_URL,
  timeoutMs: number = OLLAMA_LIST_TIMEOUT_MS,
): Promise<OllamaModelList> {
  const signal = AbortSignal.timeout(timeoutMs);
  let response: Response;
  try {
    response = await fetch(ollamaApiUrl(baseUrl, 'api/tags'), { signal });
  } catch {
    return { ok: false, reason: 'unreachable' };
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    return { ok: false, reason: 'http', status: response.status };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return signal.aborted
      ? { ok: false, reason: 'unreachable' }
      : { ok: false, reason: 'http', status: response.status };
  }

  const models = (body as { models?: unknown } | null)?.models;
  if (!Array.isArray(models)) {
    return { ok: false, reason: 'http', status: response.status };
  }
  const names = models
    .map((entry) => (entry as { name?: unknown } | null)?.name)
    .filter(listableModelName);
  return { ok: true, models: names };
}
