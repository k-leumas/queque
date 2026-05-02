import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type ContextEnvelope } from '../src/contracts/request.js';

const { createMock, modelListMock, anthropicCtorMock } = vi.hoisted(() => {
  const createMock = vi.fn();
  const modelListMock = vi.fn();
  const anthropicCtorMock = vi.fn();

  return { createMock, modelListMock, anthropicCtorMock };
});

class AnthropicMock {
  messages: { create: typeof createMock };
  models: { list: typeof modelListMock };

  constructor(options: unknown) {
    anthropicCtorMock(options);
    this.messages = {
      create: createMock,
    };
    this.models = {
      list: modelListMock,
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
    createMock.mockReset();
    modelListMock.mockReset();
    anthropicCtorMock.mockClear();
  });

  it('returns candidate JSON from Claude and includes git context in the prompt', async () => {
    modelListMock.mockImplementation(async function* () {
      yield { id: 'claude-sonnet-4-20250514' };
      yield { id: 'claude-3-5-haiku-20241022' };
      yield { id: 'claude-3-haiku-20240307' };
    });
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
    expect(modelListMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledTimes(1);

    const request = createMock.mock.calls[0][0];
    expect(request.model).toBe('claude-3-haiku-20240307');
    expect(request.messages[0].content).toContain('versionControl');
    expect(request.messages[0].content).toContain('"branch": "main"');
    expect(request.messages[0].content).toContain('"changedFiles"');
  });

  it('falls back to a single candidate when Claude returns malformed JSON', async () => {
    modelListMock.mockImplementation(async function* () {
      yield { id: 'claude-sonnet-4-20250514' };
    });
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
    modelListMock.mockImplementation(async function* () {
      yield { id: 'claude-sonnet-4-20250514' };
    });
    createMock.mockRejectedValueOnce(new Error('404 model not found'));

    const { fetchCandidates } = await import('../src/providers/claude.js');
    await expect(fetchCandidates(buildEnvelope(), '')).rejects.toThrow('404 model not found');
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0].model).toBe('claude-sonnet-4-20250514');
  });
});
