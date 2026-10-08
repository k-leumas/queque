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
 * Maps a detected provider kind to a registered LLMAdapter instance.
 *
 * 08-02 bridge: `none` / `ollama` / `openai-key` also return the Claude default
 * until 08-03 reads `~/.config/qq/provider.json`. This is not a shipped pin
 * and does not run a provider wizard.
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
