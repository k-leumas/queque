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
import { type Effort, resolveEffort } from '../shared/qq-config.js';
import { createCandidateScanner, parseStrictCandidateList } from './candidate-stream.js';
import {
  abortError,
  type FetchOptions,
  isAbortError,
  isNormalStopReason,
  type LLMAdapter,
} from './provider.js';
import { buildSystemPrompt } from './steering.js';

/** Moved to steering.ts in Phase 9; re-exported so existing importers keep compiling. */
export { QUEQUE_SYSTEM } from './steering.js';

export const DEFAULT_MODEL = 'claude-sonnet-5';

/**
 * Output ceiling for the SDK request. Thinking stays adaptive by omission, and thinking
 * tokens count against `max_tokens`, so at effort `high`, `xhigh` or `max` a 1024 ceiling
 * could end the visible answer before the first candidate closed (review WR-07). It is a
 * ceiling only: a normal 1-3 candidate answer stops long before it, and the request
 * streams, so a large value risks no HTTP timeout.
 */
export const SDK_MAX_TOKENS = 16_000;

/**
 * The error for a response that stopped for any reason other than `end_turn` or
 * `stop_sequence` with no complete candidate in it (WR-07, WR-01-r2).
 */
export const TRUNCATED_RESPONSE_MESSAGE = 'QueQue: Claude response was truncated';

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

/**
 * Model ids that reject the `output_config.effort` parameter (400): every Haiku, Sonnet 4.5,
 * the Claude 3.x ids, and the 4.0/4.1 ids including the dated `sonnet-4-2025…` and
 * `opus-4-2025…` forms. Newer ids (Sonnet 5, Opus 4.5 and later) accept effort.
 */
export const EFFORT_UNSUPPORTED_MODEL_RE =
  /haiku|claude-3|sonnet-4-5(?!\d)|(?:sonnet|opus)-4-(?:0|1|2025\d*)(?!\d)/i;

/**
 * The SDK `output_config` for the configured effort (D-03), or undefined when `model`
 * rejects effort (EFFORT_UNSUPPORTED_MODEL_RE), so a QQ_MODEL override never 400s on it.
 * Thinking stays adaptive by omission; no sampling parameters are ever sent.
 */
export function sdkOutputConfig(model: string, effort: Effort): { effort: Effort } | undefined {
  if (EFFORT_UNSUPPORTED_MODEL_RE.test(model)) {
    return undefined;
  }
  return { effort };
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

/** The candidate objects that closed in `text`, scanned like a stream (no prose fallback). */
function completeCandidates(text: string): CommandCandidate[] {
  const rows: CommandCandidate[] = [];
  createCandidateScanner((candidate) => {
    rows.push(candidate);
  })(text);
  return rows;
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

/**
 * The one final-list rule for the SDK and `claude -p` paths (WR-01-r2, T-09.1-14).
 *
 * The strict parse of the final text wins; then the streamed (already validated) rows.
 * When neither gives a row and the answer did not finish normally (see
 * isNormalStopReason), only the candidate objects that closed in the text are kept, and
 * with none it logs `response truncated` (with `logFields`, never the text) and throws
 * TRUNCATED_RESPONSE_MESSAGE. parseCandidates' prose fallback is reached only after a
 * normal stop, so a cut-off fragment never becomes a command.
 */
export function finalCandidateList(
  text: string,
  streamed: CommandCandidate[],
  finishedNormally: boolean,
  logFields: Record<string, unknown> = {},
): CandidateList {
  const strict = parseStrictCandidateList(text);
  if (strict) {
    return strict;
  }
  if (streamed.length > 0) {
    return streamed;
  }
  if (!finishedNormally) {
    const complete = completeCandidates(text);
    if (complete.length === 0) {
      void appendDebugLog('provider', 'response truncated', logFields);
      throw new Error(TRUNCATED_RESPONSE_MESSAGE);
    }
    return complete;
  }
  return parseCandidates(text);
}

/** Thrown by finalCandidateListWithoutProse when no candidate can be read from the text. */
export const UNPARSEABLE_RESPONSE_MESSAGE = 'QueQue: response held no command candidates';

/** A `<think>` block, or an unclosed one through to the end of the text. */
const THINK_BLOCK_RE = /<think>[\s\S]*?(?:<\/think>|$)/gi;

const THINK_CLOSE = '</think>';

/**
 * The answer part of a local reasoning model's text (WR-09). Only the text after the last
 * `</think>` is kept, because some chat templates put `<think>` in the prompt and the
 * output then starts inside the thinking with only the closing tag. A `<think>` with no
 * `</think>` after it (a cut-off answer) is dropped through to the end, so a draft array
 * inside unfinished thinking never becomes a command.
 */
export function stripThinking(text: string): string {
  const close = text.toLowerCase().lastIndexOf(THINK_CLOSE);
  const afterClose = close === -1 ? text : text.slice(close + THINK_CLOSE.length);
  return afterClose.replace(THINK_BLOCK_RE, ' ');
}

/**
 * The final-list rule for the Ollama and OpenAI adapters (WR-05). Their models do not
 * reliably follow "raw JSON array only": they wrap the array in prose ("Here are some
 * commands: ```json …```"), print a `<think>` block first, or add a comment after it.
 * parseCandidates' prose fallback would turn that whole text into one multi-line
 * "command", so it is never used here.
 *
 * Order: the strict parse of the text after stripThinking, then the candidate objects
 * that closed inside the first `[ {` array in it. With none, a cut-off answer throws
 * TRUNCATED_RESPONSE_MESSAGE and a normal stop throws UNPARSEABLE_RESPONSE_MESSAGE (both
 * logged with `logFields` only, never the text). The raw text never becomes a candidate.
 */
export function finalCandidateListWithoutProse(
  text: string,
  finishedNormally: boolean,
  logFields: Record<string, unknown> = {},
): CandidateList {
  const answer = stripThinking(text);
  const strict = parseStrictCandidateList(answer);
  if (strict) {
    return strict;
  }
  const arrayStart = answer.search(/\[\s*\{/);
  const closed = arrayStart === -1 ? [] : completeCandidates(answer.slice(arrayStart));
  if (closed.length > 0) {
    return closed;
  }
  if (!finishedNormally) {
    void appendDebugLog('provider', 'response truncated', logFields);
    throw new Error(TRUNCATED_RESPONSE_MESSAGE);
  }
  void appendDebugLog('provider', 'response unparseable', logFields);
  throw new Error(UNPARSEABLE_RESPONSE_MESSAGE);
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
 * comes from finalCandidateList: the strict parse of the final text; if that fails after
 * rows streamed, the streamed (already validated) rows; when nothing streamed,
 * parseCandidates' fallback only after a normal stop (end_turn or stop_sequence), else the
 * closed rows or TRUNCATED_RESPONSE_MESSAGE (WR-01-r2).
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
    throw new Error('ANTHROPIC_API_KEY is required in the environment or ~/.env.local');
  }

  const client = await getAnthropicClient(apiKey);
  const prompt = buildPrompt(envelope);
  const model = resolveModel();
  const outputConfig = sdkOutputConfig(model, resolveEffort());

  void appendDebugLog('provider', 'request start', {
    model,
    effort: outputConfig?.effort ?? 'none',
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
        max_tokens: SDK_MAX_TOKENS,
        system: buildSystemPrompt(envelope),
        messages: [{ role: 'user', content: prompt }],
        ...(outputConfig ? { output_config: outputConfig } : {}),
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
    // Only end_turn and stop_sequence reach the prose fallback (WR-07, WR-01-r2): any other
    // stop keeps the rows that closed, or fails closed.
    const finalList = finalCandidateList(text, streamed, isNormalStopReason(message.stop_reason), {
      model,
      stopReason: message.stop_reason,
    });
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
