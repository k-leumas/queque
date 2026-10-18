import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadProviderPin,
  MAX_ISSUE_REASON,
  OLLAMA_DEFAULT_BASE_URL,
  PIN_BACKEND_IDS,
  providerPinPath,
  resolveProviderAdapter,
  writeProviderPin,
} from '../src/providers/provider-pin.js';
import { bootstrapBuiltins, resetBootstrap } from '../src/registry/bootstrap.js';
import { clearContextProviders } from '../src/registry/context-providers.js';
import { clearProviderBackends, getProviderAdapter } from '../src/registry/provider-backends.js';
import { clearShellAdapters } from '../src/registry/shell-adapters.js';
import { clearStorageHooks } from '../src/registry/storage-hooks.js';

const { appendDebugLogMock, chmodSyncMock } = vi.hoisted(() => ({
  appendDebugLogMock: vi.fn().mockResolvedValue(undefined),
  chmodSyncMock: vi.fn(),
}));

vi.mock('../src/shared/debug-log.js', () => ({
  appendDebugLog: appendDebugLogMock,
}));

// IN-03: provider-pin.ts gets a passthrough chmodSync spy so one test can make it fail.
// (The mock reaches src modules; this file's own `fs` namespace import stays the original.)
vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>();
  chmodSyncMock.mockImplementation(original.chmodSync);
  return { ...original, chmodSync: chmodSyncMock };
});

function resetRegistries(): void {
  clearContextProviders();
  clearProviderBackends();
  clearShellAdapters();
  clearStorageHooks();
  resetBootstrap();
}

let pinDir: string;
let pinFile: string;

function writePin(content: string): void {
  fs.writeFileSync(pinFile, content);
}

beforeEach(() => {
  resetRegistries();
  bootstrapBuiltins();
  appendDebugLogMock.mockClear();
  pinDir = fs.mkdtempSync(join(tmpdir(), 'qq-pin-'));
  pinFile = join(pinDir, 'provider.json');
  vi.stubEnv('QQ_PROVIDER_FILE', pinFile);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fs.rmSync(pinDir, { recursive: true, force: true });
});

describe('providerPinPath()', () => {
  it('honors QQ_PROVIDER_FILE', () => {
    expect(providerPinPath()).toBe(pinFile);
  });

  it('defaults to ~/.config/qq/provider.json, a sibling of config.json', () => {
    vi.stubEnv('QQ_PROVIDER_FILE', undefined);
    expect(providerPinPath()).toMatch(/\.config\/qq\/provider\.json$/);
  });

  it.each(['', '   '])('treats an empty QQ_PROVIDER_FILE (%j) as unset (WR-03)', (value) => {
    vi.stubEnv('QQ_PROVIDER_FILE', value);
    expect(providerPinPath()).toMatch(/\.config\/qq\/provider\.json$/);
  });
});

describe('relative or empty QQ_PROVIDER_FILE (WR-03)', () => {
  it('an empty override reads the default pin instead of resolving to absent', () => {
    // HOME points at the temp dir, so the default path is a scratch file, never the real one.
    vi.stubEnv('HOME', pinDir);
    vi.stubEnv('QQ_PROVIDER_FILE', '');
    fs.mkdirSync(join(pinDir, '.config', 'qq'), { recursive: true });
    fs.writeFileSync(
      join(pinDir, '.config', 'qq', 'provider.json'),
      '{"version":1,"provider":"ollama","model":"gemma4"}',
    );

    expect(loadProviderPin()).toEqual({
      kind: 'pinned',
      pin: { version: 1, provider: 'ollama', model: 'gemma4' },
    });
  });

  it('a relative override is an invalid pin, not absent', () => {
    vi.stubEnv('QQ_PROVIDER_FILE', 'provider.json');
    expect(loadProviderPin()).toEqual({
      kind: 'invalid',
      path: 'provider.json',
      message: 'QQ_PROVIDER_FILE must be an absolute path',
    });
  });

  it('a relative override throws instead of resolving the Claude default', () => {
    vi.stubEnv('QQ_PROVIDER_FILE', 'nested/provider.json');
    const claudeDefault = getProviderAdapter('claude-cli');

    let resolved: unknown;
    expect(() => {
      resolved = resolveProviderAdapter();
    }).toThrow(/must be an absolute path/);
    expect(resolved).toBeUndefined();
    expect(claudeDefault).toBeDefined();
  });

  it('writeProviderPin refuses a relative override and writes nothing', () => {
    const cwd = process.cwd();
    const relDir = fs.mkdtempSync(join(tmpdir(), 'qq-pin-rel-'));
    process.chdir(relDir);
    try {
      vi.stubEnv('QQ_PROVIDER_FILE', 'provider.json');
      expect(() => writeProviderPin({ version: 1, provider: 'claude' })).toThrow(
        /must be an absolute path/,
      );
      expect(fs.readdirSync(relDir)).toEqual([]);
    } finally {
      process.chdir(cwd);
      fs.rmSync(relDir, { recursive: true, force: true });
    }
  });
});

describe('loadProviderPin()', () => {
  it('returns absent when the file does not exist (ENOENT)', () => {
    expect(loadProviderPin()).toEqual({ kind: 'absent' });
  });

  it.each([
    ['claude', '{"version":1,"provider":"claude"}', { version: 1, provider: 'claude' }],
    ['openai', '{"version":1,"provider":"openai"}', { version: 1, provider: 'openai' }],
    [
      'openai with model',
      '{"version":1,"provider":"openai","model":"gpt-5.5"}',
      { version: 1, provider: 'openai', model: 'gpt-5.5' },
    ],
    [
      'ollama',
      '{"version":1,"provider":"ollama","model":"gemma4"}',
      { version: 1, provider: 'ollama', model: 'gemma4' },
    ],
    [
      'ollama with baseUrl',
      '{"version":1,"provider":"ollama","model":"gemma4","baseUrl":"https://gpu.lan:11434"}',
      { version: 1, provider: 'ollama', model: 'gemma4', baseUrl: 'https://gpu.lan:11434' },
    ],
  ])('pins a valid %s file', (_name, content, pin) => {
    writePin(content);
    expect(loadProviderPin()).toEqual({ kind: 'pinned', pin });
  });

  it.each([
    ['an empty object', '{}'],
    ['invalid JSON', '{"version":1,'],
    ['an empty file', ''],
    ['an unknown provider', '{"version":1,"provider":"gemini"}'],
    ['ollama without a model', '{"version":1,"provider":"ollama"}'],
    ['ollama with a blank model', '{"version":1,"provider":"ollama","model":"   "}'],
    ['a missing version', '{"provider":"claude"}'],
    ['an unsupported version', '{"version":2,"provider":"claude"}'],
    ['an extra apiKey key', '{"version":1,"provider":"openai","apiKey":"sk-not-a-real-key"}'],
    ['a baseUrl on openai', '{"version":1,"provider":"openai","baseUrl":"https://evil.example"}'],
    [
      'a file: baseUrl',
      '{"version":1,"provider":"ollama","model":"gemma4","baseUrl":"file:///etc/passwd"}',
    ],
    [
      'an ftp: baseUrl',
      '{"version":1,"provider":"ollama","model":"gemma4","baseUrl":"ftp://localhost:11434"}',
    ],
    ['a JSON array', '[]'],
    // WR-04: the model is echoed on the terminal, so control bytes are rejected.
    [
      'an ollama model with ESC',
      '{"version":1,"provider":"ollama","model":"gemma4\\u001b]52;c;eA==\\u0007"}',
    ],
    ['an openai model with a C1 byte', '{"version":1,"provider":"openai","model":"gpt\\u009b2J"}'],
  ])('reports %s as invalid', (_name, content) => {
    writePin(content);
    const state = loadProviderPin();
    expect(state.kind).toBe('invalid');
    if (state.kind === 'invalid') {
      expect(state.path).toBe(pinFile);
      expect(state.message.length).toBeGreaterThan(0);
    }
  });

  it('never puts file values in the invalid message (apiKey value stays out)', () => {
    writePin('{"version":1,"provider":"openai","apiKey":"sk-not-a-real-key"}');
    const state = loadProviderPin();
    expect(state).toMatchObject({ kind: 'invalid' });
    expect(JSON.stringify(state)).not.toContain('sk-not-a-real-key');
    expect(JSON.stringify(state)).toContain('apiKey');
  });

  it('caps unknown key names and replaces their control characters (IN-02)', () => {
    const longKey = `k${'x'.repeat(300)}`;
    writePin(
      JSON.stringify({
        version: 1,
        provider: 'claude',
        'evil\u001b]0;pwned\u0007': 1,
        [longKey]: 2,
      }),
    );
    const state = loadProviderPin();
    expect(state.kind).toBe('invalid');
    if (state.kind === 'invalid') {
      expect(state.message).toContain('unknown key evil?]0;pwned?');
      expect(state.message).not.toMatch(/\p{Cc}/u);
      expect(state.message.length).toBeLessThanOrEqual(MAX_ISSUE_REASON);
      expect(state.message.endsWith('…')).toBe(true);
    }
  });

  it('reports an unreadable path (a directory) as invalid, not absent', () => {
    vi.stubEnv('QQ_PROVIDER_FILE', pinDir);
    const state = loadProviderPin();
    expect(state).toEqual({ kind: 'invalid', path: pinDir, message: 'EISDIR' });
  });
});

describe('resolveProviderAdapter()', () => {
  it('maps every pinnable provider to its registry backend id', () => {
    expect(PIN_BACKEND_IDS).toEqual({ claude: 'claude-cli', openai: 'openai', ollama: 'ollama' });
    expect(OLLAMA_DEFAULT_BASE_URL).toBe('http://localhost:11434');
  });

  it('resolves the claude-cli composite when no pin exists (D-03)', () => {
    expect(resolveProviderAdapter()).toBe(getProviderAdapter('claude-cli'));
    expect(appendDebugLogMock).toHaveBeenCalledWith('provider', 'provider selected', {
      provider: 'claude',
      source: 'default',
    });
  });

  it('resolves claude-cli for a claude pin', () => {
    writePin('{"version":1,"provider":"claude"}');
    expect(resolveProviderAdapter()).toBe(getProviderAdapter('claude-cli'));
    expect(appendDebugLogMock).toHaveBeenCalledWith('provider', 'provider selected', {
      provider: 'claude',
      source: 'pin',
    });
  });

  it('resolves only the ollama backend for an ollama pin', () => {
    writePin('{"version":1,"provider":"ollama","model":"gemma4"}');
    const adapter = resolveProviderAdapter();
    expect(adapter).toBe(getProviderAdapter('ollama'));
    expect(adapter).not.toBe(getProviderAdapter('claude-cli'));
    expect(appendDebugLogMock).toHaveBeenCalledWith('provider', 'provider selected', {
      provider: 'ollama',
      source: 'pin',
    });
  });

  it('throws for an invalid pin and never touches the Claude default (fail closed)', () => {
    const claude = getProviderAdapter('claude-cli');
    if (!claude) throw new Error('claude-cli missing');
    const claudeFetch = vi.spyOn(claude, 'fetchCandidates');
    writePin('{}');

    expect(() => resolveProviderAdapter()).toThrow(/qq init provider/);
    expect(() => resolveProviderAdapter()).toThrow(pinFile);
    expect(claudeFetch).not.toHaveBeenCalled();
    expect(appendDebugLogMock).toHaveBeenCalledWith('provider', 'provider selected', {
      source: 'invalid',
    });
  });

  it('throws for an unreadable pin instead of defaulting to Claude', () => {
    vi.stubEnv('QQ_PROVIDER_FILE', pinDir);
    expect(() => resolveProviderAdapter()).toThrow(/not a valid provider pin \(EISDIR\)/);
  });

  it('throws when the pinned backend is not registered', () => {
    writePin('{"version":1,"provider":"ollama","model":"gemma4"}');
    clearProviderBackends();
    expect(() => resolveProviderAdapter()).toThrow(/provider 'ollama' is not registered/);
  });

  it('re-reads the file on every call, so a pin edit applies at once (D-15)', () => {
    writePin('{"version":1,"provider":"ollama","model":"gemma4"}');
    const first = resolveProviderAdapter();
    writePin('{"version":1,"provider":"claude"}');
    const second = resolveProviderAdapter();

    expect(first).toBe(getProviderAdapter('ollama'));
    expect(second).toBe(getProviderAdapter('claude-cli'));
    expect(first).not.toBe(second);
  });

  it('logs provider and source only — never the pin file contents', () => {
    writePin('{"version":1,"provider":"ollama","model":"secret-model-name"}');
    resolveProviderAdapter();
    expect(JSON.stringify(appendDebugLogMock.mock.calls)).not.toContain('secret-model-name');
  });
});

describe('writeProviderPin() permissions (IN-03)', () => {
  it('writes the pin with mode 0600', () => {
    writeProviderPin({ version: 1, provider: 'claude' });
    expect(fs.statSync(pinFile).mode & 0o777).toBe(0o600);
  });

  it('a chmod failure leaves the old pin in place and no temp file', () => {
    writeProviderPin({ version: 1, provider: 'claude' });
    chmodSyncMock.mockImplementationOnce(() => {
      throw Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
    });

    expect(() => writeProviderPin({ version: 1, provider: 'ollama', model: 'gemma4' })).toThrow(
      'EPERM',
    );
    expect(loadProviderPin()).toEqual({
      kind: 'pinned',
      pin: { version: 1, provider: 'claude' },
    });
    expect(fs.readdirSync(pinDir)).toEqual(['provider.json']);
  });
});
