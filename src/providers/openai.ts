import type { CandidateList } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { readEnvValueFromDotEnvLocal, usableSecret } from '../shared/env-file.js';
import {
  buildPrompt,
  ensureSelectableCandidates,
  finalCandidateList,
  TRUNCATED_RESPONSE_MESSAGE,
} from './claude.js';
import { abortError, type FetchOptions, type LLMAdapter } from './provider.js';
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

export interface OpenAiSettings {
  model: string;
}

/** Empty or whitespace-only values are missing, so an empty export never blocks .env.local. */
function lookupOpenAiKey(): string | undefined {
  return (
    usableSecret(process.env.OPENAI_API_KEY) ??
    usableSecret(readEnvValueFromDotEnvLocal('OPENAI_API_KEY'))
  );
}

function requestFailed(): Error {
  return new Error('QueQue: OpenAI request failed.');
}

/**
 * Calls OpenAI's POST /v1/chat/completions and returns parsed candidates.
 *
 * The body carries only the model and the shared system (as `developer`) and
 * privacy-filtered user prompts: no sampling, token-limit, streaming or tool fields.
 * Debug lines carry model, status and duration only, never the key, the prompt, or the
 * response. Nothing here falls back to another provider (D-01, D-12).
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
      'QueQue: OpenAI is pinned but OPENAI_API_KEY is not set for QueQue. Export it (or add it to .env.local), then run `qq init provider` to refresh the background daemon.',
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
  } catch {
    logRequest(null);
    if (signal?.aborted) {
      throw abortError();
    }
    throw requestFailed();
  }

  logRequest(response.status);

  if (!response.ok) {
    throw requestFailed();
  }

  let body: {
    choices?: Array<{ message?: { content?: unknown }; finish_reason?: unknown }>;
  };
  try {
    body = JSON.parse(await response.text()) as typeof body;
  } catch {
    throw requestFailed();
  }
  const choice = body?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content !== 'string') {
    throw requestFailed();
  }

  try {
    return ensureSelectableCandidates(
      finalCandidateList(content, [], choice?.finish_reason === 'stop', {
        model: settings.model,
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === TRUNCATED_RESPONSE_MESSAGE) {
      throw new Error(
        'QueQue: OpenAI response was cut off before a full command. Try ?? again, or run `qq init provider` to pick another model.',
      );
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
