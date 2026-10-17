import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dispatchInit,
  type PickerDeps,
  PROVIDER_MENU,
  runProviderPicker,
} from '../src/cli/commands/init-provider.js';
import { listOllamaModels } from '../src/providers/ollama.js';
import { resolveProviderAdapter, writeProviderPin } from '../src/providers/provider-pin.js';
import { bootstrapBuiltins, resetBootstrap } from '../src/registry/bootstrap.js';
import { clearContextProviders } from '../src/registry/context-providers.js';
import { clearProviderBackends, getProviderAdapter } from '../src/registry/provider-backends.js';
import { clearShellAdapters } from '../src/registry/shell-adapters.js';
import { clearStorageHooks } from '../src/registry/storage-hooks.js';

// Never import src/cli/main.ts here: it installs process-level handlers that call process.exit.

const { readEnvValueMock } = vi.hoisted(() => ({
  readEnvValueMock: vi.fn((_key: string): string | null => null),
}));

vi.mock('../src/shared/debug-log.js', () => ({
  appendDebugLog: vi.fn().mockResolvedValue(undefined),
}));

// .env.local is looked up from the cwd upward; a worktree would see the main checkout's file.
vi.mock('../src/shared/env-file.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/shared/env-file.js')>();
  return { ...original, readEnvValueFromDotEnvLocal: readEnvValueMock };
});

const TAGS_URL = 'http://localhost:11434/api/tags';

let pinDir: string;
let pinFile: string;

function resetRegistries(): void {
  clearContextProviders();
  clearProviderBackends();
  clearShellAdapters();
  clearStorageHooks();
  resetBootstrap();
}

function tagsResponse(names: string[]): Response {
  return new Response(JSON.stringify({ models: names.map((name) => ({ name, model: name })) }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function stubTags(names: string[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (_url: unknown) => tagsResponse(names));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

interface PickerRun {
  code: number;
  output: string;
}

/** Drives the picker with one line per answer, then ends the input. */
async function runPicker(answers: string[], deps: Partial<PickerDeps> = {}): Promise<PickerRun> {
  const input = new PassThrough();
  const chunks: string[] = [];
  const output = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  for (const answer of answers) {
    input.write(`${answer}\n`);
  }
  input.end();
  const code = await runProviderPicker({ input, output }, deps);
  return { code, output: chunks.join('') };
}

function readPin(): unknown {
  return JSON.parse(fs.readFileSync(pinFile, 'utf8'));
}

beforeEach(() => {
  resetRegistries();
  bootstrapBuiltins();
  readEnvValueMock.mockReset();
  readEnvValueMock.mockReturnValue(null);
  pinDir = fs.mkdtempSync(join(tmpdir(), 'qq-picker-'));
  pinFile = join(pinDir, 'qq', 'provider.json');
  vi.stubEnv('QQ_PROVIDER_FILE', pinFile);
  vi.stubEnv('OPENAI_API_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fs.rmSync(pinDir, { recursive: true, force: true });
});

describe('qq init provider picker', () => {
  it('menu lists Claude, OpenAI, Ollama in that order', async () => {
    expect(PROVIDER_MENU.map((entry) => entry.id)).toEqual(['claude', 'openai', 'ollama']);

    const { output } = await runPicker(['']);
    const claude = output.indexOf('1. Claude');
    const openai = output.indexOf('2. OpenAI');
    const ollama = output.indexOf('3. Ollama');
    expect(claude).toBeGreaterThan(-1);
    expect(openai).toBeGreaterThan(claude);
    expect(ollama).toBeGreaterThan(openai);
    expect(output).toContain('QueQue provider setup');
  });

  it('Enter selects Claude and writes a 0600 pin', async () => {
    const { code, output } = await runPicker(['']);

    expect(code).toBe(0);
    expect(readPin()).toEqual({ version: 1, provider: 'claude' });
    expect(fs.statSync(pinFile).mode & 0o777).toBe(0o600);
    expect(fs.statSync(join(pinDir, 'qq')).mode & 0o777).toBe(0o700);
    expect(output).toContain(`Saved ${pinFile}: Claude.`);
    expect(output).toContain('claude /login');
  });

  it('typing 1 also selects Claude', async () => {
    const { code } = await runPicker(['1']);
    expect(code).toBe(0);
    expect(readPin()).toEqual({ version: 1, provider: 'claude' });
  });

  it('OpenAI with a usable key writes an openai pin and never prints the key', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-picker-key');

    const { code, output } = await runPicker(['2']);

    expect(code).toBe(0);
    expect(readPin()).toEqual({ version: 1, provider: 'openai' });
    expect(output).toContain('OpenAI');
    expect(output).not.toContain('sk-test-picker-key');
    expect(fs.readFileSync(pinFile, 'utf8')).not.toContain('sk-test-picker-key');
  });

  it('OpenAI accepts a key from .env.local without printing it', async () => {
    readEnvValueMock.mockImplementation((key) =>
      key === 'OPENAI_API_KEY' ? 'sk-dotenv-picker-key' : null,
    );

    const { code, output } = await runPicker(['2']);

    expect(code).toBe(0);
    expect(readPin()).toEqual({ version: 1, provider: 'openai' });
    expect(output).not.toContain('sk-dotenv-picker-key');
  });

  it('Ollama lists models in /api/tags order and Enter picks the first', async () => {
    const fetchMock = stubTags(['gemma4', 'qwen3']);

    const { code, output } = await runPicker(['3', '']);

    expect(code).toBe(0);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(TAGS_URL);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readPin()).toEqual({ version: 1, provider: 'ollama', model: 'gemma4' });
    expect(output.indexOf('gemma4')).toBeGreaterThan(-1);
    expect(output.indexOf('qwen3')).toBeGreaterThan(output.indexOf('gemma4'));
    expect(output).toContain('Ollama (gemma4)');
  });

  it('Ollama model 2 pins the second listed model', async () => {
    stubTags(['gemma4', 'qwen3']);

    const { code } = await runPicker(['3', '2']);

    expect(code).toBe(0);
    expect(readPin()).toEqual({ version: 1, provider: 'ollama', model: 'qwen3' });
  });

  it('does not probe any backend before the user answers (D-04)', async () => {
    const fetchMock = stubTags(['gemma4']);

    await runPicker(['1']);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('written claude and ollama pins round-trip through resolveProviderAdapter', async () => {
    await runPicker(['']);
    expect(resolveProviderAdapter()).toBe(getProviderAdapter('claude-cli'));

    stubTags(['gemma4']);
    await runPicker(['3', '']);
    expect(resolveProviderAdapter()).toBe(getProviderAdapter('ollama'));
  });

  it('picker writes nothing to process.stdout', async () => {
    const stdoutWrite = vi.spyOn(process.stdout, 'write');
    stubTags(['gemma4']);

    await runPicker(['']);
    await runPicker(['3', '']);
    await runPicker(['2']);

    expect(stdoutWrite).not.toHaveBeenCalled();
  });
});

describe('writeProviderPin()', () => {
  it('rejects a pin the loader would reject and writes nothing', () => {
    const withKey = { version: 1, provider: 'openai', apiKey: 'sk-nope' };
    expect(() => writeProviderPin(withKey as never)).toThrow();
    expect(fs.existsSync(pinFile)).toBe(false);
  });

  it('replaces an existing pin and leaves no temp file behind', () => {
    writeProviderPin({ version: 1, provider: 'claude' });
    writeProviderPin({ version: 1, provider: 'ollama', model: 'gemma4' });

    expect(readPin()).toEqual({ version: 1, provider: 'ollama', model: 'gemma4' });
    expect(fs.readdirSync(join(pinDir, 'qq'))).toEqual(['provider.json']);
  });
});

describe('listOllamaModels()', () => {
  it('returns names in response order', async () => {
    stubTags(['b-model', 'a-model']);
    await expect(listOllamaModels()).resolves.toEqual({
      ok: true,
      models: ['b-model', 'a-model'],
    });
  });

  it('is unreachable when the connection is refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    await expect(listOllamaModels()).resolves.toEqual({ ok: false, reason: 'unreachable' });
  });

  it('reports a non-2xx status as http', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 503 })),
    );
    await expect(listOllamaModels()).resolves.toEqual({ ok: false, reason: 'http', status: 503 });
  });

  it('drops names with terminal control bytes', async () => {
    stubTags(['ok-model', 'bad\u001b[2Jmodel']);
    await expect(listOllamaModels()).resolves.toEqual({ ok: true, models: ['ok-model'] });
  });
});

describe('dispatchInit()', () => {
  it('dispatchInit sends provider to the picker and zsh to initCommand', async () => {
    const provider = vi.fn().mockResolvedValue(undefined);
    const shell = vi.fn();

    await dispatchInit('provider', { provider, shell });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(shell).not.toHaveBeenCalled();

    provider.mockClear();
    await dispatchInit('zsh', { provider, shell });
    expect(shell).toHaveBeenCalledWith('zsh');
    expect(provider).not.toHaveBeenCalled();
  });
});
