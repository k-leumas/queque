/**
 * PHASE 2 STUB — Storage Hooks Registry
 *
 * This seam exists before persistence lands so storage behavior can grow behind
 * a registry instead of direct call-site wiring. Example future use: register a
 * SQLite-backed session history hook without changing client flow code.
 */
export interface StorageHookDescriptor {
  id: string;
  description: string;
}

const registry = new Map<string, StorageHookDescriptor>();

export function registerStorageHook(descriptor: StorageHookDescriptor): void {
  if (registry.has(descriptor.id)) {
    throw new Error(`Storage hook already registered: "${descriptor.id}"`);
  }

  registry.set(descriptor.id, descriptor);
}

export function getStorageHook(id: string): StorageHookDescriptor | undefined {
  return registry.get(id);
}

export function listStorageHooks(): StorageHookDescriptor[] {
  return Array.from(registry.values());
}

/**
 * @internal
 * For test isolation only — do not call in production code.
 */
export function clearStorageHooks(): void {
  registry.clear();
}
