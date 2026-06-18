import { getProviderAdapter } from '../registry/provider-backends.js';
import type { DetectedProvider } from './detect.js';
import type { LLMAdapter } from './provider.js';

/**
 * Maps a detected provider kind to a registered LLMAdapter instance.
 * Phase 8 adds subprocess adapters for claude-cli, ollama, and openai-key.
 */
export function resolveAdapter(detected: DetectedProvider): LLMAdapter {
  switch (detected.kind) {
    case 'anthropic-key': {
      const adapter = getProviderAdapter('claude');
      if (!adapter) {
        throw new Error('QueQue: Claude provider is not registered — run qq daemon restart');
      }
      return adapter;
    }
    case 'claude-cli':
      throw new Error(
        'QueQue: Claude CLI detected but subprocess adapter is not wired yet (Phase 8). Set ANTHROPIC_API_KEY or use .env.local.',
      );
    case 'ollama':
      throw new Error(
        'QueQue: Ollama detected but local adapter is not wired yet (Phase 8). Set ANTHROPIC_API_KEY or use .env.local.',
      );
    case 'openai-key':
      throw new Error(
        'QueQue: OPENAI_API_KEY detected but OpenAI adapter is not wired yet (Phase 8). Set ANTHROPIC_API_KEY for Claude.',
      );
    case 'none':
      throw new Error(detected.message);
  }
}
