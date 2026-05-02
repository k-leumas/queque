import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { type ShellRequest, type ShellResult, shellResultSchema } from '../contracts/shell.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { readEnvValueFromDotEnvLocal } from '../shared/env-file.js';
import { detectVcsContext } from '../shared/vcs-context.js';

const commandSuggestionSchema = z
  .object({
    command: z.string().min(1),
  })
  .strict();

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

function buildPrompt(
  request: ShellRequest,
  vcsContext: Awaited<ReturnType<typeof detectVcsContext>>,
): string {
  return [
    'Return only valid JSON with this exact shape:',
    '{"command":"shell command"}',
    '',
    'Do not include markdown, prose, code fences, or extra keys.',
    'The command should be safe to place back into a shell buffer.',
    '',
    'Shell context:',
    JSON.stringify(
      {
        cwd: request.cwd,
        lbuffer: request.lbuffer,
        rbuffer: request.rbuffer,
        ttyPath: request.ttyPath,
        versionControl: vcsContext,
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

export async function suggestShellResult(request: ShellRequest): Promise<ShellResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required in the environment or .env.local');
  }

  const client = new Anthropic({ apiKey });
  const vcsContext = await detectVcsContext(request.cwd);
  const prompt = buildPrompt(request, vcsContext);
  const models = await getCandidateModels(client);

  void appendDebugLog('provider', 'request start', {
    models,
    cwd: request.cwd,
    versionControl: vcsContext,
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
      const parsed = commandSuggestionSchema.parse(JSON.parse(text));
      const shellResult = shellResultSchema.parse({
        kind: 'replace-buffer',
        lbuffer: parsed.command,
        rbuffer: request.rbuffer,
      });

      void appendDebugLog('provider', 'response parsed', {
        model,
        command: parsed.command,
      });

      return shellResult;
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
