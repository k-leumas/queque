import type { CandidateList } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import {
  buildPrompt,
  ensureSelectableCandidates,
  parseCandidates,
  QUEQUE_SYSTEM,
} from './claude.js';
import { type ExecFileAsyncOptions, execFileAsync } from './claude-exec.js';
import type { LLMAdapter } from './provider.js';

const CLI_BUDGET_MS = 25_000;

/**
 * Spawns `claude -p` print mode and parses stdout with the shared candidate contract.
 * Throws on spawn, non-zero, or timeout. Does not rescue via the SDK.
 */
export async function fetchClaudeCliCandidates(
  envelope: ContextEnvelope,
  remainingBudgetMs: number,
): Promise<CandidateList> {
  const prompt = buildPrompt(envelope);
  const args = [
    '-p',
    '--output-format',
    'text',
    '--safe-mode',
    '--tools',
    '',
    '--no-session-persistence',
    '--system-prompt',
    QUEQUE_SYSTEM,
    prompt,
  ];
  const options: ExecFileAsyncOptions = {
    encoding: 'utf8',
    timeout: remainingBudgetMs,
    killSignal: 'SIGTERM',
    maxBuffer: 1024 * 1024,
    cwd: envelope.base.cwd,
    env: process.env,
    windowsHide: true,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  };

  const { stdout } = await execFileAsync('claude', args, options);
  return ensureSelectableCandidates(parseCandidates(stdout));
}

/**
 * Raw CLI-only adapter. Unregistered — isolation and tests only.
 */
export const claudeCliAdapter: LLMAdapter = {
  async fetchCandidates(envelope: ContextEnvelope): Promise<CandidateList> {
    return fetchClaudeCliCandidates(envelope, CLI_BUDGET_MS);
  },
};
