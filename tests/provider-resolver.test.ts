import { beforeEach, describe, expect, it } from 'vitest';
import { resolveAdapter, resolveClaudeDefaultAdapter } from '../src/providers/resolver.js';
import { bootstrapBuiltins, resetBootstrap } from '../src/registry/bootstrap.js';
import { clearContextProviders } from '../src/registry/context-providers.js';
import { clearProviderBackends, getProviderAdapter } from '../src/registry/provider-backends.js';
import { clearShellAdapters } from '../src/registry/shell-adapters.js';
import { clearStorageHooks } from '../src/registry/storage-hooks.js';

function resetRegistries(): void {
  clearContextProviders();
  clearProviderBackends();
  clearShellAdapters();
  clearStorageHooks();
  resetBootstrap();
}

describe('resolveClaudeDefaultAdapter() and resolveAdapter()', () => {
  beforeEach(() => {
    resetRegistries();
    bootstrapBuiltins();
  });

  it('returns the claude-cli composite for anthropic-key detection', () => {
    const adapter = resolveAdapter({ kind: 'anthropic-key' });
    expect(adapter.fetchCandidates).toBeTypeOf('function');
    expect(adapter).toBe(getProviderAdapter('claude-cli'));
  });

  it('returns the Claude default for claude-cli (08-02 composite, not a pin)', () => {
    const adapter = resolveAdapter({ kind: 'claude-cli' });
    expect(adapter.fetchCandidates).toBeTypeOf('function');
    expect(adapter).toBe(resolveClaudeDefaultAdapter());
  });

  it('maps ollama to the Claude default as an 08-02 bridge until 08-03 pinning', () => {
    const adapter = resolveAdapter({ kind: 'ollama', baseUrl: 'http://localhost:11434' });
    expect(adapter.fetchCandidates).toBeTypeOf('function');
    expect(adapter).toBe(resolveClaudeDefaultAdapter());
  });

  it('maps openai-key to the Claude default as an 08-02 bridge until 08-03 pinning', () => {
    const adapter = resolveAdapter({ kind: 'openai-key' });
    expect(adapter.fetchCandidates).toBeTypeOf('function');
    expect(adapter).toBe(resolveClaudeDefaultAdapter());
  });

  it('maps none to the Claude default as an 08-02 bridge until 08-03 pinning', () => {
    const adapter = resolveAdapter({
      kind: 'none',
      message: 'Set ANTHROPIC_API_KEY or add .env.local',
    });
    expect(adapter.fetchCandidates).toBeTypeOf('function');
    expect(adapter).toBe(resolveClaudeDefaultAdapter());
  });
});

describe('resolveClaudeDefaultAdapter() before bootstrap', () => {
  beforeEach(() => {
    resetRegistries();
  });

  it('throws a user-facing error when the claude-cli adapter is not registered', () => {
    expect(() => resolveClaudeDefaultAdapter()).toThrow(/bootstrapBuiltins\(\)/);
    expect(() => resolveAdapter({ kind: 'anthropic-key' })).toThrow(/bootstrapBuiltins\(\)/);
  });
});
