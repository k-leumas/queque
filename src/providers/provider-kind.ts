import type { ProviderKind } from '../contracts/telemetry.js';
import { lookupApiKey } from './claude-default.js';
import { loadProviderPin, type ProviderPinState } from './provider-pin.js';

/**
 * The provider kind for telemetry (phase 10, D-10).
 *
 * OpenAI and Ollama come from the pin. A Claude pin or no pin goes to the Claude-default
 * composite, which takes the SDK path when `lookupApiKey()` finds a key and the `claude`
 * CLI otherwise; this applies the same rule. An invalid pin, or any failure, is `unknown`.
 * The key is only tested for presence: it is never returned, stored or logged.
 */

export interface ProviderKindDeps {
  loadPin?: () => ProviderPinState;
  hasApiKey?: () => boolean;
}

export function resolveProviderKind(deps: ProviderKindDeps = {}): ProviderKind {
  const loadPin = deps.loadPin ?? loadProviderPin;
  const hasApiKey = deps.hasApiKey ?? (() => lookupApiKey() !== undefined);
  try {
    const state = loadPin();
    if (state.kind === 'invalid') {
      return 'unknown';
    }
    if (state.kind === 'pinned' && state.pin.provider !== 'claude') {
      return state.pin.provider;
    }
    return hasApiKey() ? 'claude-sdk' : 'claude-cli';
  } catch {
    return 'unknown';
  }
}
