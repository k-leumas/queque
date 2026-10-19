import type { CandidateList } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { readEnvValueFromDotEnvLocal, usableSecret } from '../shared/env-file.js';
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
  stripTerminalControls,
} from './provider.js';
import { loadProviderPin } from './provider-pin.js';
import { buildSystemPrompt } from './steering.js';
import {
  candidatesWithCutOffRetry,
  MAX_OUTPUT_TOKENS,
  type ModelTurn,
  WRAPPED_CANDIDATE_LIST_JSON_SCHEMA,
} from './structured-output.js';

/**
 * The only host an OpenAI key is ever sent to. A constant: never derived from the pin or
 * the environment, so provider.json cannot redirect the key (T-08-14).
 */
export const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

/** Default model when the pin has no `model` (current per the OpenAI API reference). */
export const OPENAI_DEFAULT_MODEL = 'gpt-5.5';

/** Same budget as Claude and Ollama: zsh reads the FIFO for 30s and the IPC client waits 26s. */
export const OPENAI_TIMEOUT_MS = 25_000;

/** `reasoning_effort` on the first request: little thinking, so the answer fits the cap. */
export const OPENAI_REASONING_EFFORT = 'low';

/**
 * `reasoning_effort` values the cut-off retry tries, lowest first. Not every model accepts
 * every value; a rejected one moves on to the next, and the last resort omits the field.
 */
export const OPENAI_RETRY_REASONING_EFFORTS = ['none', 'minimal', 'low'] as const;

/** The `json_schema.name` of the strict structured-output response format. */
export const OPENAI_RESPONSE_FORMAT_NAME = 'command_candidates';

type ReasoningEffort = (typeof OPENAI_RETRY_REASONING_EFFORTS)[number];

/**
 * Models that rejected OPENAI_REASONING_EFFORT in this process, so the long-lived daemon
 * skips the known-failing first request. Holds model names only, never keys or prompts.
 */
const modelsRejectingDefaultEffort = new Set<string>();

/**
 * Models that rejected the strict `json_schema` response format in this process (WR-14),
 * so later requests go without it. Holds model names only, never keys or prompts.
 */
const modelsRejectingSchema = new Set<string>();

/** Forgets every remembered effort and response-format rejection (tests). */
export function resetOpenAiEffortCache(): void {
  modelsRejectingDefaultEffort.clear();
  modelsRejectingSchema.clear();
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

/** A refusal or a `content_filter` finish (IN-17): the query, not the model, is the problem. */
function declinedQuery(): Error {
  return new Error('QueQue: OpenAI declined this query. Rephrase it and press ?? again.');
}

/** The pin's model name on one line: the FIFO error is a single shell line. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

interface SafeErrorFields {
  /** `error.code`, kept only when it matches SAFE_ERROR_CODE. */
  code: string | undefined;
  /** True when `error.param` names `reasoning_effort` (the model rejects that value). */
  rejectsReasoningEffort: boolean;
  /**
   * True when `error.param` names `response_format` or a field under it (the model does not
   * accept the strict json_schema, or the endpoint refuses a schema keyword).
   */
  rejectsResponseFormat: boolean;
}

/** Reads only `error.code` and `error.param` from an error body, never `error.message`. */
async function readSafeErrorFields(response: Response): Promise<SafeErrorFields> {
  try {
    const body = (await response.json()) as {
      error?: { code?: unknown; param?: unknown };
    } | null;
    const code = body?.error?.code;
    const param = body?.error?.param;
    return {
      code: typeof code === 'string' && SAFE_ERROR_CODE.test(code) ? code : undefined,
      rejectsReasoningEffort: param === 'reasoning_effort',
      rejectsResponseFormat:
        typeof param === 'string' &&
        (param === 'response_format' || param.startsWith('response_format.')),
    };
  } catch {
    return { code: undefined, rejectsReasoningEffort: false, rejectsResponseFormat: false };
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
 * The body carries the model, the shared system (as `developer`) and privacy-filtered user
 * prompts, `max_completion_tokens` (MAX_OUTPUT_TOKENS, reasoning included),
 * `reasoning_effort` OPENAI_REASONING_EFFORT, and a strict `json_schema` response format
 * whose root is `{ "candidates": [...] }`. No sampling, `max_tokens`, streaming or tool
 * fields. When the model answers HTTP 400 for `reasoning_effort`, the request is re-sent
 * without it (and the model is remembered for this process); `error.message` is never read.
 * A 400 for `response_format` (a model without strict structured output, WR-14) is handled
 * the same way: the request is re-sent once without `response_format`, on the same signal,
 * and the model is remembered. finalCandidateListWithoutProse stays the safety net for a
 * reply that was not schema-constrained.
 * A cut-off reply (see candidatesWithCutOffRetry) is re-sent once, silently, on the same
 * signal (one `timeoutMs` budget) at the lowest effort the model accepts
 * (OPENAI_RETRY_REASONING_EFFORTS, then none); only a second cut-off shows the "cut off" line.
 *
 * Debug lines carry model, status and duration (and a rejected effort value) only, never
 * the key, the prompt, or the response. Every failure is one static QueQue-prefixed line
 * built from the status, the model name and a safe `error.code` only, and nothing here
 * falls back to another provider (D-01, D-12). Every reply goes through
 * finalCandidateListWithoutProse (WR-05) with `finish_reason` `stop` as the only normal
 * stop: neither a cut-off fragment nor a prose-wrapped answer ever becomes a command.
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
  const { model } = settings;
  const messages = [
    { role: 'developer', content: buildSystemPrompt(envelope) },
    { role: 'user', content: buildPrompt(envelope) },
  ];
  /** False once this model rejected the strict response format (WR-14). */
  let useSchema = !modelsRejectingSchema.has(model);
  const requestBody = (effort: ReasoningEffort | undefined): string =>
    JSON.stringify({
      model,
      messages,
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      ...(effort === undefined ? {} : { reasoning_effort: effort }),
      ...(useSchema
        ? {
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: OPENAI_RESPONSE_FORMAT_NAME,
                strict: true,
                schema: WRAPPED_CANDIDATE_LIST_JSON_SCHEMA,
              },
            },
          }
        : {}),
    });

  /**
   * One POST on the shared signal. Returns undefined only when the model rejected a
   * defined `effort` (HTTP 400 for `reasoning_effort`); every other failure is mapped and
   * thrown, so a request without `reasoning_effort` always yields a turn or an error.
   */
  const postChat = async (effort: ReasoningEffort | undefined): Promise<ModelTurn | undefined> => {
    const started = Date.now();
    const logRequest = (status: number | null) => {
      void appendDebugLog('provider', 'openai request', {
        model,
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
        body: requestBody(effort),
        signal: requestSignal,
      });
    } catch (error) {
      logRequest(null);
      throw mapRequestFailure(error, timeoutMs, signal);
    }

    logRequest(response.status);

    if (!response.ok) {
      const { code, rejectsReasoningEffort, rejectsResponseFormat } =
        await readSafeErrorFields(response);
      if (response.status === 400 && rejectsReasoningEffort && effort !== undefined) {
        void appendDebugLog('provider', 'openai reasoning_effort rejected', { model, effort });
        return undefined;
      }
      if (response.status === 400 && rejectsResponseFormat && useSchema) {
        // WR-14: re-send this same request without response_format (at most once: useSchema
        // is now false, so a second 400 for it cannot recurse).
        modelsRejectingSchema.add(model);
        useSchema = false;
        void appendDebugLog('provider', 'openai response_format rejected', { model });
        return postChat(effort);
      }
      throw statusFailure(response.status, model, code);
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
    if (choice?.finish_reason === 'content_filter') {
      // IN-17: a filtered answer is a declined query, not a cut-off: no retry, and any
      // partial text is dropped.
      throw declinedQuery();
    }
    const finishedNormally = choice?.finish_reason === 'stop';
    const { content, refusal } = message;
    if (typeof content !== 'string') {
      if (typeof refusal === 'string' && refusal.trim() !== '') {
        throw declinedQuery();
      }
      if (finishedNormally) {
        throw unexpectedResponse();
      }
      // No text before a non-stop finish (all output spent on reasoning): an empty cut-off.
      return { content: '', finishedNormally };
    }
    return { content, finishedNormally };
  };

  /** The first turn over `efforts` (which ends with undefined) and the effort it used. */
  const firstTurn = async (
    efforts: readonly (ReasoningEffort | undefined)[],
  ): Promise<{ turn: ModelTurn; effort: ReasoningEffort | undefined }> => {
    for (const effort of efforts) {
      const turn = await postChat(effort);
      if (turn) {
        return { turn, effort };
      }
    }
    // Unreachable: postChat(undefined) never returns undefined.
    throw unexpectedResponse();
  };

  const knownRejection = modelsRejectingDefaultEffort.has(model);
  const firstEfforts: readonly (ReasoningEffort | undefined)[] = knownRejection
    ? [undefined]
    : [OPENAI_REASONING_EFFORT, undefined];
  const first = await firstTurn(firstEfforts);
  if (first.effort === undefined && firstEfforts[0] === OPENAI_REASONING_EFFORT) {
    modelsRejectingDefaultEffort.add(model);
  }
  // A model that rejects `low` is not expected to accept a lower value: retry without one.
  const retryEfforts: readonly (ReasoningEffort | undefined)[] =
    first.effort === OPENAI_REASONING_EFFORT
      ? [...OPENAI_RETRY_REASONING_EFFORTS, undefined]
      : [undefined];
  const retry = async (): Promise<ModelTurn> => (await firstTurn(retryEfforts)).turn;

  try {
    return ensureSelectableCandidates(
      stripTerminalControls(await candidatesWithCutOffRetry(first.turn, retry, { model }, timeout)),
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
