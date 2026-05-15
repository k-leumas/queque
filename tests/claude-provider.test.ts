import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type ContextEnvelope } from '../src/contracts/request.js';

const { createMock, anthropicCtorMock } = vi.hoisted(() => {
  const createMock = vi.fn();
  const anthropicCtorMock = vi.fn();

  return { createMock, anthropicCtorMock };
});

class AnthropicMock {
  messages: { create: typeof createMock };

  constructor(options: unknown) {
    anthropicCtorMock(options);
    this.messages = {
      create: createMock,
    };
  }
}

vi.mock('@anthropic-ai/sdk', () => ({
  default: AnthropicMock,
}));

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
    expect(request.model).toBe('claude-haiku-4-5-20251001');
    expect(request.messages[0].content).toContain('versionControl');
    expect(request.messages[0].content).toContain('"branch": "main"');
    expect(request.messages[0].content).toContain('"changedFiles"');
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
});
