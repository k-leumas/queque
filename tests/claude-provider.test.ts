import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextEnvelope } from '../src/contracts/request.js';
import { DEFAULT_MODEL, resetAnthropicClientCache } from '../src/providers/claude.js';

const { createMock, anthropicCtorMock, AnthropicMock, readEnvValueFromDotEnvLocalMock } =
  vi.hoisted(() => {
    const createMock = vi.fn();
    const anthropicCtorMock = vi.fn();

    class AnthropicMock {
      messages: { create: typeof createMock };

      constructor(options: unknown) {
        anthropicCtorMock(options);
        this.messages = {
          create: createMock,
        };
      }
    }

    return {
      createMock,
      anthropicCtorMock,
      AnthropicMock,
      readEnvValueFromDotEnvLocalMock: vi.fn<(key: string, startDir?: string) => string | null>(),
    };
  });

vi.mock('@anthropic-ai/sdk', () => ({
  default: AnthropicMock,
}));

vi.mock('../src/shared/env-file.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/shared/env-file.js')>();
  return {
    ...actual,
    readEnvValueFromDotEnvLocal: readEnvValueFromDotEnvLocalMock,
  };
});

function buildEnvelope(extras: ContextEnvelope['extras'] = []): ContextEnvelope {
  return {
    base: {
      queryText: 'status',
      cwd: '/repo',
      ttyPath: '/dev/tty',
      shellPid: 1234,
      shellName: 'zsh',
      platform: 'darwin',
      timestamp: '2026-05-02T00:00:00.000Z',
    },
    extras,
  };
}

describe('fetchCandidates', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    delete process.env.QQ_MODEL;
    delete process.env.QQ_FORCE_SELECTOR;
    createMock.mockReset();
    anthropicCtorMock.mockClear();
    readEnvValueFromDotEnvLocalMock.mockReset();
    readEnvValueFromDotEnvLocalMock.mockReturnValue(null);
    resetAnthropicClientCache();
  });

  it('returns candidate JSON from Claude and includes git context in the prompt', async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '[{"command":"git status","explanation":"Show repo status"}]',
        },
      ],
    });

    const { fetchCandidates } = await import('../src/providers/claude.js');
    const result = await fetchCandidates(
      buildEnvelope([
        {
          kind: 'git',
          payload: {
            cwd: '/repo',
            root: '/repo',
            branch: 'main',
            dirty: true,
            changedFiles: ['src/index.ts'],
          },
        },
      ]),
      '',
    );

    expect(result).toEqual([{ command: 'git status', explanation: 'Show repo status' }]);
    expect(anthropicCtorMock).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(createMock).toHaveBeenCalledTimes(1);

    const request = createMock.mock.calls[0][0];
    expect(request.model).toBe(DEFAULT_MODEL);
    expect(request.messages[0].content).toContain('versionControl');
    expect(request.messages[0].content).toContain('"branch": "main"');
    expect(request.messages[0].content).toContain('"changedFiles"');
  });

  it('falls back to .env.local when ANTHROPIC_API_KEY is an empty stub', async () => {
    process.env.ANTHROPIC_API_KEY = '';
    readEnvValueFromDotEnvLocalMock.mockReturnValue('sk-ant-from-dotenv');
    createMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '[{"command":"git status","explanation":"Show repo status"}]',
        },
      ],
    });

    const { fetchCandidates } = await import('../src/providers/claude.js');
    await fetchCandidates(buildEnvelope(), '');

    expect(anthropicCtorMock).toHaveBeenCalledWith({ apiKey: 'sk-ant-from-dotenv' });
  });

  it('uses QQ_MODEL env var when set', async () => {
    process.env.QQ_MODEL = 'claude-custom';
    createMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '[{"command":"git status","explanation":""}]',
        },
      ],
    });

    const { fetchCandidates } = await import('../src/providers/claude.js');
    await fetchCandidates(buildEnvelope(), '');

    const request = createMock.mock.calls[0][0];
    expect(request.model).toBe('claude-custom');
  });

  it('falls back to a single candidate when Claude returns malformed JSON', async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: 'not json',
        },
      ],
    });

    const { fetchCandidates } = await import('../src/providers/claude.js');
    await expect(fetchCandidates(buildEnvelope(), '')).resolves.toEqual([
      { command: 'not json', explanation: '' },
    ]);
  });

  it('does not retry on model errors', async () => {
    createMock.mockRejectedValueOnce(new Error('404 model not found'));

    const { fetchCandidates } = await import('../src/providers/claude.js');
    await expect(fetchCandidates(buildEnvelope(), '')).rejects.toThrow('404 model not found');
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('includes filesystem apparentFilename in the prompt when present', async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '[{"command":"cat README.md","explanation":"Show file"}]',
        },
      ],
    });

    const { fetchCandidates } = await import('../src/providers/claude.js');
    await fetchCandidates(
      buildEnvelope([
        {
          kind: 'filesystem',
          payload: {
            cwd: '/repo',
            apparentFilename: 'README.md',
          },
        },
      ]),
      '',
    );

    const request = createMock.mock.calls[0][0];
    expect(request.messages[0].content).toContain('"filesystem"');
    expect(request.messages[0].content).toContain('"apparentFilename": "README.md"');
  });

  it('strips sensitive git paths from the prompt JSON (defense-in-depth)', async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '[{"command":"git status","explanation":""}]',
        },
      ],
    });

    const { fetchCandidates } = await import('../src/providers/claude.js');
    await fetchCandidates(
      buildEnvelope([
        {
          kind: 'git',
          payload: {
            cwd: '/repo',
            root: '/repo',
            branch: 'main',
            dirty: true,
            changedFiles: ['.env', 'src/index.ts'],
          },
        },
      ]),
      '',
    );

    const prompt = createMock.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain('src/index.ts');
    expect(prompt).not.toContain('.env');
  });

  it('pads a single candidate to two when QQ_FORCE_SELECTOR is enabled', async () => {
    process.env.QQ_FORCE_SELECTOR = 'true';
    createMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '[{"command":"git status","explanation":"Show repo status"}]',
        },
      ],
    });

    const { fetchCandidates } = await import('../src/providers/claude.js');
    const result = await fetchCandidates(buildEnvelope(), '');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      command: 'git status',
      explanation: 'Show repo status',
    });
    expect(result[1]?.command).toBe('git status');
    expect(result[1]?.explanation).toContain('forced duplicate');
  });

  it('reuses the Anthropic client for a second fetch with the same key', async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '[{"command":"git status","explanation":"Show repo status"}]',
        },
      ],
    });

    const { fetchCandidates } = await import('../src/providers/claude.js');
    await fetchCandidates(buildEnvelope(), '');
    await fetchCandidates(buildEnvelope(), '');
    expect(anthropicCtorMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});
