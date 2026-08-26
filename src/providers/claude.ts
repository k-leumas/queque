import Anthropic from '@anthropic-ai/sdk';
import { type CandidateList, candidateListSchema } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { readEnvValueFromDotEnvLocal } from '../shared/env-file.js';
import { filterContextEnvelope } from '../shared/privacy-filter.js';
import type { LLMAdapter } from './provider.js';

export const DEFAULT_MODEL = 'claude-sonnet-5';

/**
 * Shared system prompt for the SDK Messages API and Claude CLI `--system-prompt`.
 */
export const QUEQUE_SYSTEM =
  'You are QueQue, a terminal shell assistant. Return ONLY a JSON array of command candidates, ranked with the most correct/direct command first. No prose, no markdown, no code fences. When a command requires a value the user must supply (hostname, filename, branch name, etc.), wrap it in angle brackets: <placeholder>. Use descriptive names like <user@host>, <filename>, <branch-name>. Do not use angle brackets for optional flags or known values.';

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
 */
export async function fetchCandidates(
  envelope: ContextEnvelope,
  rbuffer: string = '',
  timeoutMs: number = 25_000,
): Promise<CandidateList> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required in the environment or .env.local');
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(envelope);
  const model = resolveModel();

  void appendDebugLog('provider', 'request start', {
    model,
    cwd: envelope.base.cwd,
    rbufferLength: rbuffer.length,
    extras: envelope.extras.map((chunk) => chunk.kind),
  });

  try {
    const response = await client.messages.create(
      {
        model,
        max_tokens: 1024,
        system: QUEQUE_SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      },
      {
        timeout: timeoutMs,
      },
    );

    const text = extractText(response.content);
    const candidates = ensureSelectableCandidates(parseCandidates(text));

    void appendDebugLog('provider', 'response parsed', {
      model,
      candidateCount: candidates.length,
      forceSelector: shouldForceSelector(),
    });

    return candidates;
  } catch (error) {
    void appendDebugLog('provider', 'request failed', {
      model,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export const claudeAdapter: LLMAdapter = {
  fetchCandidates,
};
