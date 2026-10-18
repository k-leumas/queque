import * as fs from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dispatchInit,
  OLLAMA_DOWNLOAD_URL,
  type PickerDeps,
  PROVIDER_MENU,
  providerInitCommand,
  runProviderPicker,
} from '../src/cli/commands/init-provider.js';
import { listOllamaModels } from '../src/providers/ollama.js';
import { resolveProviderAdapter, writeProviderPin } from '../src/providers/provider-pin.js';
import { bootstrapBuiltins, resetBootstrap } from '../src/registry/bootstrap.js';
import { clearContextProviders } from '../src/registry/context-providers.js';
import { clearProviderBackends, getProviderAdapter } from '../src/registry/provider-backends.js';
import { clearShellAdapters } from '../src/registry/shell-adapters.js';
import { clearStorageHooks } from '../src/registry/storage-hooks.js';
import { socketPath } from '../src/shared/socket-path.js';

// Never import src/cli/main.ts here: it installs process-level handlers that call process.exit.

const { readEnvValueMock } = vi.hoisted(() => ({
  readEnvValueMock: vi.fn((_key: string): string | null => null),
}));

// /dev/tty is never opened for real: under a developer's terminal the picker would block on it.
vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>();
  return {
    ...original,
    openSync: vi.fn((path: fs.PathLike, ...rest: unknown[]) => {
      if (path === '/dev/tty') {
        throw Object.assign(new Error('ENXIO: no such device or address'), { code: 'ENXIO' });
      }
      return (original.openSync as (...args: unknown[]) => number)(path, ...rest);
    }),
  };
});

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

type RestartMock = ReturnType<typeof vi.fn<(socketPath: string) => Promise<void>>>;
type OpenUrlMock = ReturnType<typeof vi.fn<(url: string) => void>>;

interface PickerRun {
  code: number;
  output: string;
  restartDaemon: RestartMock;
  openUrl: OpenUrlMock;
}

/**
 * Drives the picker with one line per answer, then ends the input. restartDaemon and openUrl
 * are always mocked so no test can signal the developer's real daemon or open a browser.
 */
async function runPicker(
  answers: string[],
  deps: Partial<PickerDeps> & { restartDaemon?: RestartMock } = {},
): Promise<PickerRun> {
  const restartDaemon: RestartMock = deps.restartDaemon ?? vi.fn(async () => undefined);
  const openUrl: OpenUrlMock = vi.fn(() => undefined);
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
  const code = await runProviderPicker({ input, output }, { openUrl, ...deps, restartDaemon });
  return { code, output: chunks.join(''), restartDaemon, openUrl };
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

  it('looks up the .env.local key from the home directory, like the daemon (WR-08)', async () => {
    readEnvValueMock.mockImplementation((key) =>
      key === 'OPENAI_API_KEY' ? 'sk-dotenv-picker-key' : null,
    );

    const { code } = await runPicker(['2']);

    expect(code).toBe(0);
    expect(readEnvValueMock).toHaveBeenCalledWith('OPENAI_API_KEY', homedir());
    expect(readEnvValueMock).not.toHaveBeenCalledWith('OPENAI_API_KEY');
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

  it('keeps the path prefix of a proxied baseUrl (WR-06)', async () => {
    const fetchMock = stubTags(['gemma4']);
    await listOllamaModels('https://gpu.lan/ollama');
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://gpu.lan/ollama/api/tags');
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

describe('picker failure paths (nothing written)', () => {
  it('OpenAI without a usable key exits 1 with export guidance', async () => {
    const { code, output, restartDaemon } = await runPicker(['2']);

    expect(code).toBe(1);
    expect(fs.existsSync(pinFile)).toBe(false);
    expect(output).toContain('OPENAI_API_KEY');
    expect(output).toContain('export');
    expect(restartDaemon).not.toHaveBeenCalled();
  });

  it('Ollama unreachable prints the download URL and ollama serve; Enter does not open it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    const { code, output, openUrl } = await runPicker(['3', '']);

    expect(code).toBe(1);
    expect(fs.existsSync(pinFile)).toBe(false);
    expect(output).toContain('https://ollama.com/download');
    expect(output).toContain('ollama serve');
    expect(output).toContain('[y/N]');
    expect(openUrl).not.toHaveBeenCalled();
  });

  it.each(['y', 'YES'])('Ollama unreachable with %s opens only the download URL', async (yes) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    const { code, openUrl } = await runPicker(['3', yes]);

    expect(code).toBe(1);
    expect(openUrl).toHaveBeenCalledTimes(1);
    expect(openUrl).toHaveBeenCalledWith(OLLAMA_DOWNLOAD_URL);
    expect(OLLAMA_DOWNLOAD_URL).toBe('https://ollama.com/download');
    expect(fs.existsSync(pinFile)).toBe(false);
  });

  it('Ollama answering HTTP 500 is treated as not answering', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );

    const { code, output, openUrl } = await runPicker(['3', 'n']);

    expect(code).toBe(1);
    expect(output).toContain('ollama serve');
    expect(openUrl).not.toHaveBeenCalled();
    expect(fs.existsSync(pinFile)).toBe(false);
  });

  it('Ollama with zero models prints ollama pull guidance', async () => {
    stubTags([]);

    const { code, output, restartDaemon } = await runPicker(['3']);

    expect(code).toBe(1);
    expect(fs.existsSync(pinFile)).toBe(false);
    expect(output).toContain('ollama pull');
    expect(restartDaemon).not.toHaveBeenCalled();
  });

  it('three invalid menu answers exit 1 without writing', async () => {
    const { code, output } = await runPicker(['x', '9', 'abc']);

    expect(code).toBe(1);
    expect(fs.existsSync(pinFile)).toBe(false);
    expect(output.includes('Choose 1, 2, or 3.')).toBe(true);
    expect(output).toContain('No changes made');
  });

  it('an invalid menu answer re-asks and a valid retry still saves', async () => {
    const { code, output } = await runPicker(['x', '1']);

    expect(code).toBe(0);
    expect(output.includes('Choose 1, 2, or 3.')).toBe(true);
    expect(readPin()).toEqual({ version: 1, provider: 'claude' });
  });

  it('three invalid model answers exit 1 without writing', async () => {
    stubTags(['gemma4', 'qwen3']);

    const { code, output } = await runPicker(['3', '0', '7', 'qwen3']);

    expect(code).toBe(1);
    expect(fs.existsSync(pinFile)).toBe(false);
    expect(output).toContain('No changes made');
  });

  it('input ending before an answer exits 1 without writing', async () => {
    const { code, output } = await runPicker([]);

    expect(code).toBe(1);
    expect(fs.existsSync(pinFile)).toBe(false);
    expect(output).toContain('No changes made');
  });

  it('input ending at the model prompt exits 1 without writing', async () => {
    stubTags(['gemma4']);

    const { code, output } = await runPicker(['3']);

    expect(code).toBe(1);
    expect(fs.existsSync(pinFile)).toBe(false);
    expect(output).toContain('No changes made');
  });

  it('an unwritable pin path exits 1 with the reason and does not restart', async () => {
    fs.mkdirSync(pinFile, { recursive: true });

    const { code, output, restartDaemon } = await runPicker(['']);

    expect(code).toBe(1);
    expect(output).toContain('Could not save');
    expect(output).toContain('No changes made');
    expect(restartDaemon).not.toHaveBeenCalled();
  });
});

describe('daemon restart after a saved pin', () => {
  it('restartDaemon is called once with socketPath() after a successful write', async () => {
    const { code, output, restartDaemon } = await runPicker(['']);

    expect(code).toBe(0);
    expect(restartDaemon).toHaveBeenCalledTimes(1);
    expect(restartDaemon).toHaveBeenCalledWith(socketPath());
    expect(output).toContain('Restarted the QueQue daemon');
  });

  it('a failed restart keeps the pin, warns, and still exits 0', async () => {
    const restartDaemon: RestartMock = vi.fn(async () => {
      throw new Error('qq daemon did not restart within the expected window');
    });

    const { code, output } = await runPicker(['3', ''], {
      restartDaemon,
      listOllamaModels: async () => ({ ok: true, models: ['gemma4'] }),
    });

    expect(code).toBe(0);
    expect(restartDaemon).toHaveBeenCalledTimes(1);
    expect(readPin()).toEqual({ version: 1, provider: 'ollama', model: 'gemma4' });
    expect(output).toContain('could not restart');
    expect(output).toContain('did not restart within the expected window');
  });
});

describe('re-running the picker (D-15)', () => {
  it('shows the current ollama pin', async () => {
    writeProviderPin({ version: 1, provider: 'ollama', model: 'gemma4' });

    const { output } = await runPicker(['']);

    expect(output).toContain('Current: ollama (gemma4)');
    expect(readPin()).toEqual({ version: 1, provider: 'claude' });
  });

  it('keeps a saved Ollama baseUrl and lists models from it (WR-02)', async () => {
    writeProviderPin({
      version: 1,
      provider: 'ollama',
      model: 'gemma4',
      baseUrl: 'http://gpu.lan:11434',
    });
    const fetchMock = stubTags(['gemma4', 'qwen3']);

    const { code, output } = await runPicker(['3', '2']);

    expect(code).toBe(0);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://gpu.lan:11434/api/tags');
    expect(readPin()).toEqual({
      version: 1,
      provider: 'ollama',
      model: 'qwen3',
      baseUrl: 'http://gpu.lan:11434',
    });
    expect(output).toContain('at http://gpu.lan:11434');
  });

  it('names the saved remote Ollama URL when it is not answering (WR-02, IN-09)', async () => {
    writeProviderPin({
      version: 1,
      provider: 'ollama',
      model: 'gemma4',
      baseUrl: 'http://gpu.lan:11434',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    const { code, output, openUrl } = await runPicker(['3', 'y']);

    expect(code).toBe(1);
    expect(output).toContain('Ollama is not answering at http://gpu.lan:11434.');
    expect(output).not.toContain('localhost:11434');
    // IN-09: remote advice and the way back to this machine, no local install advice.
    expect(output).toContain('Check that the Ollama server at http://gpu.lan:11434 is running');
    expect(output).toContain('remove "baseUrl" from');
    expect(output).not.toContain('https://ollama.com/download');
    expect(output).not.toContain('[y/N]');
    expect(openUrl).not.toHaveBeenCalled();
    // Nothing was written: the old pin, baseUrl included, is still in place.
    expect(readPin()).toEqual({
      version: 1,
      provider: 'ollama',
      model: 'gemma4',
      baseUrl: 'http://gpu.lan:11434',
    });
  });

  it('keeps a hand-set OpenAI model when OpenAI is picked again (WR-02)', async () => {
    writeProviderPin({ version: 1, provider: 'openai', model: 'gpt-5.4-mini' });
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-picker-key');

    const { code, output } = await runPicker(['2']);

    expect(code).toBe(0);
    expect(readPin()).toEqual({ version: 1, provider: 'openai', model: 'gpt-5.4-mini' });
    expect(output).toContain('kept model gpt-5.4-mini');
  });

  it('does not carry an OpenAI model into an Ollama pin (WR-02)', async () => {
    writeProviderPin({ version: 1, provider: 'openai', model: 'gpt-5.4-mini' });
    const fetchMock = stubTags(['gemma4']);

    const { code } = await runPicker(['3', '']);

    expect(code).toBe(0);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(TAGS_URL);
    expect(readPin()).toEqual({ version: 1, provider: 'ollama', model: 'gemma4' });
  });

  it('says an invalid file is invalid and replaces it', async () => {
    fs.mkdirSync(join(pinDir, 'qq'), { recursive: true });
    fs.writeFileSync(pinFile, '{"version":1,"provider":"openai","apiKey":"sk-x"}');

    const { code, output } = await runPicker(['']);

    expect(code).toBe(0);
    expect(output).toContain('invalid');
    expect(output).not.toContain('sk-x');
    expect(readPin()).toEqual({ version: 1, provider: 'claude' });
  });
});

describe('providerInitCommand()', () => {
  it('without /dev/tty exits 1 with a one-line stderr error and writes nothing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const stdoutWrite = vi.spyOn(process.stdout, 'write');
    const previous = process.exitCode;
    let exitCode: typeof process.exitCode;
    try {
      await providerInitCommand();
      exitCode = process.exitCode;
    } finally {
      process.exitCode = previous;
    }

    expect(exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('interactive terminal');
    expect(stdoutWrite).not.toHaveBeenCalled();
    expect(fs.existsSync(pinFile)).toBe(false);
  });
});

describe('D-03 / D-05 source guards', () => {
  it.each([
    'src/client/run-foreground.ts',
    'src/daemon/server.ts',
    'src/daemon/fetch-client.ts',
    'src/cli/commands/init.ts',
  ])('%s never references init-provider', (file) => {
    const source = fs.readFileSync(join(process.cwd(), file), 'utf8');
    expect(/init-provider/.test(source)).toBe(false);
  });
});
