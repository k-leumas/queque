import type Anthropic from '@anthropic-ai/sdk';
import {
  type CandidateList,
  type CommandCandidate,
  candidateListSchema,
} from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { readEnvValueFromDotEnvLocal, usableSecret } from '../shared/env-file.js';
import { filterContextEnvelope } from '../shared/privacy-filter.js';
import type { Effort } from '../shared/qq-config.js';
import { createCandidateScanner, parseStrictCandidateList } from './candidate-stream.js';
import { abortError, type FetchOptions, isAbortError, type LLMAdapter } from './provider.js';
import { buildSystemPrompt } from './steering.js';

/** Moved to steering.ts in Phase 9; re-exported so existing importers keep compiling. */
export { QUEQUE_SYSTEM } from './steering.js';

export const DEFAULT_MODEL = 'claude-sonnet-5';

let cachedAnthropic: { apiKey: string; client: Anthropic } | undefined;

/**
 * Returns a reused Anthropic SDK client for this process.
 *
 * The constructor is the keep-alive / TLS boundary. Creating a new client on
 * every `??` in a short-lived foreground process cannot warm that. The daemon
 * holds one client so repeat fetches skip handshake setup.
 *
 * The SDK is imported lazily (quick 261011-jbh, LD-2): the client's path to its
 * first frame never evaluates it. The cache is re-checked after the import so
 * concurrent first calls share one client.
 */
export async function getAnthropicClient(apiKey: string): Promise<Anthropic> {
  if (cachedAnthropic?.apiKey === apiKey) {
    return cachedAnthropic.client;
  }
  const { default: AnthropicSdk } = await import('@anthropic-ai/sdk');
  if (cachedAnthropic?.apiKey === apiKey) {
    return cachedAnthropic.client;
  }
  cachedAnthropic = { apiKey, client: new AnthropicSdk({ apiKey }) };
  return cachedAnthropic.client;
}

/**
 * Drops the cached SDK client. Tests call this so constructor assertions stay
 * per-case after a previous fetch reused the module singleton.
 */
export function resetAnthropicClientCache(): void {
  cachedAnthropic = undefined;
}

/** TDD RED stub (09.1-04 Task 2): replaced by the effort guard in GREEN. */
export function sdkOutputConfig(_model: string, _effort: Effort): { effort: Effort } | undefined {
  throw new Error('sdkOutputConfig is not implemented yet');
}

function resolveModel(): string {
  return process.env.QQ_MODEL ?? readEnvValueFromDotEnvLocal('QQ_MODEL') ?? DEFAULT_MODEL;
}

function extractText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text ?? '')
    .join('')
    .trim();
}

function stripCodeFence(raw: string): string {
  const m = raw.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  return m ? m[1].trim() : raw.trim();
}

/**
 * Parses model text into a candidate list, failing closed on unexpected JSON.
 */
export function parseCandidates(text: string): CandidateList {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch {
    // Not JSON at all — treat entire text as a plain command (prose fallback)
    const trimmed = text.trim();
    return [{ command: trimmed || 'echo ""', explanation: '' }];
  }
  // Valid JSON but wrong schema — do not use raw JSON text as a command
  try {
    return candidateListSchema.parse(parsed);
  } catch {
    return [{ command: 'echo ""', explanation: 'QueQue: unexpected response format' }];
  }
}

function shouldForceSelector(): boolean {
  const configured =
    process.env.QQ_FORCE_SELECTOR ?? readEnvValueFromDotEnvLocal('QQ_FORCE_SELECTOR');
  return configured === '1' || configured === 'true';
}

/**
 * Pads a single candidate to two when QQ_FORCE_SELECTOR is enabled.
 */
export function ensureSelectableCandidates(candidates: CandidateList): CandidateList {
  if (!shouldForceSelector() || candidates.length >= 2) {
    return candidates;
  }

  const [first] = candidates;

  return [
    first,
    {
      command: first.command,
      explanation:
        first.explanation.length > 0
          ? `${first.explanation} (forced duplicate for selector testing)`
          : 'Forced duplicate for selector testing.',
    },
  ];
}

/**
 * Builds the privacy-filtered user prompt for both the SDK and CLI adapters.
 */
export function buildPrompt(envelope: ContextEnvelope): string {
  const filtered = filterContextEnvelope(envelope);
  const gitChunk = filtered.extras.find((chunk) => chunk.kind === 'git');
  const filesystemChunk = filtered.extras.find((chunk) => chunk.kind === 'filesystem');

  return [
    'Return ONLY a JSON array of 1-3 shell command candidates, most likely first.',
    'Each item must have exactly these keys: "command" and "explanation".',
    'No markdown, no prose, no code fences. Raw JSON array only.',
    '',
    'The command should be safe to place back into a shell buffer.',
    '',
    'Shell context:',
    JSON.stringify(
      {
        cwd: filtered.base.cwd,
        queryText: filtered.base.queryText,
        platform: filtered.base.platform,
        shellName: filtered.base.shellName,
        ...(gitChunk ? { versionControl: gitChunk.payload } : {}),
        ...(filesystemChunk ? { filesystem: filesystemChunk.payload } : {}),
      },
      null,
      2,
    ),
  ].join('\n');
}

/**
 * Calls Claude with the assembled context envelope and returns ranked command candidates.
 *
 * `rbuffer` remains a side parameter because it is shell transport state, not context.
 * Optional `timeoutMs` defaults to 25000 so SDK rescue can pass remaining budget.
 * The envelope describes the request intent and execution environment, while Phase 4's
 * TUI remains responsible for deciding how the raw shell buffers are rewritten.
 *
 * The request streams (`messages.stream` + `finalMessage()`, Phase 09.1): `options.signal`
 * travels in the request options, so an abort cancels the HTTP request and rejects with an
 * AbortError (D-13); a raw streaming iterator is not used because it ends silently on abort.
 * With `options.onCandidate`, each candidate is scanned out of the streamed text and handed
 * over as soon as its object closes, never after the signal aborts (D-05). The final list
 * is the strict parse of the final text; if that fails after rows streamed, the streamed
 * (already validated) rows; only when nothing streamed, parseCandidates' fallback.
 */
export async function fetchCandidates(
  envelope: ContextEnvelope,
  rbuffer: string = '',
  timeoutMs: number = 25_000,
  options: FetchOptions = {},
): Promise<CandidateList> {
  const apiKey =
    usableSecret(process.env.ANTHROPIC_API_KEY) ??
    usableSecret(readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY'));
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required in the environment or .env.local');
  }

  const client = await getAnthropicClient(apiKey);
  const prompt = buildPrompt(envelope);
  const model = resolveModel();

  void appendDebugLog('provider', 'request start', {
    model,
    cwd: envelope.base.cwd,
    rbufferLength: rbuffer.length,
    extras: envelope.extras.map((chunk) => chunk.kind),
  });

  const { onCandidate, signal } = options;
  const streamed: CommandCandidate[] = [];

  try {
    const stream = client.messages.stream(
      {
        model,
        max_tokens: 1024,
        system: buildSystemPrompt(envelope),
        messages: [{ role: 'user', content: prompt }],
      },
      { timeout: timeoutMs, signal: options.signal },
    );

    if (onCandidate) {
      const scan = createCandidateScanner((candidate) => {
        streamed.push(candidate);
        if (!signal?.aborted) {
          onCandidate(candidate);
        }
      });
      stream.on('text', (textDelta) => {
        scan(textDelta);
      });
    }

    const message = await stream.finalMessage();
    const text = extractText(message.content);
    const finalList =
      parseStrictCandidateList(text) ?? (streamed.length > 0 ? streamed : parseCandidates(text));
    const candidates = ensureSelectableCandidates(finalList);

    void appendDebugLog('provider', 'response parsed', {
      model,
      candidateCount: candidates.length,
      streamedCount: streamed.length,
      forceSelector: shouldForceSelector(),
    });

    return candidates;
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) {
      // D-13: an aborted request is not a failure; the daemon writes nothing for it.
      void appendDebugLog('provider', 'request aborted', { model });
      throw abortError();
    }
    void appendDebugLog('provider', 'request failed', {
      model,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Options always travel in the fourth slot, never in `rbuffer`, so the registered `claude`
// backend forwards the abort signal and onCandidate to the streamed SDK request.
export const claudeAdapter: LLMAdapter = {
  fetchCandidates: (envelope, options) => fetchCandidates(envelope, '', 25_000, options),
};
