import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('maps ollama detection to the Claude default — detection never selects (D-01)', () => {
    const adapter = resolveAdapter({ kind: 'ollama', baseUrl: 'http://localhost:11434' });
    expect(adapter.fetchCandidates).toBeTypeOf('function');
    expect(adapter).toBe(resolveClaudeDefaultAdapter());
  });

  it('maps openai-key detection to the Claude default — detection never selects (D-01)', () => {
    const adapter = resolveAdapter({ kind: 'openai-key' });
    expect(adapter.fetchCandidates).toBeTypeOf('function');
    expect(adapter).toBe(resolveClaudeDefaultAdapter());
  });

  it('maps none detection to the Claude default — detection never selects (D-01)', () => {
    const adapter = resolveAdapter({
      kind: 'none',
      message: 'Set ANTHROPIC_API_KEY or add .env.local',
    });
    expect(adapter.fetchCandidates).toBeTypeOf('function');
    expect(adapter).toBe(resolveClaudeDefaultAdapter());
  });
});

describe('resolveAdapter() and provider.json (D-01, D-11)', () => {
  let pinDir: string;

  beforeEach(() => {
    resetRegistries();
    bootstrapBuiltins();
    pinDir = mkdtempSync(join(tmpdir(), 'qq-resolver-pin-'));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(pinDir, { recursive: true, force: true });
  });

  it('resolveAdapter ignores a provider.json pin', () => {
    const pinFile = join(pinDir, 'provider.json');
    writeFileSync(pinFile, JSON.stringify({ version: 1, provider: 'ollama', model: 'gemma4' }));
    vi.stubEnv('QQ_PROVIDER_FILE', pinFile);

    const adapter = resolveAdapter({ kind: 'ollama', baseUrl: 'http://localhost:11434' });

    expect(adapter).toBe(getProviderAdapter('claude-cli'));
    expect(adapter).not.toBe(getProviderAdapter('ollama'));
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
