import { beforeEach, describe, expect, it } from 'vitest';
import { bootstrapBuiltins, resetBootstrap } from '../src/registry/bootstrap.js';
import {
  clearContextProviders,
  listContextProviders,
} from '../src/registry/context-providers.js';
import { clearShellAdapters, listShellAdapters } from '../src/registry/shell-adapters.js';
import { clearStorageHooks, listStorageHooks } from '../src/registry/storage-hooks.js';

describe('bootstrapBuiltins()', () => {
  beforeEach(() => {
    clearContextProviders();
    clearShellAdapters();
    clearStorageHooks();
    resetBootstrap();
  });

  it('registers the git-context provider', () => {
    bootstrapBuiltins();
    expect(listContextProviders().map((provider) => provider.id)).toContain('git-context');
  });

  it('registers the filesystem-context provider', () => {
    bootstrapBuiltins();
    expect(listContextProviders().map((provider) => provider.id)).toContain(
      'filesystem-context',
    );
  });

  it('registers exactly two context providers in Phase 2', () => {
    bootstrapBuiltins();
    expect(listContextProviders()).toHaveLength(2);
  });

  it('registers the zsh shell adapter', () => {
    bootstrapBuiltins();
    expect(listShellAdapters().map((adapter) => adapter.id)).toContain('zsh');
  });

  it('registers the noop and memory storage hooks', () => {
    bootstrapBuiltins();
    const hookIds = listStorageHooks().map((hook) => hook.id);
    expect(hookIds).toContain('noop');
    expect(hookIds).toContain('memory');
  });

  it('is idempotent', () => {
    expect(() => {
      bootstrapBuiltins();
      bootstrapBuiltins();
    }).not.toThrow();
    expect(listContextProviders()).toHaveLength(2);
  });
});
