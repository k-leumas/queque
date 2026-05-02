import { filesystemContextProvider } from '../context/providers/filesystem-context.js';
import { gitContextProvider } from '../context/providers/git-context.js';
import { registerContextProvider } from './context-providers.js';
import { registerShellAdapter } from './shell-adapters.js';
import { registerStorageHook } from './storage-hooks.js';

let bootstrapped = false;

/**
 * Registers all Phase 2 built-ins into their respective registries.
 *
 * This is the single source of truth for what built-ins exist in Phase 2.
 * Callers should invoke it at startup; repeated calls are safe no-ops.
 */
export function bootstrapBuiltins(): void {
  if (bootstrapped) {
    return;
  }

  bootstrapped = true;

  registerContextProvider(gitContextProvider);
  registerContextProvider(filesystemContextProvider);

  registerShellAdapter({
    id: 'zsh',
    shell: 'zsh',
    description: 'zsh ZLE widget adapter (Phase 2 built-in)',
  });

  registerStorageHook({
    id: 'noop',
    description: 'No-op storage hook (default — no persistence)',
  });
  registerStorageHook({
    id: 'memory',
    description: 'In-memory storage hook (test and ephemeral use)',
  });
}

/**
 * @internal
 * For test isolation only — do not call in production code.
 */
export function resetBootstrap(): void {
  bootstrapped = false;
}
