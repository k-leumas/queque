import type { ContextProvider } from '../context/provider.js';

const registry = new Map<string, ContextProvider>();

export function registerContextProvider(descriptor: ContextProvider): void {
  if (registry.has(descriptor.id)) {
    throw new Error(`Context provider already registered: "${descriptor.id}"`);
  }

  registry.set(descriptor.id, descriptor);
}

export function getContextProvider(id: string): ContextProvider | undefined {
  return registry.get(id);
}

export function listContextProviders(): ContextProvider[] {
  return Array.from(registry.values());
}

/**
 * @internal
 * For test isolation only — do not call in production code.
 */
export function clearContextProviders(): void {
  registry.clear();
}
