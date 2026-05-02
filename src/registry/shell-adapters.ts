/**
 * PHASE 2 STUB — Shell Adapters Registry
 *
 * This seam exists before additional shells ship so every built-in and future
 * adapter can register through the same path. Example future use: add a bash adapter
 * without rewriting the surrounding pipeline or bootstrap code.
 */
export interface ShellAdapterDescriptor {
  id: string;
  shell: string;
  description: string;
}

const registry = new Map<string, ShellAdapterDescriptor>();

export function registerShellAdapter(descriptor: ShellAdapterDescriptor): void {
  if (registry.has(descriptor.id)) {
    throw new Error(`Shell adapter already registered: "${descriptor.id}"`);
  }

  registry.set(descriptor.id, descriptor);
}

export function getShellAdapter(id: string): ShellAdapterDescriptor | undefined {
  return registry.get(id);
}

export function listShellAdapters(): ShellAdapterDescriptor[] {
  return Array.from(registry.values());
}

/**
 * @internal
 * For test isolation only — do not call in production code.
 */
export function clearShellAdapters(): void {
  registry.clear();
}
