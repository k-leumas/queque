import type { CandidateList } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { buildPrompt, ensureSelectableCandidates, parseCandidates } from './claude.js';
import { abortError, type FetchOptions, type LLMAdapter } from './provider.js';
import { loadProviderPin, OLLAMA_DEFAULT_BASE_URL } from './provider-pin.js';
import { buildSystemPrompt } from './steering.js';

/** Same budget as Claude: zsh reads the FIFO for 30s and the IPC client waits 26s. */
export const OLLAMA_TIMEOUT_MS = 25_000;

export interface OllamaSettings {
  baseUrl: string;
  model: string;
}

/**
 * Calls Ollama's POST {baseUrl}/api/chat (non-streaming) and returns parsed candidates.
 *
 * The body carries only the model, `stream: false`, and the shared system and
 * privacy-filtered user prompts. No Authorization header is sent. Debug lines carry
 * model, status and duration only, never the prompt or the response.
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
  const timeout = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const started = Date.now();

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
  } catch {
    void appendDebugLog('provider', 'ollama request', {
      model: settings.model,
      status: null,
      durationMs: Date.now() - started,
    });
    if (signal?.aborted) {
      throw abortError();
    }
    throw new Error('QueQue: Ollama request failed');
  }

  void appendDebugLog('provider', 'ollama request', {
    model: settings.model,
    status: response.status,
    durationMs: Date.now() - started,
  });

  if (!response.ok) {
    throw new Error(`QueQue: Ollama request failed (HTTP ${response.status})`);
  }

  const body = (await response.json()) as { message?: { content?: unknown } };
  const content = body.message?.content;
  if (typeof content !== 'string') {
    throw new Error('QueQue: Ollama request failed');
  }
  return ensureSelectableCandidates(parseCandidates(content));
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
