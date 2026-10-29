import type { ProviderKind } from '../contracts/telemetry.js';
import type { ProviderPinState } from './provider-pin.js';

export interface ProviderKindDeps {
  loadPin?: () => ProviderPinState;
  hasApiKey?: () => boolean;
}

export function resolveProviderKind(_deps: ProviderKindDeps = {}): ProviderKind {
  throw new Error('resolveProviderKind is not implemented yet');
}
