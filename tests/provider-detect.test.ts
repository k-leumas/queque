import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Stable mock references hoisted before vi.mock factories run
// ---------------------------------------------------------------------------
const { execSyncMock, statMock, fetchMock, readEnvValueFromDotEnvLocalMock } = vi.hoisted(() => ({
  execSyncMock: vi.fn(),
  statMock: vi.fn(),
  fetchMock: vi.fn(),
  readEnvValueFromDotEnvLocalMock: vi.fn<(key: string, startDir?: string) => string | null>(),
}));

// ---------------------------------------------------------------------------
// Mock node:child_process — control whether `which claude` succeeds or throws
// ---------------------------------------------------------------------------
vi.mock('node:child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:child_process')>();
  return {
    ...original,
    execSync: execSyncMock,
  };
});

// ---------------------------------------------------------------------------
// Mock node:fs/promises — control whether auth file stat succeeds or throws
// ---------------------------------------------------------------------------
vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...original,
    stat: statMock,
  };
});

// ---------------------------------------------------------------------------
// Stub global fetch for Ollama health check
// ---------------------------------------------------------------------------
vi.stubGlobal('fetch', fetchMock);

// ---------------------------------------------------------------------------
// Mock env-file so .env.local reads are controlled per-test
// ---------------------------------------------------------------------------
vi.mock('../src/shared/env-file.js', () => ({
  readEnvValueFromDotEnvLocal: readEnvValueFromDotEnvLocalMock,
}));

// ---------------------------------------------------------------------------
// Helper: make execSync succeed (claude found on PATH)
// ---------------------------------------------------------------------------
function claudeOnPath(): void {
  execSyncMock.mockReturnValue(Buffer.from('/usr/local/bin/claude'));
}

// ---------------------------------------------------------------------------
// Helper: make execSync throw (claude not found)
// ---------------------------------------------------------------------------
function claudeNotOnPath(): void {
  execSyncMock.mockImplementation(() => {
    throw new Error('not found');
  });
}

// ---------------------------------------------------------------------------
// Helper: make stat resolve (auth file exists)
// ---------------------------------------------------------------------------
function authFileExists(): void {
  statMock.mockResolvedValue({ isFile: () => true });
}

// ---------------------------------------------------------------------------
// Helper: make stat throw ENOENT (auth file absent)
// ---------------------------------------------------------------------------
function authFileMissing(): void {
  const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  statMock.mockRejectedValue(err);
}

// ---------------------------------------------------------------------------
// Helper: make fetch return 200 (Ollama healthy)
// ---------------------------------------------------------------------------
function ollamaUp(): void {
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
}

// ---------------------------------------------------------------------------
// Helper: make fetch throw (Ollama unreachable)
// ---------------------------------------------------------------------------
function ollamaDown(): void {
  fetchMock.mockRejectedValue(new Error('connection refused'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('detectProvider()', () => {
  beforeEach(() => {
    execSyncMock.mockReset();
    statMock.mockReset();
    fetchMock.mockReset();
    readEnvValueFromDotEnvLocalMock.mockReset();
    readEnvValueFromDotEnvLocalMock.mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Branch 1: returns anthropic-key when ANTHROPIC_API_KEY is set', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    // Other providers should not even be checked (short-circuit)
    claudeNotOnPath();
    ollamaDown();

    const { detectProvider } = await import('../src/providers/detect.js');
    const result = await detectProvider();

    expect(result).toEqual({ kind: 'anthropic-key' });
  });

  it('Branch 2: returns claude-cli when claude is on PATH and auth file exists', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    claudeOnPath();
    authFileExists();
    ollamaDown();

    const { detectProvider } = await import('../src/providers/detect.js');
    const result = await detectProvider();

    expect(result).toEqual({ kind: 'claude-cli' });
  });

  it('Branch 3: returns ollama when claude not on PATH and fetch returns 200', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');
    claudeNotOnPath();
    ollamaUp();

    const { detectProvider } = await import('../src/providers/detect.js');
    const result = await detectProvider();

    expect(result).toEqual({ kind: 'ollama', baseUrl: 'http://localhost:11434' });
  });

  it('Branch 4: returns openai-key when fetch throws and OPENAI_API_KEY is set', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', 'sk-openai-test');
    claudeNotOnPath();
    ollamaDown();

    const { detectProvider } = await import('../src/providers/detect.js');
    const result = await detectProvider();

    expect(result).toEqual({ kind: 'openai-key' });
  });

  it('Branch 5: returns none when nothing is configured', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');
    claudeNotOnPath();
    ollamaDown();

    const { detectProvider } = await import('../src/providers/detect.js');
    const result = await detectProvider();

    expect(result.kind).toBe('none');
    expect((result as { kind: 'none'; message: string }).message).toMatch(/no AI provider/);
  });

  it('Branch 1b: returns anthropic-key when ANTHROPIC_API_KEY is in .env.local', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    readEnvValueFromDotEnvLocalMock.mockReturnValue('sk-ant-from-env-local');
    claudeNotOnPath();
    ollamaDown();

    const { detectProvider } = await import('../src/providers/detect.js');
    const result = await detectProvider();

    expect(result).toEqual({ kind: 'anthropic-key' });
  });

  it('fetch AbortError falls through to next branch (same as fetch throwing)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', 'sk-openai-test');
    claudeNotOnPath();
    // Simulate AbortError from timeout — DOMException('msg', 'AbortError') sets name correctly via constructor
    const abortErr = new DOMException('The operation was aborted.', 'AbortError');
    fetchMock.mockRejectedValue(abortErr);

    const { detectProvider } = await import('../src/providers/detect.js');
    const result = await detectProvider();

    expect(result).toEqual({ kind: 'openai-key' });
  });

  it('claude on PATH but no auth file → falls through to Ollama check', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');
    claudeOnPath();
    authFileMissing();
    ollamaUp();

    const { detectProvider } = await import('../src/providers/detect.js');
    const result = await detectProvider();

    expect(result).toEqual({ kind: 'ollama', baseUrl: 'http://localhost:11434' });
  });
});
