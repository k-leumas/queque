import { getProviderAdapter } from '../registry/provider-backends.js';
import type { DetectedProvider } from './detect.js';
import type { LLMAdapter } from './provider.js';

const MISSING_ADAPTER_MESSAGE =
  'QueQue: Claude provider is not registered — was bootstrapBuiltins() called?';

/**
 * Returns the Claude-default composite registered as `claude-cli`.
 *
 * Production fetch goes through this adapter (SDK-first when a key exists,
 * otherwise `claude -p` for `/login`).
 * Throws if `bootstrapBuiltins()` was not called.
 */
export function resolveClaudeDefaultAdapter(): LLMAdapter {
  const adapter = getProviderAdapter('claude-cli');
  if (!adapter) {
    throw new Error(MISSING_ADAPTER_MESSAGE);
  }
  return adapter;
}

/**
 * Maps a leftover `DetectedProvider` (preflight output) to the Claude default.
 *
 * Detection never selects a backend (D-01, D-11): every kind, including `ollama`
 * and `openai-key`, returns the Claude default, and this function never reads
 * provider.json. The runtime selector is `resolveProviderAdapter()` in
 * src/providers/provider-pin.ts, which honors ~/.config/qq/provider.json.
 */
export function resolveAdapter(detected: DetectedProvider): LLMAdapter {
  switch (detected.kind) {
    case 'anthropic-key':
    case 'claude-cli':
    case 'ollama':
    case 'openai-key':
    case 'none':
      return resolveClaudeDefaultAdapter();
  }
}
