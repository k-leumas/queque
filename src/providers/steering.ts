import type { ContextEnvelope } from '../contracts/request.js';

/**
 * Shared system prompt for the SDK Messages API and Claude CLI `--system-prompt`.
 */
export const QUEQUE_SYSTEM =
  'You are QueQue, a terminal shell assistant. Return ONLY a JSON array of command candidates, ranked with the most correct/direct command first. No prose, no markdown, no code fences. When a command requires a value the user must supply (hostname, filename, branch name, etc.), wrap it in angle brackets: <placeholder>. Use descriptive names like <user@host>, <filename>, <branch-name>. Do not use angle brackets for optional flags or known values.';

export function buildSteeringText(_tools: readonly string[]): string {
  throw new Error('buildSteeringText: not implemented');
}

export function buildSystemPrompt(_envelope: ContextEnvelope): string {
  throw new Error('buildSystemPrompt: not implemented');
}
