import { execSync } from 'node:child_process';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';

export type DetectedProvider =
  | { kind: 'anthropic-key' }
  | { kind: 'claude-cli' }
  | { kind: 'ollama'; baseUrl: string }
  | { kind: 'openai-key' }
  | { kind: 'none' };

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
  // Step 1 — Anthropic key env
  if (process.env.ANTHROPIC_API_KEY) {
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

  // Step 5 — nothing found
  return { kind: 'none' };
}
