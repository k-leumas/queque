import type { LLMAdapter } from '../providers/provider.js';

export interface ProviderBackendDescriptor {
  id: string;
  name: string;
  description: string;
}

export interface RegisteredProviderBackend extends ProviderBackendDescriptor {
  adapter: LLMAdapter;
}

const registry = new Map<string, RegisteredProviderBackend>();

/**
 * Registers a provider backend descriptor and its LLMAdapter instance.
 */
export function registerProviderBackend(registration: RegisteredProviderBackend): void {
  if (registry.has(registration.id)) {
    throw new Error(`Provider backend already registered: "${registration.id}"`);
  }

  registry.set(registration.id, registration);
}

export function getProviderBackend(id: string): ProviderBackendDescriptor | undefined {
  return registry.get(id);
}

/**
 * Returns the LLMAdapter instance for a registered provider backend.
 */
export function getProviderAdapter(id: string): LLMAdapter | undefined {
  return registry.get(id)?.adapter;
}

export function listProviderBackends(): ProviderBackendDescriptor[] {
  return Array.from(registry.values());
}

/**
 * @internal
 * For test isolation only — do not call in production code.
 */
export function clearProviderBackends(): void {
  registry.clear();
}
