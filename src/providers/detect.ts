import { execSync } from 'node:child_process';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import { readEnvValueFromDotEnvLocal } from '../shared/env-file.js';

export type DetectedProvider =
  | { kind: 'anthropic-key' }
  | { kind: 'claude-cli' }
  | { kind: 'ollama'; baseUrl: string }
  | { kind: 'openai-key' }
  | { kind: 'none'; message: string };

function claudeOnPath(): boolean {
  try {
    execSync('which claude', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function claudeAuthFileExists(): Promise<boolean> {
  const home = os.homedir();
  const candidates = [`${home}/.claude/.credentials.json`, `${home}/.claude/credentials.json`];
  for (const p of candidates) {
    try {
      await fsp.stat(p);
      return true;
    } catch {
      // file not found — try next
    }
  }
  return false;
}

async function ollamaHealthy(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(300),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function detectProvider(): Promise<DetectedProvider> {
  // Step 1 — Anthropic key: env var OR .env.local (searched from process.cwd())
  if (process.env.ANTHROPIC_API_KEY || readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY')) {
    return { kind: 'anthropic-key' };
  }

  // Step 2 — Claude CLI: binary on PATH + auth file present
  if (claudeOnPath() && (await claudeAuthFileExists())) {
    return { kind: 'claude-cli' };
  }

  // Step 3 — Ollama health check
  if (await ollamaHealthy()) {
    return { kind: 'ollama', baseUrl: 'http://localhost:11434' };
  }

  // Step 4 — OpenAI key env
  if (process.env.OPENAI_API_KEY) {
    return { kind: 'openai-key' };
  }

  // Step 5 — nothing found; message lists every checked source so the fix is obvious
  return {
    kind: 'none',
    message:
      'queque: no AI provider configured\n' +
      'Checked (in order):\n' +
      '  1. ANTHROPIC_API_KEY env var or .env.local\n' +
      '  2. Claude CLI (claude on PATH + credentials file)\n' +
      '  3. Ollama at http://localhost:11434\n' +
      '  4. OPENAI_API_KEY env var\n' +
      'Set one of the above and re-trigger ??',
  };
}
