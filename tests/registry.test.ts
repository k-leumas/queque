import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextProvider } from '../src/context/provider.js';
import type { LLMAdapter } from '../src/providers/provider.js';
import {
  clearContextProviders,
  getContextProvider,
  listContextProviders,
  registerContextProvider,
} from '../src/registry/context-providers.js';
import {
  clearProviderBackends,
  getProviderBackend,
  listProviderBackends,
  registerProviderBackend,
} from '../src/registry/provider-backends.js';
import {
  clearShellAdapters,
  getShellAdapter,
  listShellAdapters,
  registerShellAdapter,
} from '../src/registry/shell-adapters.js';
import {
  clearStorageHooks,
  getStorageHook,
  listStorageHooks,
  registerStorageHook,
} from '../src/registry/storage-hooks.js';

describe('context-providers registry', () => {
  function makeContextProvider(id: string, intents: ContextProvider['intents']): ContextProvider {
    return { id, intents, gather: async () => null };
  }

  beforeEach(() => {
    clearContextProviders();
  });

  it('registers and retrieves a context provider by id', () => {
    const stub = makeContextProvider('test-provider', ['general']);
    registerContextProvider(stub);
    expect(getContextProvider('test-provider')).toBe(stub);
  });

  it('lists all registered context providers', () => {
    registerContextProvider(makeContextProvider('p1', ['general']));
    registerContextProvider(makeContextProvider('p2', ['codebase']));
    expect(listContextProviders().map((provider) => provider.id)).toEqual(['p1', 'p2']);
  });

  it('throws on duplicate id registration with id in message', () => {
    const stub = makeContextProvider('dup', ['general']);
    registerContextProvider(stub);
    expect(() => registerContextProvider(stub)).toThrow(
      'Context provider already registered: "dup"',
    );
  });

  it('clear() empties the registry', () => {
    registerContextProvider(makeContextProvider('to-clear', ['general']));
    clearContextProviders();
    expect(listContextProviders()).toHaveLength(0);
  });
});

describe('provider-backends registry (Phase 2 stub)', () => {
  const stubAdapter: LLMAdapter = { fetchCandidates: vi.fn() };

  beforeEach(() => {
    clearProviderBackends();
  });

  it('registers and retrieves a provider backend by id', () => {
    const stub = {
      id: 'claude',
      name: 'Claude',
      description: 'Anthropic Claude backend',
      adapter: stubAdapter,
    };
    registerProviderBackend(stub);
    expect(getProviderBackend('claude')).toBe(stub);
  });

  it('lists all registered provider backends', () => {
    registerProviderBackend({ id: 'b1', name: 'B1', description: '', adapter: stubAdapter });
    expect(listProviderBackends()).toHaveLength(1);
  });

  it('throws on duplicate id registration with id in message', () => {
    const stub = { id: 'dup-backend', name: 'Dup', description: '', adapter: stubAdapter };
    registerProviderBackend(stub);
    expect(() => registerProviderBackend(stub)).toThrow(
      'Provider backend already registered: "dup-backend"',
    );
  });

  it('clear() empties the registry', () => {
    registerProviderBackend({ id: 'to-clear', name: 'X', description: '', adapter: stubAdapter });
    clearProviderBackends();
    expect(listProviderBackends()).toHaveLength(0);
  });
});

describe('shell-adapters registry (Phase 2 stub)', () => {
  beforeEach(() => {
    clearShellAdapters();
  });

  it('registers and retrieves a shell adapter by id', () => {
    const stub = { id: 'zsh', shell: 'zsh', description: 'zsh adapter' };
    registerShellAdapter(stub);
    expect(getShellAdapter('zsh')).toBe(stub);
  });

  it('lists all registered shell adapters', () => {
    registerShellAdapter({ id: 'zsh', shell: 'zsh', description: '' });
    expect(listShellAdapters()).toHaveLength(1);
  });

  it('throws on duplicate id registration with id in message', () => {
    const stub = { id: 'dup-shell', shell: 'zsh', description: '' };
    registerShellAdapter(stub);
    expect(() => registerShellAdapter(stub)).toThrow(
      'Shell adapter already registered: "dup-shell"',
    );
  });

  it('clear() empties the registry', () => {
    registerShellAdapter({ id: 'to-clear', shell: 'bash', description: '' });
    clearShellAdapters();
    expect(listShellAdapters()).toHaveLength(0);
  });
});

describe('storage-hooks registry (Phase 2 stub)', () => {
  beforeEach(() => {
    clearStorageHooks();
  });

  it('registers and retrieves a storage hook by id', () => {
    const stub = { id: 'noop', description: 'No-op storage hook' };
    registerStorageHook(stub);
    expect(getStorageHook('noop')).toBe(stub);
  });

  it('lists all registered storage hooks', () => {
    registerStorageHook({ id: 'noop', description: '' });
    expect(listStorageHooks()).toHaveLength(1);
  });

  it('throws on duplicate id registration with id in message', () => {
    const stub = { id: 'dup-storage', description: '' };
    registerStorageHook(stub);
    expect(() => registerStorageHook(stub)).toThrow(
      'Storage hook already registered: "dup-storage"',
    );
  });

  it('clear() empties the registry', () => {
    registerStorageHook({ id: 'to-clear', description: '' });
    clearStorageHooks();
    expect(listStorageHooks()).toHaveLength(0);
  });
});
