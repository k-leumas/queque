/**
 * PHASE 2 STUB — Provider Backends Registry
 *
 * This seam exists before the runtime uses it so provider registration can
 * move through one internal path instead of hardcoding Claude first and
 * refactoring later. Example future use: register an OpenAI backend alongside Claude.
 */
export interface ProviderBackendDescriptor {
  id: string;
  name: string;
  description: string;
}

const registry = new Map<string, ProviderBackendDescriptor>();

export function registerProviderBackend(descriptor: ProviderBackendDescriptor): void {
  if (registry.has(descriptor.id)) {
    throw new Error(`Provider backend already registered: "${descriptor.id}"`);
  }

  registry.set(descriptor.id, descriptor);
}

export function getProviderBackend(id: string): ProviderBackendDescriptor | undefined {
  return registry.get(id);
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
