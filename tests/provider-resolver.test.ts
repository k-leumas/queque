import { beforeEach, describe, expect, it } from 'vitest';
import { resolveAdapter } from '../src/providers/resolver.js';
import { bootstrapBuiltins, resetBootstrap } from '../src/registry/bootstrap.js';
import { clearContextProviders } from '../src/registry/context-providers.js';
import { clearProviderBackends } from '../src/registry/provider-backends.js';
import { clearShellAdapters } from '../src/registry/shell-adapters.js';
import { clearStorageHooks } from '../src/registry/storage-hooks.js';

describe('resolveAdapter()', () => {
  beforeEach(() => {
    clearContextProviders();
    clearProviderBackends();
    clearShellAdapters();
    clearStorageHooks();
    resetBootstrap();
    bootstrapBuiltins();
  });

  it('returns claude adapter for anthropic-key detection', () => {
    const adapter = resolveAdapter({ kind: 'anthropic-key' });
    expect(adapter.fetchCandidates).toBeTypeOf('function');
  });

  it('throws for claude-cli until Phase 8 wiring', () => {
    expect(() => resolveAdapter({ kind: 'claude-cli' })).toThrow(
      /subprocess adapter is not wired yet/i,
    );
  });

  it('throws for ollama until Phase 8 wiring', () => {
    expect(() => resolveAdapter({ kind: 'ollama', baseUrl: 'http://localhost:11434' })).toThrow(
      /not wired yet/i,
    );
  });
});
