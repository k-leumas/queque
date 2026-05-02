import Anthropic from '@anthropic-ai/sdk';
import { type CandidateList, candidateListSchema } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import { type ShellResult, shellResultSchema } from '../contracts/shell.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { readEnvValueFromDotEnvLocal } from '../shared/env-file.js';

const DEFAULT_MODEL = 'claude-sonnet-4-0';

const CHEAPEST_FIRST_MODEL_IDS = [
  'claude-3-haiku-20240307',
  'claude-3-5-haiku-20241022',
  'claude-3-7-sonnet-20250219',
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-opus-4-1-20250805',
];

async function listAvailableModelIds(client: Anthropic): Promise<string[]> {
  const modelIds: string[] = [];

  try {
    for await (const model of client.models.list()) {
      modelIds.push(model.id);
    }
  } catch (error) {
    void appendDebugLog('provider', 'model list unavailable; using configured default', {
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  return modelIds;
}

function chooseCheapestAvailableModel(availableModelIds: string[]): string {
  const available = new Set(availableModelIds);

  for (const modelId of CHEAPEST_FIRST_MODEL_IDS) {
    if (available.has(modelId)) {
      return modelId;
    }
  }

  return availableModelIds[0] ?? DEFAULT_MODEL;
}

function extractText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text ?? '')
    .join('')
    .trim();
}

function parseCandidates(text: string): CandidateList {
  try {
    return candidateListSchema.parse(JSON.parse(text));
  } catch {
    const trimmed = text.trim();
    return [{ command: trimmed || 'echo ""', explanation: '' }];
  }
}

function shouldForceSelector(): boolean {
  const configured =
    process.env.QQ_FORCE_SELECTOR ?? readEnvValueFromDotEnvLocal('QQ_FORCE_SELECTOR');
  return configured === '1' || configured === 'true';
}

function ensureSelectableCandidates(candidates: CandidateList): CandidateList {
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

function buildPrompt(envelope: ContextEnvelope): string {
  const gitChunk = envelope.extras.find((chunk) => chunk.kind === 'git');

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
        cwd: envelope.base.cwd,
        queryText: envelope.base.queryText,
        platform: envelope.base.platform,
        shellName: envelope.base.shellName,
        ...(gitChunk ? { versionControl: gitChunk.payload } : {}),
      },
      null,
      2,
    ),
  ].join('\n');
}

async function getCandidateModels(client: Anthropic): Promise<string[]> {
  const configuredModel = process.env.QQ_MODEL ?? readEnvValueFromDotEnvLocal('QQ_MODEL');
  if (configuredModel) {
    return [configuredModel];
  }

  const availableModelIds = await listAvailableModelIds(client);
  return [chooseCheapestAvailableModel(availableModelIds)];
}

/**
 * Calls Claude with the assembled context envelope and returns ranked command candidates.
 *
 * `rbuffer` remains a side parameter because it is shell transport state, not context.
 * The envelope describes the request intent and execution environment, while Phase 4's
 * TUI remains responsible for deciding how the raw shell buffers are rewritten.
 */
export async function fetchCandidates(
  envelope: ContextEnvelope,
  rbuffer: string = '',
): Promise<CandidateList> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required in the environment or .env.local');
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(envelope);
  const models = await getCandidateModels(client);

  void appendDebugLog('provider', 'request start', {
    models,
    cwd: envelope.base.cwd,
    rbufferLength: rbuffer.length,
    extras: envelope.extras.map((chunk) => chunk.kind),
  });

  for (const model of models) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 256,
        temperature: 0,
        system:
          'You are Que-Que, a terminal assistant. Return only JSON matching {"command":"..."} and nothing else.',
        messages: [{ role: 'user', content: prompt }],
      });

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

  throw new Error('Claude request failed');
}

export async function suggestShellResult(
  envelope: ContextEnvelope,
  rbuffer: string = '',
): Promise<ShellResult> {
  const candidates = await fetchCandidates(envelope, rbuffer);
  const command = candidates[0]?.command;

  return shellResultSchema.parse({
    kind: 'replace-buffer',
    lbuffer: command,
    rbuffer,
  });
}
